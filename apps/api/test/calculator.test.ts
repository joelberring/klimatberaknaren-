import { describe, expect, it } from "vitest";

import { calculateClimateImpact } from "../src/services/calculator";

describe("calculateClimateImpact", () => {
  it("uses fallback benchmark energy when no specific energy input is provided", () => {
    const result = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 1200,
      buildYear: 2005,
      frameMaterial: "betong",
      energyStandard: "modern",
      heatingType: "fjarrvarme"
    });

    expect(result.operational.annualKgCo2e).toBe(4937);
    expect(result.operational.lifetimeKgCo2e).toBe(246850);
  });

  it("reduces annual operational impact when low U-values are provided", () => {
    const baseline = calculateClimateImpact({
      buildingType: "smahus",
      grossFloorAreaM2: 180,
      buildYear: 2018,
      frameMaterial: "tra",
      energyStandard: "modern",
      heatingType: "varmepump"
    });

    const improvedEnvelope = calculateClimateImpact({
      buildingType: "smahus",
      grossFloorAreaM2: 180,
      buildYear: 2018,
      frameMaterial: "tra",
      energyStandard: "modern",
      heatingType: "varmepump",
      uValues: {
        yttervagg: 0.18,
        tak: 0.11,
        fonster: 0.9
      }
    });

    expect(improvedEnvelope.operational.annualKgCo2e).toBeLessThan(
      baseline.operational.annualKgCo2e
    );
  });

  it("returns embodied breakdown for chosen frame material", () => {
    const result = calculateClimateImpact({
      buildingType: "kontor",
      grossFloorAreaM2: 1000,
      buildYear: 2020,
      frameMaterial: "stal",
      energyStandard: "modern",
      heatingType: "el",
      specificEnergyUseKwhM2Year: 90
    });

    const frameItem = result.embodied.breakdown.find((item) => item.key === "frame");

    expect(frameItem?.label).toContain("Stål");
    expect(frameItem?.valueKgCo2e).toBe(288000);
  });

  it("builds traceable explanations and per-hectare metric when site inputs are provided", () => {
    const result = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      siteAreaM2: 6000,
      parkingSpaces: 12,
      landType: "gronyta",
      foundationType: "palar"
    });

    expect(result.perHa?.value).toBeGreaterThan(0);
    expect(result.explanationIndex["site.foundation"]).toBeTruthy();
    expect(result.explanations.find((item) => item.traceKey === "site.parking")).toBeTruthy();
    expect(result.explanations.find((item) => item.traceKey === "mobility.total")).toBeTruthy();
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("raises foundation and parking emissions when soil is soft and a garage is added", () => {
    const surfaceReference = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      parkingSpaces: 20,
      foundationType: "platta_pa_mark",
      groundCondition: "normal_mark"
    });

    const softSoilGarage = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      parkingSpaces: 20,
      foundationType: "palar",
      groundCondition: "gyttja_mjuk",
      parkingStructureType: "garage_under_mark",
      parkingGarageFloors: 3
    });

    const surfaceFoundation = surfaceReference.embodied.breakdown.find(
      (item) => item.traceKey === "site.foundation"
    );
    const softFoundation = softSoilGarage.embodied.breakdown.find(
      (item) => item.traceKey === "site.foundation"
    );
    const surfaceParking = surfaceReference.embodied.breakdown.find(
      (item) => item.traceKey === "site.parking"
    );
    const garageParking = softSoilGarage.embodied.breakdown.find(
      (item) => item.traceKey === "site.parking"
    );

    expect(softFoundation?.valueKgCo2e).toBeGreaterThan(surfaceFoundation?.valueKgCo2e ?? 0);
    expect(garageParking?.valueKgCo2e).toBeGreaterThan(surfaceParking?.valueKgCo2e ?? 0);
    expect(softSoilGarage.assumptions.some((item) => item.label === "Markförhållande")).toBe(true);
    expect(softSoilGarage.assumptions.some((item) => item.label === "Parkeringslösning")).toBe(true);
  });

  it("infers a källare-like foundation when parking is placed under mark", () => {
    const garageBelowGrade = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      parkingSpaces: 20,
      groundCondition: "normal_mark",
      parkingStructureType: "garage_under_mark",
      parkingGarageFloors: 2
    });

    const foundation = garageBelowGrade.embodied.breakdown.find(
      (item) => item.traceKey === "site.foundation"
    );
    const assumptions = garageBelowGrade.assumptions.map((item) => `${item.label}: ${item.value}`);

    expect(foundation?.label).toContain("Källare");
    expect(garageBelowGrade.explanations.find((item) => item.traceKey === "site.foundation")?.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "foundationType", label: "Grundläggningstyp" }),
        expect.objectContaining({ key: "basementFloors", label: "Källarvåningar" }),
        expect.objectContaining({ key: "parkingStructureType", label: "Parkeringslösning" }),
        expect.objectContaining({ key: "parkingGarageFloors", label: "Garagevåningar" })
      ])
    );
    expect(assumptions.some((item) => item.includes("Garage under mark"))).toBe(true);
  });

  it("raises foundation impact further when additional basement floors are added", () => {
    const singleBasement = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      foundationType: "kallare",
      basementFloors: 1,
      groundCondition: "normal_mark"
    });

    const doubleBasement = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      foundationType: "kallare",
      basementFloors: 3,
      groundCondition: "normal_mark"
    });

    const singleFoundation = singleBasement.embodied.breakdown.find(
      (item) => item.traceKey === "site.foundation"
    );
    const doubleFoundation = doubleBasement.embodied.breakdown.find(
      (item) => item.traceKey === "site.foundation"
    );

    expect(doubleFoundation?.valueKgCo2e).toBeGreaterThan(singleFoundation?.valueKgCo2e ?? 0);
    expect(
      doubleBasement.assumptions.some((item) => item.label === "Källarvåningar" && item.value === "3 vån")
    ).toBe(true);
  });

  it("reduces mobility impact when transit overrides indicate stronger accessibility", () => {
    const lowAccess = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      estimatedResidents: 60,
      parkingSpaces: 24,
      transitOverrides: {
        distanceToTransitStopM: 1200,
        distanceToRailStationM: 4000,
        departuresPerHour: 2
      }
    });

    const highAccess = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      estimatedResidents: 60,
      parkingSpaces: 6,
      transitOverrides: {
        distanceToTransitStopM: 250,
        distanceToRailStationM: 700,
        departuresPerHour: 12
      }
    });

    expect(highAccess.mobility.annualKgCo2e).toBeLessThan(lowAccess.mobility.annualKgCo2e);
    expect(highAccess.totals.value).toBeLessThan(lowAccess.totals.value);
  });

  it("does not force partially provided transit overrides down to low accessibility", () => {
    const baseline = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      estimatedResidents: 60,
      parkingSpaces: 12
    });

    const partialTransit = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      estimatedResidents: 60,
      parkingSpaces: 12,
      transitOverrides: {
        distanceToTransitStopM: 250,
        departuresPerHour: 12
      }
    });

    expect(partialTransit.mobility.inputs.accessibilityBand).toBe("high");
    expect(partialTransit.mobility.inputs.distanceToRailStationM).toBeUndefined();
    expect(partialTransit.mobility.annualKgCo2e).toBeLessThan(baseline.mobility.annualKgCo2e);
  });

  it("reduces mobility impact when service is closer to the site", () => {
    const farService = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      estimatedResidents: 60,
      parkingSpaces: 0,
      urbanContext: "urban",
      transitOverrides: {
        distanceToTransitStopM: 250,
        distanceToRailStationM: 700,
        departuresPerHour: 12
      },
      distanceToServiceM: 3000
    });

    const nearService = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 2400,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme",
      estimatedResidents: 60,
      parkingSpaces: 0,
      urbanContext: "urban",
      transitOverrides: {
        distanceToTransitStopM: 250,
        distanceToRailStationM: 700,
        departuresPerHour: 12
      },
      distanceToServiceM: 150
    });

    expect(nearService.mobility.annualKgCo2e).toBeLessThan(farService.mobility.annualKgCo2e);
    expect(nearService.mobility.inputs.distanceToServiceM).toBe(150);
  });

  it("shows lower embodied total for ombyggnad than equivalent nybyggnad when retention is high", () => {
    const newBuild = calculateClimateImpact({
      buildingType: "kontor",
      grossFloorAreaM2: 3000,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "modern",
      heatingType: "fjarrvarme"
    });

    const retrofit = calculateClimateImpact({
      buildingType: "kontor",
      grossFloorAreaM2: 3000,
      buildYear: 2030,
      frameMaterial: "betong",
      energyStandard: "modern",
      heatingType: "fjarrvarme",
      interventionType: "ombyggnad",
      existingBuilding: {
        grossFloorAreaM2: 3000,
        buildYear: 1985,
        frameMaterial: "betong",
        energyStandard: "aldre",
        specificEnergyUseKwhM2Year: 180
      },
      retrofitDepth: "medium",
      retainedStructureSharePct: 80
    });

    expect(retrofit.embodied.totalKgCo2e).toBeLessThan(newBuild.embodied.totalKgCo2e);
    expect(retrofit.baselineComparison?.annualOperationalDeltaKgCo2e).toBeLessThan(0);
  });

  it("reduces uncertainty when early-stage inputs are more complete", () => {
    const sparseScreening = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 1400,
      buildYear: 2032,
      frameMaterial: "betong",
      energyStandard: "normal",
      heatingType: "fjarrvarme"
    });

    const detailedScreening = calculateClimateImpact({
      buildingType: "flerbostadshus",
      grossFloorAreaM2: 1400,
        buildYear: 2032,
        frameMaterial: "betong",
        energyStandard: "normal",
        heatingType: "fjarrvarme",
        buildingForm: "kompakt",
        urbanContext: "stockholm_innerstad",
        floorsAboveGround: 6,
      buildingFootprintM2: 240,
      siteAreaM2: 5000,
      groundCondition: "sand_grus",
      foundationType: "platta_pa_mark",
      parkingStructureType: "none",
      siteLocation: {
        lat: 59.3293,
        lon: 18.0686
      },
      transitOverrides: {
        distanceToTransitStopM: 220,
        distanceToRailStationM: 600,
        departuresPerHour: 12
      },
      specificEnergyUseKwhM2Year: 82
    });

    expect(detailedScreening.uncertaintyRangePct).toBeLessThan(sparseScreening.uncertaintyRangePct);
  });
});
