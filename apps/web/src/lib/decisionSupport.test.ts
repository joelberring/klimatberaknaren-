import { describe, expect, it } from "vitest";

import type { CalculateRequest, CalculationResult, Scenario } from "../../../../packages/shared/src";
import {
  applyBuildingTypePreset,
  buildDecisionSummaries,
  BUILDING_TYPE_PRESETS
} from "./decisionSupport";

function makeResult(
  overrides: {
    perM2: number;
    total: number;
    perPerson: number;
    uncertaintyRangePct: number;
    accessibilityBand: "high" | "medium" | "low";
    urbanContext: "stockholm_innerstad" | "central_storstad" | "urban" | "suburban";
    defaultsApplied?: string[];
    internalAssumptionEvidenceCount?: number;
  }
): CalculationResult {
  return {
    embodied: {
      totalKgCo2e: 120000,
      breakdown: []
    },
    operational: {
      annualKgCo2e: 3000,
      lifetimeKgCo2e: 150000,
      breakdown: []
    },
    mobility: {
      annualKgCo2e: 1200,
      lifetimeKgCo2e: 60000,
      breakdown: [],
      inputs: {
        accessibilityBand: overrides.accessibilityBand,
        urbanContext: overrides.urbanContext,
        source: "siteLocation"
      }
    },
    assumptions: [],
    sources: [],
    uncertaintyRangePct: overrides.uncertaintyRangePct,
    totals: {
      label: "Totalt klimatutsläpp",
      value: overrides.total,
      unit: "kg CO2e",
      traceKey: "totals"
    },
    perM2: {
      label: "Klimatutsläpp per m2",
      value: overrides.perM2,
      unit: "kg CO2e/m2",
      traceKey: "perM2"
    },
    perPerson: {
      label: "Klimatutsläpp per person",
      value: overrides.perPerson,
      unit: "kg CO2e/person",
      traceKey: "perPerson"
    },
    perHa: {
      label: "Klimatutsläpp per hektar",
      value: 4000000,
      unit: "kg CO2e/ha",
      traceKey: "perHa"
    },
    population: {
      residents: 20,
      workers: 8,
      totalPeople: 28,
      source: "estimated"
    },
    vsBenchmark: [
      {
        metric: "perM2",
        label: "Per m2",
        referenceLabel: "Normalvärde",
        actualValue: overrides.perM2,
        referenceValue: 680,
        delta: overrides.perM2 - 680,
        deltaPct: Math.round(((overrides.perM2 - 680) / 680) * 100),
        status: overrides.perM2 < 680 ? "below" : "above",
        unit: "kg CO2e/m2",
        traceKey: "benchmark.perM2.normal"
      }
    ],
    vsTarget: [],
    topDrivers: [],
    recommendedActions: [],
    explanations: [
      {
        id: "exp-1",
        traceKey: "totals",
        title: "Totalt klimatutsläpp",
        summary: "Summerar alla huvudposter.",
        formulaText: "embodied + operational + mobility",
        calculationSteps: ["Test"],
        inputs: [],
        defaultsApplied: overrides.defaultsApplied ?? [],
        evidence:
          overrides.internalAssumptionEvidenceCount && overrides.internalAssumptionEvidenceCount > 0
            ? Array.from({ length: overrides.internalAssumptionEvidenceCount }, (_, index) => ({
                methodId: `m-${index + 1}`,
                sourceId: "source-1",
                evidenceType: "internal-assumption" as const,
                title: "Proxy",
                publisher: "Test",
                url: "https://example.com",
                citationShort: "Proxy",
                versionOrYear: "2026"
              }))
            : [
                {
                  methodId: "method-embodied-standard",
                  sourceId: "source-1",
                  evidenceType: "standard" as const,
                  title: "Standard",
                  publisher: "Test",
                  url: "https://example.com",
                  citationShort: "Standard",
                  versionOrYear: "2026"
                }
              ],
        limitations: []
      }
    ],
    explanationIndex: {
      totals: ["exp-1"],
      perM2: ["exp-1"]
    }
  } as unknown as CalculationResult;
}

function makeScenario(id: string, name: string, inputSnapshot: CalculateRequest, result: CalculationResult): Scenario {
  return {
    id,
    projectId: "project-1",
    name,
    mode: "quick",
    quickInput: inputSnapshot,
    planObjects: [],
    runs: [
      {
        id: `${id}-run-1`,
        scenarioId: id,
        createdAt: "2026-03-18T10:00:00.000Z",
        result,
        inputSnapshot
      }
    ],
    latestResult: result,
    lastCalculatedAt: "2026-03-18T10:00:00.000Z",
    createdAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-18T10:00:00.000Z"
  };
}

