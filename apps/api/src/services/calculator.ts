import {
  type BenchmarkComparison,
  type BenchmarkProfile,
  BUILDING_LIFETIME_YEARS,
  DEFAULT_UNCERTAINTY_RANGE_PCT,
  LABELS,
  STOCKHOLM_PROFILE_NAME,
  type AssumptionEntry,
  type BaselineComparison,
  type BaselineExistingSummary,
  type BreakdownItem,
  type CalculateRequest,
  type CalculationExplanation,
  type CalculationResult,
  type DriverInsight,
  type EvidenceReference,
  type ExistingBuildingInput,
  type InputTrace,
  type MetricValue,
  type MobilityInputs,
  type MobilityResult,
  type PlanObjectResult,
  type PopulationEstimate,
  type RecommendedAction,
  type SourceReference,
  type TargetProfile,
  type TransitOverrides,
  labelUrbanContext,
  normalizeUrbanContext
} from "../../../../packages/shared/src";

import { type MobilityReferenceRecord, getReferenceData } from "../lib/referenceData";

function round(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function withShares(items: BreakdownItem[], total: number) {
  return items.map((item) => ({
    ...item,
    shareOfTotalPct: total > 0 ? Math.round((item.valueKgCo2e / total) * 100) : 0
  }));
}

function toMetricValue(
  label: string,
  value: number,
  unit: string,
  traceKey: string
): MetricValue {
  return {
    label,
    value: round(value),
    unit,
    traceKey
  };
}

function buildExplanationIndex(explanations: CalculationExplanation[]) {
  return explanations.reduce<Record<string, string[]>>((accumulator, explanation) => {
    accumulator[explanation.traceKey] = [
      ...(accumulator[explanation.traceKey] ?? []),
      explanation.id
    ];
    return accumulator;
  }, {});
}

function explanation(
  id: string,
  traceKey: string,
  title: string,
  summary: string,
  formulaText: string,
  calculationSteps: string[],
  inputs: InputTrace[],
  defaultsApplied: string[],
  evidence: EvidenceReference[],
  limitations: string[]
): CalculationExplanation {
  return {
    id,
    traceKey,
    title,
    summary,
    formulaText,
    formula: {
      expression: formulaText
    },
    calculationSteps,
    inputs,
    defaultsApplied,
    evidence,
    limitations
  };
}

function mergeBreakdowns(lists: BreakdownItem[][]) {
  const map = new Map<string, BreakdownItem>();

  for (const list of lists) {
    for (const item of list) {
      const existing = map.get(item.key);

      if (existing) {
        existing.valueKgCo2e += item.valueKgCo2e;
      } else {
        map.set(item.key, { ...item, shareOfTotalPct: undefined });
      }
    }
  }

  return Array.from(map.values());
}

function scaleBreakdownsToTotal(items: BreakdownItem[], newTotal: number) {
  const currentTotal = items.reduce((sum, item) => sum + item.valueKgCo2e, 0);

  if (currentTotal <= 0) {
    return items.map((item) => ({
      ...item,
      valueKgCo2e: 0
    }));
  }

  return items.map((item, index) => {
    if (index === items.length - 1) {
      const subtotal = items
        .slice(0, -1)
        .reduce((sum, candidate) => sum + round((candidate.valueKgCo2e / currentTotal) * newTotal), 0);
      return {
        ...item,
        valueKgCo2e: Math.max(0, round(newTotal - subtotal))
      };
    }

    return {
      ...item,
      valueKgCo2e: round((item.valueKgCo2e / currentTotal) * newTotal)
    };
  });
}

function scaleSpecificItems(
  items: BreakdownItem[],
  factor: number,
  traceKeys: string[],
  noteSuffix?: string
) {
  const set = new Set(traceKeys);
  return items.map((item) =>
    item.traceKey && set.has(item.traceKey)
      ? {
          ...item,
          valueKgCo2e: round(item.valueKgCo2e * factor),
          note: noteSuffix ? `${item.note ? `${item.note} • ` : ""}${noteSuffix}` : item.note
        }
      : { ...item }
  );
}

function dedupeSources(items: SourceReference[]) {
  const map = new Map<string, SourceReference>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function estimatePopulation(
  request: Pick<
    CalculateRequest,
    "buildingType" | "grossFloorAreaM2" | "estimatedResidents" | "estimatedWorkers"
  >,
  benchmarkProfile?: BenchmarkProfile
): PopulationEstimate {
  const residents = request.estimatedResidents;
  const workers = request.estimatedWorkers;

  if (residents !== undefined || workers !== undefined) {
    const residentCount = residents ?? 0;
    const workerCount = workers ?? 0;

    return {
      residents: residentCount,
      workers: workerCount,
      totalPeople: residentCount + workerCount,
      source: "user"
    };
  }

  const area = request.grossFloorAreaM2;
  const defaultResidentBta = benchmarkProfile?.defaultBtaPerResidentM2 ?? 43;
  const defaultWorkerBta = benchmarkProfile?.defaultBtaPerWorkerM2 ?? 20;

  if (request.buildingType === "smahus") {
    const residentCount = Math.max(1, Math.round(area / 55));
    return {
      residents: residentCount,
      workers: 0,
      totalPeople: residentCount,
      source: "estimated"
    };
  }

  if (request.buildingType === "flerbostadshus") {
    const residentCount = Math.max(1, Math.round(area / defaultResidentBta));
    return {
      residents: residentCount,
      workers: 0,
      totalPeople: residentCount,
      source: "estimated"
    };
  }

  const divisor =
    request.buildingType === "handel"
      ? 50
      : request.buildingType === "skola"
        ? 25
        : defaultWorkerBta;
  const workerCount = Math.max(1, Math.round(area / divisor));

  return {
    residents: 0,
    workers: workerCount,
    totalPeople: workerCount,
    source: "estimated"
  };
}

function getUValueAdjustment(
  request: CalculateRequest,
  baselineUValues: Record<string, number>
) {
  if (!request.uValues) {
    return {
      multiplier: 1,
      note: "Ej justerad med U-värden"
    };
  }

  const wallRatio = request.uValues.yttervagg
    ? request.uValues.yttervagg / baselineUValues.yttervagg
    : 1;
  const roofRatio = request.uValues.tak ? request.uValues.tak / baselineUValues.tak : 1;
  const windowRatio = request.uValues.fonster
    ? request.uValues.fonster / baselineUValues.fonster
    : 1;

  const weightedRatio = wallRatio * 0.4 + roofRatio * 0.25 + windowRatio * 0.35;
  const boundedMultiplier = Math.min(1.2, Math.max(0.8, weightedRatio));

  return {
    multiplier: boundedMultiplier,
    note: `Justerad med U-värden (${boundedMultiplier.toFixed(2)}x mot basprofil)`
  };
}

function getCategory(traceKey?: string): DriverInsight["category"] {
  if (!traceKey) {
    return "plan";
  }

  if (traceKey.startsWith("operational.")) {
    return "operational";
  }

  if (traceKey.startsWith("site.")) {
    return "site";
  }

  if (traceKey.startsWith("mobility.")) {
    return "mobility";
  }

  return "embodied";
}

function buildTopDrivers(
  embodied: BreakdownItem[],
  operational: BreakdownItem[],
  mobility: BreakdownItem[],
  totalKgCo2e: number
): DriverInsight[] {
  const driverItems = [
    ...embodied.map((item) => ({ item, comparableImpactKgCo2e: item.valueKgCo2e })),
    ...operational.map((item) => ({
      item,
      comparableImpactKgCo2e: item.valueKgCo2e * BUILDING_LIFETIME_YEARS
    })),
    ...mobility.map((item) => ({
      item,
      comparableImpactKgCo2e: item.valueKgCo2e * BUILDING_LIFETIME_YEARS
    }))
  ];

  return driverItems
    .map(({ item, comparableImpactKgCo2e }) => ({
      key: item.key,
      label: item.label,
      category: getCategory(item.traceKey),
      impactKgCo2e: round(comparableImpactKgCo2e),
      sharePct: totalKgCo2e > 0 ? Math.round((comparableImpactKgCo2e / totalKgCo2e) * 100) : 0,
      explanation:
        item.note ??
        (getCategory(item.traceKey) === "operational"
          ? "Stor andel av driftens klimatpåverkan över livslängden."
          : getCategory(item.traceKey) === "mobility"
            ? "Stor andel av användarresor och platsberoende mobilitet över livslängden."
            : "Stor andel av projektets klimatpåverkan."),
      traceKey: item.traceKey
    }))
    .sort((left, right) => right.impactKgCo2e - left.impactKgCo2e)
    .slice(0, 5);
}

function buildRecommendedActions(
  request: CalculateRequest,
  perM2KgCo2e: number,
  totalKgCo2e: number,
  mobility: MobilityResult
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (request.frameMaterial === "betong" || request.frameMaterial === "stal") {
    actions.push({
      id: "frame-material",
      title: "Minska stommens klimatavtryck",
      description:
        "Testa trä eller hybridstomme i ett alternativscenario. Stommen tenderar att vara den största embodied-drivaren i den här typen av projekt.",
      expectedImpact: "high",
      lever: "stommaterial",
      traceKey: "action.frame-material"
    });
  }

  if (request.energyStandard === "aldre" || request.energyStandard === "normal") {
    actions.push({
      id: "energy-standard",
      title: "Skärp energistandarden",
      description:
        "Prova modern standard eller passivhus i ett alternativscenario för att sänka driftutsläppen och gapet till målvärdet.",
      expectedImpact: "high",
      lever: "energistandard",
      traceKey: "action.energy-standard"
    });
  }

  if (mobility.inputs.accessibilityBand === "low") {
    actions.push({
      id: "mobility-location",
      title: "Testa kollektivtrafiknärmare läge",
      description:
        "Det här läget ger en biltyngre resprofil. Jämför med bättre kollektivtrafikläge eller färre parkeringsplatser för att sänka användarresornas klimatpåverkan.",
      expectedImpact: "medium",
      lever: "lage_och_tillganglighet",
      traceKey: "action.mobility-location"
    });
  }

  if ((request.parkingSpaces ?? 0) > 0) {
    actions.push({
      id: "parking",
      title: "Pröva lägre parkeringstal",
      description:
        "Parkeringsposten och resprofilen kan ge betydande utslag i tidiga skeden. Testa ett scenario med färre parkeringsplatser eller bättre kollektivtrafikläge.",
      expectedImpact: "medium",
      lever: "parkering",
      traceKey: "action.parking"
    });
  }

  if ((request.parkingStructureType ?? "none") !== "none") {
    actions.push({
      id: "garage-volume",
      title: "Skala ned garagevolymen",
      description:
        "Garagevåningar driver ofta upp den inbyggda klimatpåverkan betydligt. Testa färre garagevåningar, annan parkeringslösning eller delad parkering.",
      expectedImpact: "high",
      lever: "garage",
      traceKey: "action.garage-volume"
    });
  }

  if (request.interventionType === "nybyggnad" && perM2KgCo2e > 550) {
    actions.push({
      id: "area-efficiency",
      title: "Förbättra yteffektiviteten",
      description:
        "Det här scenariot har höga utsläpp per m2. Se över area, täthet eller om en större del av programmet kan lösas med ombyggnad eller påbyggnad.",
      expectedImpact: "medium",
      lever: "yta_och_tathet",
      traceKey: "action.area-efficiency"
    });
  }

  if (request.interventionType === "ombyggnad" || request.interventionType === "pabyggnad") {
    actions.push({
      id: "retention",
      title: "Jämför högre bevarandegrad",
      description:
        "Skapa ett alternativ med större bevarad stomandel eller mindre tilläggsingrepp för att testa hur känsligt resultatet är för återbruk av befintlig struktur.",
      expectedImpact: "medium",
      lever: "bevarandegrad",
      traceKey: "action.retention"
    });
  }

  if (totalKgCo2e > 0 && actions.length === 0) {
    actions.push({
      id: "iterate-scenarios",
      title: "Bygg vidare med scenariolaborationer",
      description:
        "Skapa ett alternativ med justerad stomme, energistandard, läge eller ingreppstyp för att få ett tydligare beslutsunderlag.",
      expectedImpact: "low",
      lever: "scenariojamforelse",
      traceKey: "action.iterate-scenarios"
    });
  }

  return actions.slice(0, 5);
}

function buildMethodResolver(
  sourceCatalog: SourceReference[],
  methodCatalog: ReturnType<typeof getReferenceData>["methodCatalog"]
) {
  const sourceMap = new Map(sourceCatalog.map((source) => [source.id, source]));
  const methodMap = new Map(methodCatalog.map((method) => [method.id, method]));

  function toEvidence(methodId: string): EvidenceReference {
    const method = methodMap.get(methodId);

    if (!method) {
      throw new Error(`Saknar metodreferens: ${methodId}`);
    }

    return {
      methodId: method.id,
      sourceId: method.sourceId,
      evidenceType: method.evidenceType,
      title: method.title,
      publisher: method.publisher,
      url: method.url,
      citationShort: method.citationShort,
      versionOrYear: method.versionOrYear
    };
  }

  function toSourceList(methodIds: string[]) {
    const ids = new Set<string>();

    for (const methodId of methodIds) {
      const method = methodMap.get(methodId);
      if (method) {
        ids.add(method.sourceId);
      }
    }

    return sourceCatalog.filter((source) => ids.has(source.id));
  }

  function evidenceFor(methodIds: string[]) {
    return Array.from(new Set(methodIds)).map(toEvidence);
  }

  return {
    evidenceFor,
    methodsToSourceList: toSourceList,
    sourceMap
  };
}

function buildComparisons(
  totalKgCo2e: number,
  perM2KgCo2e: number,
  perPersonKgCo2e: number,
  perHaKgCo2e: number | undefined,
  area: number,
  populationTotal: number,
  benchmarkProfile?: BenchmarkProfile,
  targetProfile?: TargetProfile
) {
  if (!benchmarkProfile) {
    return {
      vsBenchmark: [] as BenchmarkComparison[],
      vsTarget: [] as BenchmarkComparison[]
    };
  }

  const benchmarkValues = {
    total: benchmarkProfile.normalPerM2KgCo2e * area,
    perM2: benchmarkProfile.normalPerM2KgCo2e,
    perPerson: benchmarkProfile.normalPerPersonKgCo2e,
    perHa: benchmarkProfile.normalPerHaKgCo2e
  };

  const targetValues = {
    total: (targetProfile?.targetPerM2KgCo2e ?? benchmarkProfile.targetPerM2KgCo2e) * area,
    perM2: targetProfile?.targetPerM2KgCo2e ?? benchmarkProfile.targetPerM2KgCo2e,
    perPerson: targetProfile?.targetPerPersonKgCo2e ?? benchmarkProfile.targetPerPersonKgCo2e,
    perHa: targetProfile?.targetPerHaKgCo2e ?? benchmarkProfile.targetPerHaKgCo2e
  };

  const actualValues = {
    total: totalKgCo2e,
    perM2: perM2KgCo2e,
    perPerson: populationTotal > 0 ? perPersonKgCo2e : 0,
    perHa: perHaKgCo2e
  };

  const createComparison = (
    metric: "total" | "perM2" | "perPerson" | "perHa",
    referenceValue: number,
    referenceLabel: string
  ): BenchmarkComparison => {
    const actualValue = actualValues[metric] ?? 0;
    const delta = round(actualValue - referenceValue);
    const deltaPct = referenceValue > 0 ? Math.round((delta / referenceValue) * 100) : 0;
    const status = delta === 0 ? "equal" : delta < 0 ? "below" : "above";

    return {
      metric,
      label:
        metric === "total"
          ? "Totalt"
          : metric === "perM2"
            ? "Per m2"
            : metric === "perPerson"
              ? "Per person"
              : "Per ha",
      referenceLabel,
      actualValue: round(actualValue),
      referenceValue: round(referenceValue),
      delta,
      deltaPct,
      status,
      unit: metric === "perHa" ? "kg CO2e/ha" : "kg CO2e",
      traceKey: `benchmark.${metric}.${referenceLabel === "Normalvärde" ? "normal" : "target"}`
    };
  };

  const vsBenchmark = [
    createComparison("total", benchmarkValues.total, "Normalvärde"),
    createComparison("perM2", benchmarkValues.perM2, "Normalvärde"),
    createComparison("perPerson", benchmarkValues.perPerson, "Normalvärde")
  ];

  const vsTarget = [
    createComparison("total", targetValues.total, "Målvärde"),
    createComparison("perM2", targetValues.perM2, "Målvärde"),
    createComparison("perPerson", targetValues.perPerson, "Målvärde")
  ];

  if (perHaKgCo2e !== undefined && benchmarkValues.perHa !== undefined) {
    vsBenchmark.push(createComparison("perHa", benchmarkValues.perHa, "Normalvärde"));
  }

  if (perHaKgCo2e !== undefined && targetValues.perHa !== undefined) {
    vsTarget.push(createComparison("perHa", targetValues.perHa, "Målvärde"));
  }

  return {
    vsBenchmark,
    vsTarget
  };
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusM = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

function resolveMobilityUse(buildingType: CalculateRequest["buildingType"]) {
  if (buildingType === "smahus" || buildingType === "flerbostadshus") {
    return "residential";
  }

  if (buildingType === "skola") {
    return "education";
  }

  if (buildingType === "handel") {
    return "retail";
  }

  return "workplace";
}

function resolveUrbanContext(
  request: CalculateRequest,
  accessibilityBand: MobilityInputs["accessibilityBand"]
): NonNullable<CalculateRequest["urbanContext"]> {
  const normalized = normalizeUrbanContext(request.urbanContext);
  if (normalized) {
    return normalized;
  }

  if (accessibilityBand === "high") {
    return "stockholm_innerstad";
  }

  if (accessibilityBand === "medium") {
    return "central_storstad";
  }

  return "suburban";
}

function resolveGroundCondition(
  request: CalculateRequest
): NonNullable<CalculateRequest["groundCondition"]> {
  return request.groundCondition ?? "normal_mark";
}

function inferFoundationTypeFromGround(
  groundCondition: NonNullable<CalculateRequest["groundCondition"]>,
  parkingStructureType: NonNullable<CalculateRequest["parkingStructureType"]>
): NonNullable<CalculateRequest["foundationType"]> {
  if (parkingStructureType === "garage_under_mark") {
    return "kallare";
  }

  if (groundCondition === "berg_fastmark") {
    return "kantbalk";
  }

  if (groundCondition === "lera_mjuk" || groundCondition === "gyttja_mjuk" || groundCondition === "fyllning_osaker") {
    return "palar";
  }

  return "platta_pa_mark";
}

function resolveFoundationType(request: CalculateRequest): NonNullable<CalculateRequest["foundationType"]> {
  if (request.foundationType) {
    return request.foundationType;
  }

  const groundCondition = resolveGroundCondition(request);
  const parkingStructureType = resolveParkingStructureType(request);
  return inferFoundationTypeFromGround(groundCondition, parkingStructureType);
}

function resolveBasementFloors(
  request: CalculateRequest,
  foundationType: NonNullable<CalculateRequest["foundationType"]>,
  parkingStructureType: NonNullable<CalculateRequest["parkingStructureType"]>
) {
  if (foundationType !== "kallare") {
    return 0;
  }

  if (request.basementFloors !== undefined) {
    return request.basementFloors;
  }

  if (parkingStructureType === "garage_under_mark") {
    return Math.max(1, request.parkingGarageFloors ?? 1);
  }

  return 1;
}

function resolveParkingStructureType(
  request: CalculateRequest
): NonNullable<CalculateRequest["parkingStructureType"]> {
  return request.parkingStructureType ?? "none";
}

function resolveTransitInputsFromSiteLocation(
  siteLocation: NonNullable<CalculateRequest["siteLocation"]>,
  mobilityReference: MobilityReferenceRecord
) {
  const nearestTransit = mobilityReference.transitNodes.reduce<{
    distance: number;
    departuresPerHour: number;
    type: "rail" | "transit";
  } | null>((nearest, node) => {
    const distance = distanceMeters(siteLocation.lat, siteLocation.lon, node.lat, node.lon);
    if (!nearest || distance < nearest.distance) {
      return {
        distance,
        departuresPerHour: node.departuresPerHour,
        type: node.type
      };
    }
    return nearest;
  }, null);

  const nearestRail = mobilityReference.transitNodes
    .filter((node) => node.type === "rail")
    .reduce<number | null>((nearest, node) => {
      const distance = distanceMeters(siteLocation.lat, siteLocation.lon, node.lat, node.lon);
      return nearest === null || distance < nearest ? distance : nearest;
    }, null);

  return {
    distanceToTransitStopM: nearestTransit ? round(nearestTransit.distance) : undefined,
    distanceToRailStationM: nearestRail !== null ? round(nearestRail) : undefined,
    departuresPerHour: nearestTransit?.departuresPerHour
  };
}

function resolveMobilityInputs(
  request: CalculateRequest,
  mobilityReference: MobilityReferenceRecord
): MobilityInputs {
  const overrides = request.transitOverrides;
  const siteLocation = request.siteLocation;
  const siteTransitInputs = siteLocation
    ? resolveTransitInputsFromSiteLocation(siteLocation, mobilityReference)
    : undefined;
  const hasTransitOverrides =
    overrides?.distanceToTransitStopM !== undefined ||
    overrides?.distanceToRailStationM !== undefined ||
    overrides?.departuresPerHour !== undefined;

  if (hasTransitOverrides) {
    const distanceToTransitStopM =
      overrides?.distanceToTransitStopM ?? siteTransitInputs?.distanceToTransitStopM;
    const distanceToRailStationM =
      overrides?.distanceToRailStationM ?? siteTransitInputs?.distanceToRailStationM;
    const departuresPerHour = overrides?.departuresPerHour ?? siteTransitInputs?.departuresPerHour;
    const accessibilityBand = determineAccessibilityBand(
      distanceToTransitStopM,
      distanceToRailStationM,
      departuresPerHour,
      mobilityReference
    );

    return {
      accessibilityBand,
      urbanContext: resolveUrbanContext(request, accessibilityBand),
      distanceToTransitStopM,
      distanceToRailStationM,
      departuresPerHour,
      distanceToServiceM: request.distanceToServiceM,
      source: "override"
    };
  }

  if (siteTransitInputs) {
    const accessibilityBand = determineAccessibilityBand(
      siteTransitInputs.distanceToTransitStopM,
      siteTransitInputs.distanceToRailStationM,
      siteTransitInputs.departuresPerHour,
      mobilityReference
    );

    return {
      accessibilityBand,
      urbanContext: resolveUrbanContext(request, accessibilityBand),
      distanceToTransitStopM: siteTransitInputs.distanceToTransitStopM,
      distanceToRailStationM: siteTransitInputs.distanceToRailStationM,
      departuresPerHour: siteTransitInputs.departuresPerHour,
      distanceToServiceM: request.distanceToServiceM,
      source: "siteLocation"
    };
  }

  return {
    accessibilityBand: "medium",
    urbanContext: resolveUrbanContext(request, "medium"),
    distanceToServiceM: request.distanceToServiceM,
    source: "default"
  };
}

function determineAccessibilityBand(
  distanceToTransitStopM: number | undefined,
  distanceToRailStationM: number | undefined,
  departuresPerHour: number | undefined,
  mobilityReference: MobilityReferenceRecord
): "high" | "medium" | "low" {
  const high = mobilityReference.accessibilityBands.high;
  const medium = mobilityReference.accessibilityBands.medium;
  const hasAnyKnownValue =
    distanceToTransitStopM !== undefined ||
    distanceToRailStationM !== undefined ||
    departuresPerHour !== undefined;

  if (!hasAnyKnownValue) {
    return "medium";
  }

  if (
    (distanceToTransitStopM === undefined || distanceToTransitStopM <= high.maxTransitStopM) &&
    (distanceToRailStationM === undefined || distanceToRailStationM <= high.maxRailStationM) &&
    (departuresPerHour === undefined || departuresPerHour >= high.minDeparturesPerHour)
  ) {
    return "high";
  }

  if (
    (distanceToTransitStopM === undefined || distanceToTransitStopM <= medium.maxTransitStopM) &&
    (distanceToRailStationM === undefined || distanceToRailStationM <= medium.maxRailStationM) &&
    (departuresPerHour === undefined || departuresPerHour >= medium.minDeparturesPerHour)
  ) {
    return "medium";
  }

  return "low";
}

function resolveServiceDistanceShift(distanceToServiceM: number | undefined) {
  if (distanceToServiceM === undefined) {
    return 0;
  }

  if (distanceToServiceM <= 200) {
    return -0.035;
  }

  if (distanceToServiceM <= 500) {
    return -0.022;
  }

  if (distanceToServiceM <= 1000) {
    return -0.012;
  }

  if (distanceToServiceM <= 2000) {
    return -0.005;
  }

  return 0;
}

function calculateMobility(
  request: CalculateRequest,
  population: PopulationEstimate,
  mobilityReference: MobilityReferenceRecord,
  resolver: ReturnType<typeof buildMethodResolver>
) {
  const inputs = resolveMobilityInputs(request, mobilityReference);
  const useType = resolveMobilityUse(request.buildingType);
  const baseProfile = {
    ...mobilityReference.modeShareProfiles[useType][inputs.accessibilityBand]
  };
  const people = population.totalPeople;
  const parkingIntensity =
    people > 0 ? (request.parkingSpaces ?? 0) / Math.max(1, people) : 0;
  const centralityShift =
    inputs.urbanContext === "stockholm_innerstad"
      ? -0.12
      : inputs.urbanContext === "central_storstad"
        ? -0.07
        : inputs.urbanContext === "urban"
          ? -0.03
          : 0.05;
  const accessibilityShift =
    inputs.accessibilityBand === "high"
      ? -0.05
      : inputs.accessibilityBand === "medium"
        ? 0
        : 0.06;
  const serviceShift = resolveServiceDistanceShift(inputs.distanceToServiceM);
  const parkingShift = clamp(
    parkingIntensity * mobilityReference.parkingCarShareAdjustmentPerSpacePerPerson * 2.5,
    0,
    0.18
  );
  const garageShift =
    resolveParkingStructureType(request) === "garage_under_mark"
      ? 0.03
      : resolveParkingStructureType(request) === "garage_ovan_mark"
        ? 0.015
        : 0;
  const carShift = Math.min(
    0.18,
    Math.max(-0.14, parkingShift + centralityShift + accessibilityShift + garageShift + serviceShift)
  );
  const adjustedCar = clamp(baseProfile.car + carShift, 0, 0.92);
  const transferable = baseProfile.transit + baseProfile.walkCycle;
  const reduction = adjustedCar - baseProfile.car;
  const adjustedTransit =
    transferable > 0
      ? clamp(baseProfile.transit - (reduction * (baseProfile.transit / transferable)), 0, 1)
      : baseProfile.transit;
  const adjustedWalkCycle =
    transferable > 0
      ? clamp(baseProfile.walkCycle - (reduction * (baseProfile.walkCycle / transferable)), 0, 1)
      : baseProfile.walkCycle;
  const normalization = adjustedCar + adjustedTransit + adjustedWalkCycle || 1;
  const normalizedProfile = {
    transit: adjustedTransit / normalization,
    car: adjustedCar / normalization,
    walkCycle: adjustedWalkCycle / normalization
  };
  const annualTripsPerPerson = mobilityReference.annualTripsPerPersonByUse[useType];
  const annualTrips = annualTripsPerPerson * people;
  const serviceTrips = annualTrips * mobilityReference.serviceTripShareByUse[useType];

  const annualTransitKg =
    annualTrips *
    normalizedProfile.transit *
    mobilityReference.avgTripLengthKmByMode.transit *
    mobilityReference.emissionFactorsKgCo2ePerPkm.transit;
  const annualCarKg =
    annualTrips *
    normalizedProfile.car *
    mobilityReference.avgTripLengthKmByMode.car *
    mobilityReference.emissionFactorsKgCo2ePerPkm.car;
  const annualWalkCycleKg =
    annualTrips *
    normalizedProfile.walkCycle *
    mobilityReference.avgTripLengthKmByMode.walkCycle *
    mobilityReference.emissionFactorsKgCo2ePerPkm.walkCycle;
  const annualServiceKg =
    serviceTrips *
    mobilityReference.avgTripLengthKmByMode.serviceTrips *
    mobilityReference.emissionFactorsKgCo2ePerPkm.serviceTrips;

  const annualTotal = round(annualTransitKg + annualCarKg + annualWalkCycleKg + annualServiceKg);
  const breakdown: BreakdownItem[] = [
    {
      key: "transit",
      label: "Kollektivtrafikresor",
      valueKgCo2e: round(annualTransitKg),
      unit: "kgCO2e",
      note: `${Math.round(normalizedProfile.transit * 100)} % av resprofilen`,
      traceKey: "mobility.transit"
    },
    {
      key: "car",
      label: "Bilresor",
      valueKgCo2e: round(annualCarKg),
      unit: "kgCO2e",
      note: `${Math.round(normalizedProfile.car * 100)} % av resprofilen • ${labelUrbanContext(inputs.urbanContext).toLowerCase()}t läge`,
      traceKey: "mobility.car"
    },
    {
      key: "walkCycle",
      label: "Gang och cykel",
      valueKgCo2e: round(annualWalkCycleKg),
      unit: "kgCO2e",
      note: `${Math.round(normalizedProfile.walkCycle * 100)} % av resprofilen`,
      traceKey: "mobility.walkCycle"
    },
    {
      key: "serviceTrips",
      label: "Service- och besoksresor",
      valueKgCo2e: round(annualServiceKg),
      unit: "kgCO2e",
      note: `${Math.round(mobilityReference.serviceTripShareByUse[useType] * 100)} % tillagg over personresor`,
      traceKey: "mobility.serviceTrips"
    }
  ];

  const defaultsApplied = [
    inputs.source === "default"
      ? "Mobilitetsprofil defaultades till medium tillgänglighet eftersom koordinat eller transitavstånd saknas."
      : null,
    inputs.source === "override" &&
    request.transitOverrides &&
    (request.transitOverrides.distanceToTransitStopM === undefined ||
      request.transitOverrides.distanceToRailStationM === undefined ||
      request.transitOverrides.departuresPerHour === undefined)
      ? "Partiella transitöverskrivningar kompletterades med platsdata i stället för att falla tillbaka till extremvärden."
      : null,
    request.urbanContext === undefined
      ? `Lägesprofil defaultades till ${labelUrbanContext(inputs.urbanContext).toLowerCase()} utifrån tillgänglighetsband.`
      : null
  ].filter((value): value is string => Boolean(value));

  const explanations = [
    explanation(
      "explanation-mobility-total",
      "mobility.total",
      "Mobilitetslivscykel",
      "Mobiliteten använder en försiktig resvaneproxy baserad på kollektivtrafiktillgänglighet, servicenärhet, lägesprofil, byggnadstyp, personunderlag och parkeringstal.",
      "personunderlag x resprofil x reseavstand x utslappsfaktorer",
      [
        `${people} personer x ${annualTripsPerPerson} resor/person,år i profilen ${inputs.accessibilityBand}`,
        `= ${annualTotal} kg CO2e/år`,
        `${annualTotal} kg CO2e/år x ${BUILDING_LIFETIME_YEARS} år = ${round(annualTotal * BUILDING_LIFETIME_YEARS)} kg CO2e`
      ],
      [
        {
          key: "accessibilityBand",
          label: "Tillgänglighetsband",
          value: inputs.accessibilityBand,
          source: inputs.source === "default" ? "default" : "derived"
        },
        {
          key: "urbanContext",
          label: "Lägesprofil",
          value: labelUrbanContext(inputs.urbanContext),
          source: request.urbanContext !== undefined ? "user" : "derived"
        },
        {
          key: "population",
          label: "Personunderlag",
          value: String(people),
          source: population.source === "user" ? "user" : "derived"
        },
        {
          key: "parkingSpaces",
          label: "Parkeringsplatser",
          value: String(request.parkingSpaces ?? 0),
          source: request.parkingSpaces !== undefined ? "user" : "default"
        },
        {
          key: "distanceToServiceM",
          label: "Avstånd till service",
          value:
            inputs.distanceToServiceM !== undefined
              ? `${inputs.distanceToServiceM} m`
              : "Ej angivet",
          source: request.distanceToServiceM !== undefined ? "user" : "default"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor([
        "method-mobility-accessibility",
        "method-mobility-gtfs",
        "method-mobility-stockholm",
        "method-mobility-centrality"
      ]),
      [
        "Mobilitetsdelen ar en konservativ plats- och tillganglighetsproxy, inte en individuell reseprognos.",
        "GTFS-data ar representerade via versionsstyrd referensprofil i stallet for live-anrop i runtime.",
        `Lägesprofil ${labelUrbanContext(inputs.urbanContext).toLowerCase()} användes för att minska bilanvändning i centrala lägen.`
      ]
    ),
    explanation(
      "explanation-mobility-transit",
      "mobility.transit",
      "Kollektivtrafikresor",
      "Kollektivtrafikandelen beror på tillgänglighetsband, restider och kalibrerad resprofil för byggnadens användning.",
      "antal resor x kollektivtrafikandel x reseavstand x utslappsfaktor",
      [
        `${Math.round(annualTrips)} resor/år x ${Math.round(normalizedProfile.transit * 100)} % x ${mobilityReference.avgTripLengthKmByMode.transit} km`,
        `= ${round(annualTransitKg)} kg CO2e/år`
      ],
      [
        {
          key: "distanceToTransitStopM",
          label: "Avstånd till hållplats",
          value:
            inputs.distanceToTransitStopM !== undefined
              ? `${inputs.distanceToTransitStopM} m`
              : "Ej angivet",
          source: inputs.distanceToTransitStopM !== undefined ? "derived" : "default"
        },
        {
          key: "departuresPerHour",
          label: "Avgångar per timme",
          value: String(inputs.departuresPerHour ?? 0),
          source: inputs.departuresPerHour !== undefined ? "derived" : "default"
        },
        {
          key: "distanceToServiceM",
          label: "Avstånd till service",
          value:
            inputs.distanceToServiceM !== undefined
              ? `${inputs.distanceToServiceM} m`
              : "Ej angivet",
          source: request.distanceToServiceM !== undefined ? "user" : "default"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor([
        "method-mobility-accessibility",
        "method-mobility-gtfs",
        "method-mobility-stockholm"
      ]),
      ["Resprofilen ar en bandad proxy och ska tolkas som screening for scenariojamforelse."]
    ),
    explanation(
      "explanation-mobility-car",
      "mobility.car",
      "Bilresor",
      "Bilandelen justeras uppåt när parkeringstalet är högt eller läget är mer bilorienterat, och nedåt i innerstadsläge, stark kollektivtrafik och när service ligger nära.",
      "antal resor x bilandel x reseavstand x utslappsfaktor",
      [
        `${Math.round(annualTrips)} resor/år x ${Math.round(normalizedProfile.car * 100)} % x ${mobilityReference.avgTripLengthKmByMode.car} km`,
        `= ${round(annualCarKg)} kg CO2e/år`
      ],
      [
        {
          key: "parkingIntensity",
          label: "Parkeringstal per person",
          value: people > 0 ? parkingIntensity.toFixed(2) : "0.00",
          source: "derived"
        },
        {
          key: "urbanContext",
          label: "Lägesprofil",
          value: labelUrbanContext(inputs.urbanContext),
          source: request.urbanContext !== undefined ? "user" : "derived"
        },
        {
          key: "parkingStructureType",
          label: "Parkeringslösning",
          value: LABELS.parkingStructureType[resolveParkingStructureType(request)],
          source: request.parkingStructureType !== undefined ? "user" : "default"
        },
        {
          key: "distanceToServiceM",
          label: "Avstånd till service",
          value:
            inputs.distanceToServiceM !== undefined
              ? `${inputs.distanceToServiceM} m`
              : "Ej angivet",
          source: request.distanceToServiceM !== undefined ? "user" : "default"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor([
        "method-mobility-accessibility",
        "method-mobility-stockholm",
        "method-mobility-centrality"
      ]),
      ["Parkeringens effekt ar en schabloniserad sensitivitet och inte en trafikmodell."]
    ),
    explanation(
      "explanation-mobility-walk-cycle",
      "mobility.walkCycle",
      "Gang och cykel",
      "Gang- och cykelandelen används för att hålla resprofilen realistisk när kollektivtrafiktillgänglighet och närhetsläge är starka.",
      "antal resor x gang/cykelandel x reseavstand x utslappsfaktor",
      [
        `${Math.round(annualTrips)} resor/år x ${Math.round(normalizedProfile.walkCycle * 100)} % x ${mobilityReference.avgTripLengthKmByMode.walkCycle} km`,
        `= ${round(annualWalkCycleKg)} kg CO2e/år`
      ],
      [
        {
          key: "accessibilityBand",
          label: "Tillgänglighetsband",
          value: inputs.accessibilityBand,
          source: inputs.source === "default" ? "default" : "derived"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor([
        "method-mobility-accessibility",
        "method-mobility-stockholm"
      ]),
      ["Mycket låga utsläpp här ska läsas som relativ skillnad mellan scenarier, inte exakt nollutsläpp."]
    ),
    explanation(
      "explanation-mobility-service-trips",
      "mobility.serviceTrips",
      "Service- och besoksresor",
      "Service- och besöksresor läggs ovanpå personresorna som en liten extra plats- och användningsberoende post.",
      "antal resor x tillaggsandel x reseavstand x utslappsfaktor",
      [
        `${Math.round(serviceTrips)} tillaggsresor/år x ${mobilityReference.avgTripLengthKmByMode.serviceTrips} km`,
        `= ${round(annualServiceKg)} kg CO2e/år`
      ],
      [
        {
          key: "serviceTripShare",
          label: "Tilläggsandel",
          value: `${Math.round(mobilityReference.serviceTripShareByUse[useType] * 100)} %`,
          source: "reference"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor([
        "method-mobility-accessibility",
        "method-mobility-stockholm",
        "method-mobility-centrality"
      ]),
      [
        "Posten ar en forenklad proxy for service- och besoksfloden i tidigt skede.",
        `Lägesprofil ${labelUrbanContext(inputs.urbanContext).toLowerCase()} användes för att justera bilanvändning i linje med centralitetsforskning.`
      ]
    )
  ];

  return {
    result: {
      annualKgCo2e: annualTotal,
      lifetimeKgCo2e: round(annualTotal * BUILDING_LIFETIME_YEARS),
      breakdown: withShares(breakdown, annualTotal),
      inputs
    } satisfies MobilityResult,
    explanations
  };
}

interface CoreCalculation {
  area: number;
  siteAreaM2?: number;
  population: PopulationEstimate;
  embodiedRawItems: BreakdownItem[];
  operationalRawItems: BreakdownItem[];
  embodiedTotal: number;
  annualOperationalTotal: number;
  lifetimeOperationalTotal: number;
  assumptions: AssumptionEntry[];
  explanations: CalculationExplanation[];
  defaultsApplied: string[];
}

function calculateCoreCase(
  request: CalculateRequest,
  resolver: ReturnType<typeof buildMethodResolver>,
  options?: {
    benchmarkProfile?: BenchmarkProfile;
  }
): CoreCalculation {
  const referenceData = getReferenceData();
  const typology = referenceData.typologies[request.buildingType];
  const energyBenchmark = referenceData.energyBenchmarks[request.buildingType];
  const emissions = referenceData.emissions;
  const heatingProfile = emissions.heatingProfiles[request.heatingType];
  const overriddenHeatingFactor =
    options?.benchmarkProfile?.heatingFactorOverrides?.[request.heatingType] ??
    heatingProfile.heatingFactorKgCo2ePerKwh;

  const area = request.grossFloorAreaM2;
  const floorsAboveGround =
    request.floorsAboveGround ?? emissions.defaultFloors[request.buildingType];
  const buildingFootprintM2 =
    request.buildingFootprintM2 ?? area / Math.max(1, floorsAboveGround);
  const glazingRatioPct =
    request.glazingRatioPct ?? emissions.defaultGlazingRatioPct[request.buildingType];
  const buildingForm = request.buildingForm ?? "normal";
  const parkingSpaces = request.parkingSpaces ?? 0;
  const landType = request.landType ?? "tidigare_bebyggd";
  const groundCondition = resolveGroundCondition(request);
  const parkingStructureType = resolveParkingStructureType(request);
  const foundationType = resolveFoundationType(request);
  const basementFloors = resolveBasementFloors(request, foundationType, parkingStructureType);
  const parkingGarageFloors =
    parkingStructureType === "none" ? 0 : request.parkingGarageFloors ?? 1;
  const siteAreaM2 = request.siteAreaM2;

  const defaultsApplied = [
    request.floorsAboveGround === undefined
      ? `Våningsantal defaultades till ${floorsAboveGround} för ${LABELS.buildingType[request.buildingType].toLowerCase()}.`
      : null,
    request.buildingFootprintM2 === undefined
      ? `Byggnadsfotavtryck härleddes till ${buildingFootprintM2.toFixed(0)} m2 från bruttoarea och våningar.`
      : null,
    request.glazingRatioPct === undefined
      ? `Glasandel defaultades till ${glazingRatioPct} % för vald byggnadstyp.`
      : null,
    request.buildingForm === undefined
      ? `Byggnadsformen defaultades till ${LABELS.buildingForm[buildingForm].toLowerCase()} för en typisk screeningprofil.`
      : null,
    request.groundCondition === undefined
      ? `Markförhållandet defaultades till ${LABELS.groundCondition[groundCondition].toLowerCase()}.`
      : null,
    request.foundationType === undefined
      ? `Grundläggning defaultades till ${LABELS.foundationType[foundationType].toLowerCase()} utifrån ${
          parkingStructureType === "garage_under_mark"
            ? "garage under mark"
            : `markförhållanden (${LABELS.groundCondition[groundCondition].toLowerCase()})`
        }.`
      : null,
    foundationType === "kallare" && request.basementFloors === undefined
      ? `Källarvåningar defaultades till ${basementFloors}.`
      : null,
    request.parkingStructureType === undefined
      ? "Parkeringslösning defaultades till inget garage."
      : null,
    parkingStructureType !== "none" && request.parkingGarageFloors === undefined
      ? `Garagevåningar defaultades till ${parkingGarageFloors}.`
      : null,
    request.landType === undefined
      ? `Marktyp defaultades till ${LABELS.landType[landType].toLowerCase()}.`
      : null
  ].filter((value): value is string => Boolean(value));

  const population = estimatePopulation(request, options?.benchmarkProfile);
  const frameVolume = area * typology.frameVolumeM3PerM2[request.frameMaterial];
  const frameFactor = emissions.materialFactorsKgCo2ePerM3[request.frameMaterial];
  const baseFoundationPerFootprint =
    typology.supplementaryKgCo2ePerM2.foundation * floorsAboveGround;
  const foundationMultiplier = emissions.foundationMultipliers[foundationType];
  const foundationGroundMultiplier = emissions.foundationGroundMultipliers[groundCondition] ?? 1;
  const foundationDepthMultiplier =
    foundationType === "kallare" ? 1 + Math.max(0, basementFloors - 1) * 0.3 : 1;
  const foundationKgCo2e = round(
    buildingFootprintM2 *
      baseFoundationPerFootprint *
      foundationMultiplier *
      foundationGroundMultiplier *
      foundationDepthMultiplier
  );
  const parkingStructureBaseMultiplier =
    emissions.parkingStructureMultipliers[parkingStructureType] ?? 1;
  const parkingStructureFloorStepMultiplier =
    emissions.parkingStructureFloorStepMultipliers[parkingStructureType] ?? 0;
  const parkingStructureMultiplier =
    parkingStructureType === "none"
      ? 1
      : parkingStructureBaseMultiplier *
        (1 + Math.max(0, parkingGarageFloors - 1) * parkingStructureFloorStepMultiplier);
  const landKgCo2e =
    siteAreaM2 !== undefined
      ? round(siteAreaM2 * emissions.landUseFactorsKgCo2ePerM2[landType])
      : 0;
  const parkingKgCo2e =
    parkingSpaces > 0
      ? round(parkingSpaces * emissions.parkingKgCo2ePerSpace * parkingStructureMultiplier)
      : 0;

  const embodiedRawItems: BreakdownItem[] = [
    {
      key: "frame",
      label: `Stomme (${LABELS.frameMaterial[request.frameMaterial]})`,
      valueKgCo2e: round(frameVolume * frameFactor),
      unit: "kgCO2e",
      note: `${typology.frameVolumeM3PerM2[request.frameMaterial]} m3/m2`,
      traceKey: "embodied.frame"
    },
    {
      key: "foundation",
      label: `Grundläggning (${LABELS.foundationType[foundationType]})`,
      valueKgCo2e: foundationKgCo2e,
      unit: "kgCO2e",
      note: `${round(buildingFootprintM2)} m2 fotavtryck • ${LABELS.groundCondition[groundCondition]}`,
      traceKey: "site.foundation"
    },
    {
      key: "envelope",
      label: `Klimatskal (${glazingRatioPct}% glas)`,
      valueKgCo2e: round(area * typology.supplementaryKgCo2ePerM2.envelope),
      unit: "kgCO2e",
      traceKey: "embodied.envelope"
    },
    {
      key: "installations",
      label: "Installationer och interiörer",
      valueKgCo2e: round(area * typology.supplementaryKgCo2ePerM2.installations),
      unit: "kgCO2e",
      traceKey: "embodied.installations"
    }
  ];

  if (siteAreaM2 !== undefined) {
    embodiedRawItems.push({
      key: "land",
      label: `Markeffekt (${LABELS.landType[landType]})`,
      valueKgCo2e: landKgCo2e,
      unit: "kgCO2e",
      note: `${round(siteAreaM2)} m2 platsyta`,
      traceKey: "site.land"
    });
  }

  if (parkingSpaces > 0) {
    embodiedRawItems.push({
      key: "parking",
      label:
        parkingStructureType === "none"
          ? "Parkering och mobilitetsyta"
          : `Parkering (${LABELS.parkingStructureType[parkingStructureType]}, ${parkingGarageFloors} vån)`,
      valueKgCo2e: parkingKgCo2e,
      unit: "kgCO2e",
      note:
        parkingStructureType === "none"
          ? `${round(parkingSpaces)} parkeringsplatser`
          : `${round(parkingSpaces)} parkeringsplatser • ${parkingGarageFloors} garagevåningar`,
      traceKey: "site.parking"
    });
  }

  const embodiedTotal = embodiedRawItems.reduce((sum, item) => sum + item.valueKgCo2e, 0);
  const baseSpecificEnergy =
    request.specificEnergyUseKwhM2Year ??
    energyBenchmark.standards[request.energyStandard];
  const uValueAdjustment = getUValueAdjustment(request, emissions.baselineUValues);
  const formFactorMultiplier =
    buildingForm === "kompakt" ? 0.95 : buildingForm === "fragmenterad" ? 1.06 : 1;
  const glazingAdjustment =
    request.specificEnergyUseKwhM2Year === undefined
      ? 1 + (glazingRatioPct - emissions.defaultGlazingRatioPct[request.buildingType]) / 250
      : 1;
  const adjustedSpecificEnergy =
    baseSpecificEnergy * uValueAdjustment.multiplier * glazingAdjustment * formFactorMultiplier;
  const annualEnergyUseKwh = adjustedSpecificEnergy * area;
  const annualHeatingEnergyKwh = annualEnergyUseKwh * (heatingProfile.heatingSharePct / 100);
  const annualElectricityKwh = annualEnergyUseKwh - annualHeatingEnergyKwh;
  const annualHeatingKg = annualHeatingEnergyKwh * overriddenHeatingFactor;
  const annualElectricityKg =
    annualElectricityKwh * heatingProfile.electricityFactorKgCo2ePerKwh;
  const annualOperationalTotal = round(annualHeatingKg + annualElectricityKg);
  const lifetimeOperationalTotal = round(annualOperationalTotal * BUILDING_LIFETIME_YEARS);

  const operationalRawItems: BreakdownItem[] = [
    {
      key: "heating",
      label: `Uppvärmning (${LABELS.heatingType[request.heatingType]})`,
      valueKgCo2e: round(annualHeatingKg),
      unit: "kgCO2e",
      note: `${Math.round(annualHeatingEnergyKwh)} kWh/år`,
      traceKey: "operational.heating"
    },
    {
      key: "electricity",
      label: "Fastighetsel",
      valueKgCo2e: round(annualElectricityKg),
      unit: "kgCO2e",
      note: `${Math.round(annualElectricityKwh)} kWh/år`,
      traceKey: "operational.electricity"
    }
  ];

  const assumptions: AssumptionEntry[] = [
    {
      label: "Stockholmsprofil",
      value: STOCKHOLM_PROFILE_NAME
    },
    {
      label: "Byggnadslivslängd",
      value: `${BUILDING_LIFETIME_YEARS} år`
    },
    {
      label: "Energibehov",
      value: `${adjustedSpecificEnergy.toFixed(1)} kWh/m2,år`
    },
    {
      label: "Energikälla",
      value: LABELS.heatingType[request.heatingType]
    },
    {
      label: "Personunderlag",
      value:
        population.source === "user"
          ? `${population.totalPeople} personer från användarinmatning`
          : `${population.totalPeople} personer uppskattat från area och byggnadstyp`
    },
    {
      label: "Beräkningskälla för energi",
      value: request.specificEnergyUseKwhM2Year
        ? "Användarens specifika energianvändning"
        : `${energyBenchmark.displayName}, ${LABELS.energyStandard[request.energyStandard]}`
    },
    {
      label: "U-värdesjustering",
      value: uValueAdjustment.note
    },
    {
      label: "Byggnadsform",
      value: `${LABELS.buildingForm[buildingForm]} • ${Math.round(formFactorMultiplier * 100)} % av basenergibehovet`
    },
    {
      label: "Osäkerhetsintervall",
      value: `±${DEFAULT_UNCERTAINTY_RANGE_PCT} %`
    }
  ];

  const explanations: CalculationExplanation[] = [
    explanation(
      "explanation-embodied-frame",
      "embodied.frame",
      "Stomme",
      "Embodied klimatpåverkan för stomme räknas från byggnadstypens materialintensitet multiplicerat med vald stomfaktor.",
      "bruttoarea x stomvolym per m2 x materialfaktor",
      [
        `${area} m2 x ${typology.frameVolumeM3PerM2[request.frameMaterial]} m3/m2 x ${frameFactor} kg CO2e/m3`,
        `= ${round(frameVolume * frameFactor)} kg CO2e`
      ],
      [
        { key: "grossFloorAreaM2", label: "Bruttoarea", value: `${area} m2`, source: "user" },
        {
          key: "frameMaterial",
          label: "Stommaterial",
          value: LABELS.frameMaterial[request.frameMaterial],
          source: "user"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor(["method-embodied-standard"]),
      ["Tidigt skede med typologibaserad schablon, inte produktspecifik EPD."]
    ),
    explanation(
      "explanation-site-foundation",
      "site.foundation",
      "Grundläggning",
      "Grundläggning räknas från härlett eller angivet fotavtryck och justeras med vald grundläggningstyp samt markförhållanden.",
      "byggnadsfotavtryck x grundfaktor per m2 fotavtryck x multiplikator för grundläggning x markfaktor",
      [
        `${round(buildingFootprintM2)} m2 x ${round(baseFoundationPerFootprint)} kg CO2e/m2 x ${foundationMultiplier.toFixed(2)} x ${foundationGroundMultiplier.toFixed(2)} x ${foundationDepthMultiplier.toFixed(2)}`,
        `= ${foundationKgCo2e} kg CO2e`
      ],
      [
        {
          key: "buildingFootprintM2",
          label: "Byggnadsfotavtryck",
          value: `${round(buildingFootprintM2)} m2`,
          source: request.buildingFootprintM2 !== undefined ? "user" : "derived"
        },
        {
          key: "foundationType",
          label: "Grundläggningstyp",
          value: LABELS.foundationType[foundationType],
          source: request.foundationType !== undefined ? "user" : "derived"
        },
        {
          key: "groundCondition",
          label: "Markförhållande",
          value: LABELS.groundCondition[groundCondition],
          source: request.groundCondition !== undefined ? "user" : "default"
        },
        {
          key: "basementFloors",
          label: "Källarvåningar",
          value: foundationType === "kallare" ? String(basementFloors) : "0",
          source:
            foundationType === "kallare"
              ? request.basementFloors !== undefined
                ? "user"
                : "default"
              : "default"
        },
        {
          key: "parkingStructureType",
          label: "Parkeringslösning",
          value: LABELS.parkingStructureType[parkingStructureType],
          source: request.parkingStructureType !== undefined ? "user" : "default"
        },
        {
          key: "parkingGarageFloors",
          label: "Garagevåningar",
          value:
            parkingStructureType === "none"
              ? "0"
              : String(parkingGarageFloors),
          source:
            parkingStructureType === "none" || request.parkingGarageFloors !== undefined
              ? "user"
              : "default"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor([
        "method-foundation-soil-proxy",
        "method-foundation-proxy",
        "method-embodied-standard"
      ]),
      [
        "Proxy för screening i tidigt skede.",
        parkingStructureType === "garage_under_mark"
          ? "Garage under mark ger en källarlik underbyggnad som ofta ökar grundläggningens klimatpåverkan."
          : "Mjuka jordar som lera och gyttja kan driva upp behovet av pålning och annan markförstärkning.",
        "Ersätter inte geoteknisk eller konstruktiv dimensionering."
      ]
    ),
    explanation(
      "explanation-embodied-envelope",
      "embodied.envelope",
      "Klimatskal",
      "Klimatskalets embodied klimatpåverkan räknas som en schablon per m2 bruttoarea för vald byggnadstyp.",
      "bruttoarea x klimatskalsfaktor per m2",
      [
        `${area} m2 x ${typology.supplementaryKgCo2ePerM2.envelope} kg CO2e/m2 = ${round(area * typology.supplementaryKgCo2ePerM2.envelope)} kg CO2e`
      ],
      [
        { key: "grossFloorAreaM2", label: "Bruttoarea", value: `${area} m2`, source: "user" },
        {
          key: "glazingRatioPct",
          label: "Glasandel",
          value: `${glazingRatioPct} %`,
          source: request.glazingRatioPct !== undefined ? "user" : "default"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor(["method-embodied-standard"]),
      ["Schablonpost som inte särskiljer fönstertyper eller materialuppbyggnad i detalj."]
    ),
    explanation(
      "explanation-embodied-installations",
      "embodied.installations",
      "Installationer och interiörer",
      "Installationer och interiörer räknas med en typologibaserad schablon per m2 bruttoarea.",
      "bruttoarea x installationsfaktor per m2",
      [
        `${area} m2 x ${typology.supplementaryKgCo2ePerM2.installations} kg CO2e/m2 = ${round(area * typology.supplementaryKgCo2ePerM2.installations)} kg CO2e`
      ],
      [{ key: "grossFloorAreaM2", label: "Bruttoarea", value: `${area} m2`, source: "user" }],
      defaultsApplied,
      resolver.evidenceFor(["method-embodied-standard"]),
      ["Typologipost för tidig screening, inte detaljspecifikation av installationer."]
    ),
    explanation(
      "explanation-operational-heating",
      "operational.heating",
      "Uppvärmning",
      request.specificEnergyUseKwhM2Year
        ? "Uppvärmningsposten använder användarens specifika energianvändning och lokal emissionsfaktor för vald uppvärmning."
        : "Uppvärmningsposten använder typologibaserad energischablon, U-värdesjustering och glasjustering innan lokal emissionsfaktor appliceras.",
      "justerat energibehov x värmeandel x emissionsfaktor för uppvärmning",
      [
        `${adjustedSpecificEnergy.toFixed(1)} kWh/m2,år x ${area} m2 = ${Math.round(annualEnergyUseKwh)} kWh/år`,
        `${Math.round(annualHeatingEnergyKwh)} kWh/år x ${overriddenHeatingFactor.toFixed(3)} kg CO2e/kWh = ${round(annualHeatingKg)} kg CO2e/år`
      ],
      [
        {
          key: "specificEnergyUseKwhM2Year",
          label: "Specifik energianvändning",
          value: `${baseSpecificEnergy.toFixed(1)} kWh/m2,år`,
          source: request.specificEnergyUseKwhM2Year !== undefined ? "user" : "reference"
        },
        {
          key: "buildingForm",
          label: "Byggnadsform",
          value: LABELS.buildingForm[buildingForm],
          source: request.buildingForm !== undefined ? "user" : "default"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor(
        request.heatingType === "fjarrvarme"
          ? request.specificEnergyUseKwhM2Year !== undefined
            ? ["method-local-district-heating", "method-building-shape-proxy"]
            : [
                "method-energy-benchmark",
                "method-ben-normalbruk",
                "method-glazing-adjustment",
                "method-local-district-heating",
                "method-building-shape-proxy"
              ]
          : request.specificEnergyUseKwhM2Year !== undefined
            ? ["method-ben-normalbruk", "method-building-shape-proxy"]
            : [
                "method-energy-benchmark",
                "method-ben-normalbruk",
                "method-glazing-adjustment",
                "method-building-shape-proxy"
              ]
      ),
      [
        request.specificEnergyUseKwhM2Year !== undefined
          ? "Benchmarkschablon användes inte eftersom egen specifik energianvändning angavs."
          : "Schablonenergi används när användaren inte anger egen specifik energianvändning.",
        `Byggnadsform ${LABELS.buildingForm[buildingForm].toLowerCase()} användes som screeningsproxy för formfaktor.`
      ]
    ),
    explanation(
      "explanation-operational-electricity",
      "operational.electricity",
      "Fastighetsel",
      "Fastighetselen räknas som återstående del av det justerade energibehovet efter uppvärmningsandelen.",
      "justerat energibehov x (1 - värmeandel) x elfaktor",
      [
        `${Math.round(annualElectricityKwh)} kWh/år x ${heatingProfile.electricityFactorKgCo2ePerKwh.toFixed(3)} kg CO2e/kWh = ${round(annualElectricityKg)} kg CO2e/år`
      ],
      [
        {
          key: "electricityFactor",
          label: "Elfaktor",
          value: `${heatingProfile.electricityFactorKgCo2ePerKwh.toFixed(3)} kg CO2e/kWh`,
          source: "reference"
        }
      ],
      defaultsApplied,
      resolver.evidenceFor(
        request.specificEnergyUseKwhM2Year !== undefined
          ? ["method-ben-normalbruk"]
          : ["method-energy-benchmark", "method-ben-normalbruk", "method-glazing-adjustment"]
      ),
      ["Elposten är en schablon för fastighetsel och inkluderar inte verksamhetsel eller hushållsel separat."]
    )
  ];

  if (siteAreaM2 !== undefined) {
    explanations.push(
      explanation(
        "explanation-site-land",
        "site.land",
        "Markeffekt",
        "Markeffekten är en schablonpost för planjämförelse som relaterar platsyta och marktyp till ett screeningvärde.",
        "platsyta x schablonfaktor för marktyp",
        [
          `${round(siteAreaM2)} m2 x ${emissions.landUseFactorsKgCo2ePerM2[landType]} kg CO2e/m2 = ${landKgCo2e} kg CO2e`
        ],
        [
          {
            key: "siteAreaM2",
            label: "Platsyta",
            value: `${round(siteAreaM2)} m2`,
            source: "user"
          }
        ],
        defaultsApplied,
        resolver.evidenceFor(["method-land-proxy"]),
        ["Proxy för tidig planering. Avser inte full markkol- eller markberedningsanalys."]
      )
    );
  }

  if (parkingSpaces > 0) {
    const parkingEvidenceMethods =
      parkingStructureType === "none"
        ? ["method-parking-proxy"]
        : ["method-parking-garage-proxy", "method-parking-proxy"];
    explanations.push(
      explanation(
        "explanation-site-parking",
        "site.parking",
        parkingStructureType === "none" ? "Parkering" : "Parkering och garage",
        parkingStructureType === "none"
          ? "Parkeringsposten används som screeningvärde per parkeringsplats för att göra scenariojämförelser mer beslutsrelevanta."
          : "Parkeringsposten justeras för att fånga att garage ofta kräver mycket mer material än enklare markparkering.",
        "antal parkeringsplatser x schablon per plats x garagefaktor",
        [
          parkingStructureType === "none"
            ? `${round(parkingSpaces)} platser x ${emissions.parkingKgCo2ePerSpace} kg CO2e/plats = ${parkingKgCo2e} kg CO2e`
            : `${round(parkingSpaces)} platser x ${emissions.parkingKgCo2ePerSpace} kg CO2e/plats x ${parkingStructureMultiplier.toFixed(2)} = ${parkingKgCo2e} kg CO2e`
        ],
        [
          {
            key: "parkingSpaces",
            label: "Parkeringsplatser",
            value: String(round(parkingSpaces)),
            source: "user"
          },
          {
            key: "parkingStructureType",
            label: "Parkeringslösning",
            value: LABELS.parkingStructureType[parkingStructureType],
            source: request.parkingStructureType !== undefined ? "user" : "default"
          }
        ],
        defaultsApplied,
        resolver.evidenceFor(parkingEvidenceMethods),
        [
          "Screeningpost för kommunal jämförelse, inte kalkyl för exakt anläggningsprojektering.",
          parkingStructureType === "none"
            ? "Markparkering antas när ingen garage- eller underjordslösning anges."
            : `${parkingGarageFloors} garagevåningar användes som proxy för strukturell komplexitet.`,
          foundationType === "kallare"
            ? `${basementFloors} källarvåningar användes för att skala upp grundpåverkan.`
            : "Källarhöjd var inte aktuell i den valda grundtypen."
        ]
      )
    );
  }

  return {
    area,
    siteAreaM2,
    population,
    embodiedRawItems,
    operationalRawItems,
    embodiedTotal,
    annualOperationalTotal,
    lifetimeOperationalTotal,
    assumptions,
    explanations,
    defaultsApplied
  };
}

function buildExistingRequest(request: CalculateRequest): CalculateRequest {
  const interventionType = request.interventionType ?? "nybyggnad";
  const addedArea =
    request.addedGrossFloorAreaM2 ??
    (request.existingBuilding
      ? Math.max(0, request.grossFloorAreaM2 - request.existingBuilding.grossFloorAreaM2)
      : 0);
  const existingArea =
    request.existingBuilding?.grossFloorAreaM2 ??
    (interventionType === "pabyggnad" && addedArea > 0
      ? Math.max(1, request.grossFloorAreaM2 - addedArea)
      : request.grossFloorAreaM2);
  const scale = request.grossFloorAreaM2 > 0 ? existingArea / request.grossFloorAreaM2 : 1;

  const existingBuilding: ExistingBuildingInput = request.existingBuilding ?? {
    grossFloorAreaM2: existingArea,
    buildYear: request.buildYear,
    frameMaterial: request.frameMaterial,
    energyStandard: request.energyStandard,
    specificEnergyUseKwhM2Year: request.specificEnergyUseKwhM2Year
  };

  return {
    ...request,
    grossFloorAreaM2: existingBuilding.grossFloorAreaM2,
    buildYear: existingBuilding.buildYear,
    frameMaterial: existingBuilding.frameMaterial,
    energyStandard: existingBuilding.energyStandard,
    specificEnergyUseKwhM2Year: existingBuilding.specificEnergyUseKwhM2Year,
    estimatedResidents:
      request.estimatedResidents !== undefined ? Math.max(0, round(request.estimatedResidents * scale)) : undefined,
    estimatedWorkers:
      request.estimatedWorkers !== undefined ? Math.max(0, round(request.estimatedWorkers * scale)) : undefined,
    interventionType: "nybyggnad",
    existingBuilding: undefined,
    addedGrossFloorAreaM2: undefined,
    addedFloors: undefined,
    retainedStructureSharePct: undefined,
    retrofitDepth: undefined
  };
}

function buildAddedRequest(request: CalculateRequest, existingRequest: CalculateRequest): CalculateRequest {
  const explicitAdded =
    request.addedGrossFloorAreaM2 ??
    Math.max(0, request.grossFloorAreaM2 - existingRequest.grossFloorAreaM2);
  const addedArea = explicitAdded > 0 ? explicitAdded : Math.max(1, request.grossFloorAreaM2 * 0.2);
  const totalArea = Math.max(addedArea, request.grossFloorAreaM2);
  const addedShare = totalArea > 0 ? addedArea / totalArea : 0.2;

  return {
    ...request,
    grossFloorAreaM2: addedArea,
    estimatedResidents:
      request.estimatedResidents !== undefined ? Math.max(0, round(request.estimatedResidents * addedShare)) : undefined,
    estimatedWorkers:
      request.estimatedWorkers !== undefined ? Math.max(0, round(request.estimatedWorkers * addedShare)) : undefined,
    buildingFootprintM2:
      request.buildingFootprintM2 !== undefined
        ? request.buildingFootprintM2
        : request.addedFloors
          ? addedArea / Math.max(1, request.addedFloors)
          : undefined,
    floorsAboveGround: request.addedFloors ?? request.floorsAboveGround,
    siteAreaM2: undefined,
    interventionType: "nybyggnad",
    existingBuilding: undefined,
    addedGrossFloorAreaM2: undefined,
    retainedStructureSharePct: undefined,
    retrofitDepth: undefined
  };
}

function buildBaselineSummary(
  baselineCore: CoreCalculation,
  baselineMobility: MobilityResult
): BaselineExistingSummary {
  const totalKgCo2e =
    baselineCore.embodiedTotal +
    baselineCore.lifetimeOperationalTotal +
    baselineMobility.lifetimeKgCo2e;
  const perM2KgCo2e = baselineCore.area > 0 ? totalKgCo2e / baselineCore.area : 0;
  const perPersonKgCo2e =
    baselineCore.population.totalPeople > 0
      ? totalKgCo2e / baselineCore.population.totalPeople
      : 0;
  const perHaKgCo2e =
    baselineCore.siteAreaM2 && baselineCore.siteAreaM2 > 0
      ? totalKgCo2e / (baselineCore.siteAreaM2 / 10_000)
      : undefined;

  return {
    totalKgCo2e: round(totalKgCo2e),
    perM2KgCo2e: round(perM2KgCo2e),
    perPersonKgCo2e: round(perPersonKgCo2e),
    perHaKgCo2e: perHaKgCo2e !== undefined ? round(perHaKgCo2e) : undefined,
    annualOperationalKgCo2e: round(baselineCore.annualOperationalTotal),
    lifetimeMobilityKgCo2e: round(baselineMobility.lifetimeKgCo2e)
  };
}

function buildBaselineComparison(
  baseline: BaselineExistingSummary,
  interventionTotalKgCo2e: number,
  annualOperationalKgCo2e: number,
  mobilityLifetimeKgCo2e: number,
  avoidedNewbuildKgCo2e?: number
): BaselineComparison {
  return {
    totalDeltaKgCo2e: round(interventionTotalKgCo2e - baseline.totalKgCo2e),
    annualOperationalDeltaKgCo2e: round(
      annualOperationalKgCo2e - baseline.annualOperationalKgCo2e
    ),
    lifetimeMobilityDeltaKgCo2e: round(
      mobilityLifetimeKgCo2e - baseline.lifetimeMobilityKgCo2e
    ),
    avoidedNewbuildKgCo2e:
      avoidedNewbuildKgCo2e !== undefined ? round(avoidedNewbuildKgCo2e) : undefined
  };
}

function estimateUncertaintyRangePct(
  request: CalculateRequest,
  core: CoreCalculation,
  mobility: MobilityResult
) {
  let range = DEFAULT_UNCERTAINTY_RANGE_PCT - 6;

  if (request.specificEnergyUseKwhM2Year === undefined) {
    range += 4;
  }

  if (request.buildingForm === undefined) {
    range += 2;
  }

  if (request.floorsAboveGround === undefined) {
    range += 2;
  }

  if (request.buildingFootprintM2 === undefined) {
    range += 2;
  }

  if (request.urbanContext === undefined) {
    range += 2;
  }

  if (request.siteLocation === undefined && request.transitOverrides === undefined) {
    range += 3;
  }

  if (request.siteAreaM2 === undefined) {
    range += 2;
  }

  if (request.parkingStructureType === undefined) {
    range += 2;
  }

  if (request.groundCondition === undefined) {
    range += 1;
  }

  if (request.foundationType === undefined) {
    range += 1;
  }

  if (request.foundationType === "kallare" && request.basementFloors === undefined) {
    range += 2;
  }

  if (request.interventionType && request.interventionType !== "nybyggnad") {
    range += 3;
  }

  if (mobility.inputs.source === "default") {
    range += 3;
  }

  if (request.proxyProfile === "bestPractice") {
    range -= 2;
  } else if (request.proxyProfile === "conservative") {
    range += 2;
  }

  range += Math.min(6, Math.max(0, core.defaultsApplied.length * 0.5));

  return clamp(range, 8, 35);
}

function finaliseResult(input: {
  request: CalculateRequest;
  core: CoreCalculation;
  mobility: MobilityResult;
  mobilityExplanations: CalculationExplanation[];
  resolver: ReturnType<typeof buildMethodResolver>;
  referenceData: ReturnType<typeof getReferenceData>;
  benchmarkProfile?: BenchmarkProfile;
  targetProfile?: TargetProfile;
  baselineExisting?: BaselineExistingSummary;
  baselineComparison?: BaselineComparison;
  extraExplanations?: CalculationExplanation[];
  extraAssumptions?: AssumptionEntry[];
}) {
  const totalKgCo2e =
    input.core.embodiedTotal +
    input.core.lifetimeOperationalTotal +
    input.mobility.lifetimeKgCo2e;
  const perM2KgCo2e = input.core.area > 0 ? totalKgCo2e / input.core.area : 0;
  const perPersonKgCo2e =
    input.core.population.totalPeople > 0
      ? totalKgCo2e / input.core.population.totalPeople
      : 0;
  const perHaKgCo2e =
    input.core.siteAreaM2 && input.core.siteAreaM2 > 0
      ? totalKgCo2e / (input.core.siteAreaM2 / 10_000)
      : undefined;

  const comparisons = buildComparisons(
    totalKgCo2e,
    perM2KgCo2e,
    perPersonKgCo2e,
    perHaKgCo2e,
    input.core.area,
    input.core.population.totalPeople,
    input.benchmarkProfile,
    input.targetProfile
  );

  const topDrivers = buildTopDrivers(
    input.core.embodiedRawItems,
    input.core.operationalRawItems,
    input.mobility.breakdown,
    totalKgCo2e
  );
  const recommendedActions = buildRecommendedActions(
    input.request,
    perM2KgCo2e,
    totalKgCo2e,
    input.mobility
  );
  const uncertaintyRangePct = estimateUncertaintyRangePct(input.request, input.core, input.mobility);

  const assumptions: AssumptionEntry[] = [
    ...input.core.assumptions,
    {
      label: "Interventionstyp",
      value: LABELS.interventionType[input.request.interventionType ?? "nybyggnad"]
    },
    {
      label: "Byggnadsform",
      value: LABELS.buildingForm[input.request.buildingForm ?? "normal"]
    },
    {
      label: "Proxyprofil",
      value:
        input.request.proxyProfile
          ? LABELS.proxyProfile[input.request.proxyProfile]
          : "Anpassad"
    },
    {
      label: "Markförhållande",
      value: LABELS.groundCondition[input.request.groundCondition ?? "normal_mark"]
    },
    {
      label: "Källarvåningar",
      value:
        input.request.foundationType === "kallare"
          ? `${input.request.basementFloors ?? 1} vån`
          : "Ej källare"
    },
    {
      label: "Parkeringslösning",
      value:
        input.request.parkingStructureType && input.request.parkingStructureType !== "none"
          ? `${LABELS.parkingStructureType[input.request.parkingStructureType]} • ${
              input.request.parkingGarageFloors ?? 1
            } vån`
          : LABELS.parkingStructureType.none
    },
    {
      label: "Lägesprofil",
      value: labelUrbanContext(input.mobility.inputs.urbanContext)
    },
    {
      label: "Mobilitetsprofil",
      value: `Tillgänglighet ${input.mobility.inputs.accessibilityBand}`
    },
    {
      label: "Osäkerhetsintervall",
      value: `±${uncertaintyRangePct} %`
    },
    ...(input.extraAssumptions ?? [])
  ];

  const explanations = [
    ...input.core.explanations,
    ...input.mobilityExplanations,
    explanation(
      "explanation-totals",
      "totals",
      "Totalt klimatutsläpp",
      "Totalen summerar embodied klimatpåverkan, driftutsläpp över livslängd och mobilitetsutsläpp över livslängd.",
      "embodied totalt + (drift per år x livslängd) + (mobilitet per år x livslängd)",
      [
        `${input.core.embodiedTotal} kg CO2e + ${input.core.lifetimeOperationalTotal} kg CO2e + ${input.mobility.lifetimeKgCo2e} kg CO2e`,
        `= ${round(totalKgCo2e)} kg CO2e`
      ],
      [
        {
          key: "embodiedTotal",
          label: "Embodied total",
          value: `${round(input.core.embodiedTotal)} kg CO2e`,
          source: "derived"
        },
        {
          key: "operationalLifetime",
          label: "Drift över livslängd",
          value: `${round(input.core.lifetimeOperationalTotal)} kg CO2e`,
          source: "derived"
        },
        {
          key: "mobilityLifetime",
          label: "Mobilitet över livslängd",
          value: `${round(input.mobility.lifetimeKgCo2e)} kg CO2e`,
          source: "derived"
        }
      ],
      input.core.defaultsApplied,
      input.resolver.evidenceFor([
        "method-embodied-standard",
        "method-ben-normalbruk",
        "method-mobility-accessibility"
      ]),
      ["Värdet är en tidig livscykelindikator och inte en full verifierad LCA eller trafikprognos."]
    ),
    explanation(
      "explanation-per-m2",
      "perM2",
      "Klimatutsläpp per m2",
      "Per m2 används för benchmark mellan alternativ och räknas från total klimatpåverkan dividerad med bruttoarea.",
      "totalt klimatutsläpp / bruttoarea",
      [
        `${round(totalKgCo2e)} kg CO2e / ${input.core.area} m2 = ${round(perM2KgCo2e)} kg CO2e/m2`
      ],
      [
        {
          key: "grossFloorAreaM2",
          label: "Bruttoarea",
          value: `${input.core.area} m2`,
          source: "user"
        }
      ],
      input.core.defaultsApplied,
      input.resolver.evidenceFor([
        "method-embodied-standard",
        "method-energy-benchmark",
        "method-mobility-accessibility"
      ]),
      ["Per m2 är ett jämförelsemått och säger inte allt om kapacitet, funktion eller täthet."]
    ),
    explanation(
      "explanation-per-person",
      "perPerson",
      "Klimatutsläpp per person",
      "Per person beräknas som total klimatpåverkan dividerad med personunderlaget för boende och arbetande.",
      "totalt klimatutsläpp / antal personer",
      [
        `${round(totalKgCo2e)} kg CO2e / ${input.core.population.totalPeople || 1} personer = ${round(perPersonKgCo2e)} kg CO2e/person`
      ],
      [
        {
          key: "population",
          label: "Personunderlag",
          value: `${input.core.population.totalPeople} personer`,
          source: input.core.population.source === "user" ? "user" : "derived"
        }
      ],
      input.core.defaultsApplied,
      input.resolver.evidenceFor(["method-energy-benchmark", "method-mobility-accessibility"]),
      ["När personantal inte anges används en area- och typologibaserad uppskattning."]
    ),
    ...(perHaKgCo2e !== undefined && input.core.siteAreaM2 !== undefined
      ? [
          explanation(
            "explanation-per-ha",
            "perHa",
            "Klimatutsläpp per hektar",
            "Per hektar används för att jämföra markeffektivitet mellan alternativ och räknas från total klimatpåverkan dividerad med platsytan.",
            "totalt klimatutsläpp / (platsyta i ha)",
            [
              `${round(totalKgCo2e)} kg CO2e / ${(input.core.siteAreaM2 / 10_000).toFixed(2)} ha = ${round(perHaKgCo2e)} kg CO2e/ha`
            ],
            [
              {
                key: "siteAreaM2",
                label: "Platsyta",
                value: `${round(input.core.siteAreaM2)} m2`,
                source: "user"
              }
            ],
            input.core.defaultsApplied,
            input.resolver.evidenceFor(["method-land-proxy", "method-embodied-standard"]),
            ["Per hektar visas bara när platsytan är känd och ska främst användas för scenariojämförelse i planskedet."]
          )
        ]
      : []),
    ...comparisons.vsBenchmark.map((comparison) =>
      explanation(
        `explanation-${comparison.traceKey}`,
        comparison.traceKey ?? `benchmark.${comparison.metric}`,
        `${comparison.referenceLabel} för ${comparison.label.toLowerCase()}`,
        `Jämförelsen visar hur utfallet för ${comparison.label.toLowerCase()} förhåller sig till organisationens referensvärde.`,
        "utfall - referens",
        [
          `${comparison.actualValue} - ${comparison.referenceValue} = ${comparison.delta} ${comparison.unit}`
        ],
        [
          {
            key: "actualValue",
            label: "Utfall",
            value: `${comparison.actualValue} ${comparison.unit}`,
            source: "derived"
          },
          {
            key: "referenceValue",
            label: "Referens",
            value: `${comparison.referenceValue} ${comparison.unit}`,
            source: "reference"
          }
        ],
        input.core.defaultsApplied,
        input.resolver.evidenceFor(["method-energy-benchmark"]),
        ["Benchmark- och målvärden är organisationsprofiler för tidigt beslutsstöd, inte juridiska gränsvärden."]
      )
    ),
    ...comparisons.vsTarget.map((comparison) =>
      explanation(
        `explanation-${comparison.traceKey}`,
        comparison.traceKey ?? `benchmark.${comparison.metric}`,
        `${comparison.referenceLabel} för ${comparison.label.toLowerCase()}`,
        `Jämförelsen visar hur utfallet för ${comparison.label.toLowerCase()} förhåller sig till organisationens referensvärde.`,
        "utfall - referens",
        [
          `${comparison.actualValue} - ${comparison.referenceValue} = ${comparison.delta} ${comparison.unit}`
        ],
        [
          {
            key: "actualValue",
            label: "Utfall",
            value: `${comparison.actualValue} ${comparison.unit}`,
            source: "derived"
          },
          {
            key: "referenceValue",
            label: "Referens",
            value: `${comparison.referenceValue} ${comparison.unit}`,
            source: "reference"
          }
        ],
        input.core.defaultsApplied,
        input.resolver.evidenceFor(["method-energy-benchmark"]),
        ["Benchmark- och målvärden är organisationsprofiler för tidigt beslutsstöd, inte juridiska gränsvärden."]
      )
    ),
    ...recommendedActions.map((action) => {
      const methodIds =
        action.id === "frame-material"
          ? ["method-embodied-standard"]
          : action.id === "energy-standard"
            ? ["method-energy-benchmark", "method-ben-normalbruk"]
            : action.id === "mobility-location"
              ? ["method-mobility-accessibility", "method-mobility-gtfs"]
            : action.id === "parking"
              ? ["method-parking-proxy", "method-mobility-accessibility"]
              : action.id === "garage-volume"
                ? ["method-parking-garage-proxy", "method-parking-proxy"]
              : action.id === "retention"
                ? ["method-ombyggnad-definition", "method-retrofit-proxy"]
                : ["method-energy-benchmark"];

      return explanation(
        `explanation-${action.traceKey}`,
        action.traceKey ?? `action.${action.id}`,
        action.title,
        "Åtgärdsförslaget bygger på de resultatposter och regler som driver störst klimatpåverkan i scenariot.",
        "regelbaserad rekommendation från drivare och benchmarkgap",
        [action.description],
        [
          {
            key: "lever",
            label: "Påverkbar parameter",
            value: action.lever,
            source: "derived"
          }
        ],
        input.core.defaultsApplied,
        input.resolver.evidenceFor(methodIds),
        ["Åtgärdsförslag är beslutsstöd för alternativstudier och inte projekteringsanvisningar."]
      );
    }),
    ...(input.extraExplanations ?? [])
  ];

  const sourceIds = Array.from(
    new Set(
      explanations.flatMap((item) => item.evidence.map((evidence) => evidence.sourceId))
    )
  );
  const sources = dedupeSources(
    input.referenceData.sourceCatalog.filter((source) => sourceIds.includes(source.id))
  );

  return {
    embodied: {
      totalKgCo2e: round(input.core.embodiedTotal),
      breakdown: withShares(input.core.embodiedRawItems, input.core.embodiedTotal)
    },
    operational: {
      annualKgCo2e: round(input.core.annualOperationalTotal),
      lifetimeKgCo2e: round(input.core.lifetimeOperationalTotal),
      breakdown: withShares(input.core.operationalRawItems, input.core.annualOperationalTotal)
    },
    mobility: input.mobility,
    assumptions,
    sources,
    uncertaintyRangePct,
    totals: toMetricValue("Totalt klimatutsläpp", totalKgCo2e, "kg CO2e", "totals"),
    perM2: toMetricValue("Klimatutsläpp per m2", perM2KgCo2e, "kg CO2e/m2", "perM2"),
    perPerson: toMetricValue(
      "Klimatutsläpp per person",
      perPersonKgCo2e,
      "kg CO2e/person",
      "perPerson"
    ),
    perHa:
      perHaKgCo2e !== undefined
        ? toMetricValue("Klimatutsläpp per hektar", perHaKgCo2e, "kg CO2e/ha", "perHa")
        : undefined,
    population: input.core.population,
    vsBenchmark: comparisons.vsBenchmark,
    vsTarget: comparisons.vsTarget,
    topDrivers,
    recommendedActions,
    explanations,
    explanationIndex: buildExplanationIndex(explanations),
    baselineExisting: input.baselineExisting,
    baselineComparison: input.baselineComparison,
    byPlanObject: undefined as PlanObjectResult[] | undefined
  } satisfies CalculationResult;
}

export function calculateClimateImpact(
  request: CalculateRequest,
  options?: {
    benchmarkProfile?: BenchmarkProfile;
    targetProfile?: TargetProfile;
    byPlanObject?: PlanObjectResult[];
  }
): CalculationResult {
  const referenceData = getReferenceData();
  const resolver = buildMethodResolver(referenceData.sourceCatalog, referenceData.methodCatalog);
  const interventionType = request.interventionType ?? "nybyggnad";
  const core = calculateCoreCase(request, resolver, {
    benchmarkProfile: options?.benchmarkProfile
  });
  const mobilityCalculation = calculateMobility(
    request,
    core.population,
    referenceData.mobilityReference,
    resolver
  );

  if (interventionType === "nybyggnad") {
    const result = finaliseResult({
      request: {
        ...request,
        interventionType
      },
      core,
      mobility: mobilityCalculation.result,
      mobilityExplanations: mobilityCalculation.explanations,
      resolver,
      referenceData,
      benchmarkProfile: options?.benchmarkProfile,
      targetProfile: options?.targetProfile
    });

    return {
      ...result,
      byPlanObject: options?.byPlanObject
    };
  }

  const existingRequest = buildExistingRequest(request);
  const baselineCore = calculateCoreCase(existingRequest, resolver, {
    benchmarkProfile: options?.benchmarkProfile
  });
  const baselineMobilityCalculation = calculateMobility(
    existingRequest,
    baselineCore.population,
    referenceData.mobilityReference,
    resolver
  );
  const baselineExisting = buildBaselineSummary(
    baselineCore,
    baselineMobilityCalculation.result
  );

  if (interventionType === "ombyggnad") {
    const retrofitDepth = request.retrofitDepth ?? "medium";
    const retainedStructureSharePct = clamp(
      request.retainedStructureSharePct ?? 65,
      referenceData.retrofitReference.retainedStructureFloorPct * 100,
      95
    );
    const retainedShare = retainedStructureSharePct / 100;
    const replaceShare = Math.max(
      referenceData.retrofitReference.retainedStructureFloorPct,
      1 - retainedShare
    );
    const embodiedMultiplier =
      referenceData.retrofitReference.embodiedMultiplierByDepth[retrofitDepth];
    const operationalImprovementPct =
      referenceData.retrofitReference.operationalImprovementPctByDepth[retrofitDepth];

    let embodiedItems = scaleSpecificItems(
      core.embodiedRawItems,
      embodiedMultiplier * replaceShare,
      ["embodied.frame", "embodied.envelope", "embodied.installations"],
      `Skalad för ombyggnad (${LABELS.retrofitDepth[retrofitDepth].toLowerCase()} nivå, ${retainedStructureSharePct}% bevarad struktur)`
    );
    embodiedItems = scaleSpecificItems(
      embodiedItems,
      referenceData.retrofitReference.ombyggnadFoundationReuseFactor,
      ["site.foundation"],
      "Reducerad för återbrukad grund och befintlig struktur"
    ).map((item) =>
      item.traceKey === "site.land"
        ? {
            ...item,
            valueKgCo2e: 0,
            note: "Ingen ny markpost antas i ombyggnadsfallet"
          }
        : item
    );

    const embodiedTotal = embodiedItems.reduce((sum, item) => sum + item.valueKgCo2e, 0);
    const annualOperationalTotal = Math.min(
      core.annualOperationalTotal,
      round(baselineCore.annualOperationalTotal * (1 - operationalImprovementPct))
    );
    const operationalItems = scaleBreakdownsToTotal(core.operationalRawItems, annualOperationalTotal);
    const adjustedCore: CoreCalculation = {
      ...core,
      embodiedRawItems: embodiedItems,
      operationalRawItems: operationalItems,
      embodiedTotal,
      annualOperationalTotal,
      lifetimeOperationalTotal: round(annualOperationalTotal * BUILDING_LIFETIME_YEARS),
      assumptions: [
        ...core.assumptions,
        {
          label: "Retrofitdjup",
          value: LABELS.retrofitDepth[retrofitDepth]
        },
        {
          label: "Bevarad struktur",
          value: `${retainedStructureSharePct} %`
        }
      ]
    };

    const newbuildEquivalent = core.embodiedTotal + core.lifetimeOperationalTotal;
    const interventionTotal =
      adjustedCore.embodiedTotal +
      adjustedCore.lifetimeOperationalTotal +
      mobilityCalculation.result.lifetimeKgCo2e;
    const baselineComparison = buildBaselineComparison(
      baselineExisting,
      interventionTotal,
      adjustedCore.annualOperationalTotal,
      mobilityCalculation.result.lifetimeKgCo2e,
      Math.max(0, newbuildEquivalent - (adjustedCore.embodiedTotal + adjustedCore.lifetimeOperationalTotal))
    );

    const extraExplanations = [
      explanation(
        "explanation-baseline-existing",
        "baseline.existing",
        "Befintligt basfall",
        "Basfallet beskriver byggnaden före ombyggnaden och används för att visa före/efter i resultatpanelen.",
        "befintlig embodied + befintlig drift + befintlig mobilitet",
        [
          `${baselineExisting.totalKgCo2e} kg CO2e totalt i befintligt läge`,
          `${baselineExisting.annualOperationalKgCo2e} kg CO2e/år drift och ${baselineExisting.lifetimeMobilityKgCo2e} kg CO2e mobilitet över livslängd`
        ],
        [
          {
            key: "existingArea",
            label: "Befintlig area",
            value: `${existingRequest.grossFloorAreaM2} m2`,
            source: request.existingBuilding ? "user" : "derived"
          }
        ],
        adjustedCore.defaultsApplied,
        resolver.evidenceFor(["method-ombyggnad-definition", "method-retrofit-proxy"]),
        ["Basfallet är en screening av före-läget och bygger på tillgängliga indata eller härledda värden."]
      ),
      explanation(
        "explanation-baseline-delta",
        "baseline.delta",
        "Förändring mot befintligt läge",
        "Delta visar skillnaden mellan ombyggnadens interventionsfall och befintligt basfall.",
        "intervention - befintligt basfall",
        [
          `${baselineComparison.totalDeltaKgCo2e} kg CO2e i total skillnad`,
          `${baselineComparison.annualOperationalDeltaKgCo2e} kg CO2e/år i drift och ${baselineComparison.lifetimeMobilityDeltaKgCo2e} kg CO2e över livslängd i mobilitet`
        ],
        [
          {
            key: "retrofitDepth",
            label: "Retrofitdjup",
            value: LABELS.retrofitDepth[retrofitDepth],
            source: request.retrofitDepth ? "user" : "default"
          }
        ],
        adjustedCore.defaultsApplied,
        resolver.evidenceFor(["method-ombyggnad-definition", "method-retrofit-proxy"]),
        ["Delta ska tolkas som screening mellan före och efter, inte som juridiskt verifierad klimatdeklaration."]
      )
    ];

    const result = finaliseResult({
      request: {
        ...request,
        interventionType
      },
      core: adjustedCore,
      mobility: mobilityCalculation.result,
      mobilityExplanations: mobilityCalculation.explanations,
      resolver,
      referenceData,
      benchmarkProfile: options?.benchmarkProfile,
      targetProfile: options?.targetProfile,
      baselineExisting,
      baselineComparison,
      extraExplanations,
      extraAssumptions: [
        {
          label: "Före/efter-logik",
          value: "Ombyggnad jämförs mot befintligt basfall"
        }
      ]
    });

    return {
      ...result,
      byPlanObject: options?.byPlanObject
    };
  }

  const retrofitDepth = request.retrofitDepth ?? "light";
  const retainedStructureSharePct = clamp(
    request.retainedStructureSharePct ?? 80,
    referenceData.retrofitReference.retainedStructureFloorPct * 100,
    98
  );
  const addedRequest = buildAddedRequest(request, existingRequest);
  const addedCore = calculateCoreCase(addedRequest, resolver, {
    benchmarkProfile: options?.benchmarkProfile
  });
  const overallPopulation = estimatePopulation(request, options?.benchmarkProfile);
  const operationalImprovementPct =
    referenceData.retrofitReference.operationalImprovementPctByDepth[retrofitDepth];
  const improvedExistingAnnual = round(
    baselineCore.annualOperationalTotal * (1 - operationalImprovementPct)
  );
  const improvedExistingOperational = scaleBreakdownsToTotal(
    baselineCore.operationalRawItems,
    improvedExistingAnnual
  );
  const combinedOperational = mergeBreakdowns([
    improvedExistingOperational,
    addedCore.operationalRawItems
  ]);
  const annualOperationalTotal =
    improvedExistingAnnual + addedCore.annualOperationalTotal;

  const reinforcementKgCo2e = round(
    (request.addedGrossFloorAreaM2 ?? addedRequest.grossFloorAreaM2) *
      referenceData.retrofitReference.pabyggnadReinforcementKgCo2ePerAddedM2
  );

  const addedEmbodied = addedCore.embodiedRawItems
    .map((item) => {
      if (item.traceKey === "site.foundation") {
        return {
          ...item,
          valueKgCo2e: round(
            item.valueKgCo2e * referenceData.retrofitReference.pabyggnadFoundationFactor
          ),
          note: "Reducerad grundpost för påbyggnad på befintlig struktur"
        };
      }

      if (item.traceKey === "site.land") {
        return {
          ...item,
          valueKgCo2e: 0,
          note: "Ingen ny markpost antas i påbyggnadsfallet"
        };
      }

      return item;
    })
    .concat([
      {
        key: "reinforcement",
        label: "Förstärkning för påbyggnad",
        valueKgCo2e: reinforcementKgCo2e,
        unit: "kgCO2e",
        note: `${round(addedRequest.grossFloorAreaM2)} m2 tillkommande area`,
        traceKey: "site.reinforcement"
      }
    ]);
  const embodiedTotal = addedEmbodied.reduce((sum, item) => sum + item.valueKgCo2e, 0);
  const adjustedCore: CoreCalculation = {
    ...core,
    population: overallPopulation,
    siteAreaM2: request.siteAreaM2 ?? baselineCore.siteAreaM2,
    embodiedRawItems: addedEmbodied,
    operationalRawItems: combinedOperational,
    embodiedTotal,
    annualOperationalTotal,
    lifetimeOperationalTotal: round(annualOperationalTotal * BUILDING_LIFETIME_YEARS),
    assumptions: [
      ...core.assumptions,
      {
        label: "Retrofitdjup",
        value: LABELS.retrofitDepth[retrofitDepth]
      },
      {
        label: "Bevarad struktur",
        value: `${retainedStructureSharePct} %`
      },
      {
        label: "Tillkommande area",
        value: `${round(addedRequest.grossFloorAreaM2)} m2`
      }
    ],
    explanations: [
      ...addedCore.explanations,
      explanation(
        "explanation-site-reinforcement",
        "site.reinforcement",
        "Förstärkning för påbyggnad",
        "Påbyggnad får en separat förstärkningspost som proxy för att extra last ofta kräver konstruktiva åtgärder i den befintliga byggnaden.",
        "tillkommande area x förstärkningsfaktor",
        [
          `${round(addedRequest.grossFloorAreaM2)} m2 x ${referenceData.retrofitReference.pabyggnadReinforcementKgCo2ePerAddedM2} kg CO2e/m2`,
          `= ${reinforcementKgCo2e} kg CO2e`
        ],
        [
          {
            key: "addedGrossFloorAreaM2",
            label: "Tillkommande area",
            value: `${round(addedRequest.grossFloorAreaM2)} m2`,
            source: request.addedGrossFloorAreaM2 !== undefined ? "user" : "derived"
          }
        ],
        core.defaultsApplied,
        resolver.evidenceFor(["method-retrofit-proxy", "method-ombyggnad-definition"]),
        ["Förstärkningsposten är en proxy och ska ersättas av konstruktionsspecifik analys i senare skede."]
      )
    ],
    defaultsApplied: core.defaultsApplied
  };

  const interventionTotal =
    adjustedCore.embodiedTotal +
    adjustedCore.lifetimeOperationalTotal +
    mobilityCalculation.result.lifetimeKgCo2e;
  const avoidedNewbuildKgCo2e = Math.max(
    0,
    core.embodiedTotal * referenceData.retrofitReference.avoidedNewbuildCreditShare
  );
  const baselineComparison = buildBaselineComparison(
    baselineExisting,
    interventionTotal,
    adjustedCore.annualOperationalTotal,
    mobilityCalculation.result.lifetimeKgCo2e,
    avoidedNewbuildKgCo2e
  );

  const extraExplanations = [
    explanation(
      "explanation-baseline-existing",
      "baseline.existing",
      "Befintligt basfall",
      "Basfallet beskriver den befintliga byggnaden före påbyggnaden och används för att visa före/efter.",
      "befintlig embodied + befintlig drift + befintlig mobilitet",
      [
        `${baselineExisting.totalKgCo2e} kg CO2e totalt i befintligt läge`
      ],
      [
        {
          key: "existingArea",
          label: "Befintlig area",
          value: `${existingRequest.grossFloorAreaM2} m2`,
          source: request.existingBuilding ? "user" : "derived"
        }
      ],
      adjustedCore.defaultsApplied,
      resolver.evidenceFor(["method-ombyggnad-definition", "method-retrofit-proxy"]),
      ["Basfallet är en screening av före-läget och bygger på tillgängliga indata eller härledda värden."]
    ),
    explanation(
      "explanation-baseline-delta",
      "baseline.delta",
      "Förändring mot befintligt läge",
      "Delta visar skillnaden mellan påbyggnadsfallet och befintligt läge.",
      "intervention - befintligt basfall",
      [
        `${baselineComparison.totalDeltaKgCo2e} kg CO2e i total skillnad`,
        `${baselineComparison.annualOperationalDeltaKgCo2e} kg CO2e/år i drift`
      ],
      [
        {
          key: "addedFloors",
          label: "Tillkommande våningar",
          value: String(request.addedFloors ?? 0),
          source: request.addedFloors !== undefined ? "user" : "default"
        }
      ],
      adjustedCore.defaultsApplied,
      resolver.evidenceFor(["method-ombyggnad-definition", "method-retrofit-proxy"]),
      ["Delta ska tolkas som screening mellan före och efter, inte som juridiskt verifierad klimatdeklaration."]
    )
  ];

  const result = finaliseResult({
    request: {
      ...request,
      interventionType
    },
    core: adjustedCore,
    mobility: mobilityCalculation.result,
    mobilityExplanations: mobilityCalculation.explanations,
    resolver,
    referenceData,
    benchmarkProfile: options?.benchmarkProfile,
    targetProfile: options?.targetProfile,
    baselineExisting,
    baselineComparison,
    extraExplanations,
    extraAssumptions: [
      {
        label: "Före/efter-logik",
        value: "Påbyggnad jämförs mot befintligt basfall"
      }
    ]
  });

  return {
    ...result,
    byPlanObject: options?.byPlanObject
  };
}