describe("decisionSupport", () => {
  it("applies building type presets to screening inputs", () => {
    const result = applyBuildingTypePreset(
      {
        buildingType: "flerbostadshus",
        grossFloorAreaM2: 1200,
        buildYear: 2030,
        frameMaterial: "betong",
        energyStandard: "normal",
        heatingType: "fjarrvarme"
      },
      "kontor"
    );

    expect(result.buildingForm).toBe(BUILDING_TYPE_PRESETS.kontor.buildingForm);
    expect(result.urbanContext).toBe(BUILDING_TYPE_PRESETS.kontor.urbanContext);
    expect(result.floorsAboveGround).toBe(BUILDING_TYPE_PRESETS.kontor.floorsAboveGround);
    expect(result.parkingStructureType).toBe(BUILDING_TYPE_PRESETS.kontor.parkingStructureType);
  });

  it("ranks a compact inner-city scenario above a proxy-heavy suburban one for balance", () => {
    const innerCityScenario = makeScenario(
      "scenario-inner-city",
      "Innerstad kompakt",
      {
        buildingType: "flerbostadshus",
        grossFloorAreaM2: 1200,
        buildYear: 2030,
        frameMaterial: "tra",
        energyStandard: "modern",
        heatingType: "fjarrvarme",
        buildingForm: "kompakt",
        urbanContext: "stockholm_innerstad",
        floorsAboveGround: 6,
        buildingFootprintM2: 220,
        parkingStructureType: "none",
        parkingSpaces: 0
      },
      makeResult({
        total: 420000,
        perM2: 350,
        perPerson: 15000,
        uncertaintyRangePct: 12,
        accessibilityBand: "high",
        urbanContext: "stockholm_innerstad",
        defaultsApplied: [],
        internalAssumptionEvidenceCount: 0
      })
    );

    const suburbanScenario = makeScenario(
      "scenario-suburban",
      "Förort garage",
      {
        buildingType: "kontor",
        grossFloorAreaM2: 1200,
        buildYear: 2030,
        frameMaterial: "betong",
        energyStandard: "normal",
        heatingType: "fjarrvarme",
        buildingForm: "fragmenterad",
        urbanContext: "suburban",
        floorsAboveGround: 2,
        buildingFootprintM2: 700,
        parkingStructureType: "garage_under_mark",
        parkingGarageFloors: 3,
        parkingSpaces: 60
      },
      makeResult({
        total: 710000,
        perM2: 590,
        perPerson: 24000,
        uncertaintyRangePct: 28,
        accessibilityBand: "low",
        urbanContext: "suburban",
        defaultsApplied: ["Byggnadsform", "Parkeringslösning", "Grundläggning"],
        internalAssumptionEvidenceCount: 3
      })
    );

    const summaries = buildDecisionSummaries(
      [innerCityScenario, suburbanScenario],
      "perM2",
      "balance"
    );

    expect(summaries[0]?.scenarioId).toBe("scenario-inner-city");
    expect(summaries[0]?.objectiveScore).toBeGreaterThan(summaries[1]?.objectiveScore ?? 0);
    expect(summaries[0]?.locationScore).toBeGreaterThan(summaries[1]?.locationScore ?? 0);
    expect(summaries[0]?.robustnessScore).toBeGreaterThan(summaries[1]?.robustnessScore ?? 0);
  });

  it("gives a small location bonus when service is close by", () => {
    const nearServiceScenario = makeScenario(
      "scenario-near-service",
      "Nära service",
      {
        buildingType: "flerbostadshus",
        grossFloorAreaM2: 1200,
        buildYear: 2030,
        frameMaterial: "tra",
        energyStandard: "modern",
        heatingType: "fjarrvarme",
        buildingForm: "kompakt",
        urbanContext: "urban",
        floorsAboveGround: 6,
        buildingFootprintM2: 220,
        parkingStructureType: "none",
        parkingSpaces: 0,
        distanceToServiceM: 120
      },
      makeResult({
        total: 420000,
        perM2: 350,
        perPerson: 15000,
        uncertaintyRangePct: 12,
        accessibilityBand: "high",
        urbanContext: "stockholm_innerstad",
        defaultsApplied: [],
        internalAssumptionEvidenceCount: 0
      })
    );

    const farServiceScenario = makeScenario(
      "scenario-far-service",
      "Långt till service",
      {
        buildingType: "flerbostadshus",
        grossFloorAreaM2: 1200,
        buildYear: 2030,
        frameMaterial: "tra",
        energyStandard: "modern",
        heatingType: "fjarrvarme",
        buildingForm: "kompakt",
        urbanContext: "urban",
        floorsAboveGround: 6,
        buildingFootprintM2: 220,
        parkingStructureType: "none",
        parkingSpaces: 0,
        distanceToServiceM: 1800
      },
      makeResult({
        total: 420000,
        perM2: 350,
        perPerson: 15000,
        uncertaintyRangePct: 12,
        accessibilityBand: "high",
        urbanContext: "stockholm_innerstad",
        defaultsApplied: [],
        internalAssumptionEvidenceCount: 0
      })
    );

    const summaries = buildDecisionSummaries(
      [nearServiceScenario, farServiceScenario],
      "perM2",
      "balance"
    );

    const nearSummary = summaries.find((summary) => summary.scenarioId === "scenario-near-service");
    const farSummary = summaries.find((summary) => summary.scenarioId === "scenario-far-service");

    expect(nearSummary?.locationScore).toBeGreaterThan(farSummary?.locationScore ?? 0);
  });
});
