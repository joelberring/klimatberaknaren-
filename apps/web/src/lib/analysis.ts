import {
  COMPARISON_METRICS,
  LABELS,
  formatNumber,
  labelUrbanContext,
  type BenchmarkProfile,
  type CalculationExplanation,
  type CalculationResult,
  type ComparisonMetric,
  type DataSourcesResponse,
  type CalculateRequest,
  type Scenario,
  type ScenarioRun,
  type StandardProfile
} from "../../../../packages/shared/src";

export interface AnalysisSnapshotHighlight {
  label: string;
  value: string;
  note?: string;
}

export interface AnalysisTraceRow {
  id: string;
  key: string;
  label: string;
  value: string;
  source: CalculationExplanation["inputs"][number]["source"];
  sourceLabel: string;
  uncertaintyLevel: "low" | "medium" | "high";
  uncertaintyLabel: string;
  traceKey: string;
  explanationTitle: string;
  explanationSummary: string;
  evidenceTitle?: string;
  usedIn: string[];
}

export interface AnalysisBranchRow {
  id: string;
  label: string;
  value: number;
  unit: string;
  sharePct: number;
  note: string;
  traceKey?: string;
  traceKeys: string[];
  breakdown: Array<{
    key: string;
    label: string;
    value: number;
    traceKey?: string;
  }>;
}

export interface AnalysisComparisonRow {
  metric: ComparisonMetric;
  label: string;
  unit: string;
  selectedValue: number;
  comparisonValue: number;
  delta: number;
  deltaPct: number;
}

export interface AnalysisBenchmarkRow {
  id: string;
  label: string;
  value: number;
  kind: "actual" | "benchmark" | "target" | "standard";
  meta?: string;
}

export interface MobilityFactorRow {
  id: string;
  label: string;
  value: string;
  note: string;
  score: number;
  direction: "transit" | "car" | "mixed";
}

const inputLabelMap: Record<string, string> = {
  buildingType: "Byggnadstyp",
  grossFloorAreaM2: "Bruttoarea",
  buildYear: "Byggår",
  frameMaterial: "Stommaterial",
  energyStandard: "Energistandard",
  heatingType: "Uppvärmning",
  buildingForm: "Byggnadsform",
  urbanContext: "Lägesprofil",
  proxyProfile: "Proxyprofil",
  specificEnergyUseKwhM2Year: "Specifik energianvändning",
  wallUValue: "Ytterväggens U-värde",
  roofUValue: "Takets U-värde",
  windowUValue: "Fönstrets U-värde",
  estimatedResidents: "Boende",
  estimatedWorkers: "Arbetande",
  siteAreaM2: "Tomtyta",
  floorsAboveGround: "Våningar över mark",
  basementFloors: "Källarvåningar",
  buildingFootprintM2: "Byggnadsfotavtryck",
  glazingRatioPct: "Glasandel",
  parkingSpaces: "Parkeringsplatser",
  parkingStructureType: "Parkeringslösning",
  parkingGarageFloors: "Garagevåningar",
  siteLat: "Latitud",
  siteLon: "Longitud",
  distanceToServiceM: "Avstånd till service",
  distanceToTransitStopM: "Avstånd till hållplats",
  distanceToRailStationM: "Avstånd till station",
  departuresPerHour: "Avgångar per timme",
  landType: "Marktyp",
  groundCondition: "Markförhållande",
  foundationType: "Grundläggning",
  interventionType: "Åtgärdstyp",
  existingGrossFloorAreaM2: "Befintlig area",
  existingBuildYear: "Befintligt byggår",
  existingFrameMaterial: "Befintligt stommaterial",
  existingEnergyStandard: "Befintlig energistandard",
  existingSpecificEnergyUseKwhM2Year: "Befintlig specifik energianvändning",
  retrofitDepth: "Retrofitdjup",
  retainedStructureSharePct: "Bevarad struktur",
  addedGrossFloorAreaM2: "Tillagd area",
  addedFloors: "Tillagda våningar"
};

function sourceLabel(source: CalculationExplanation["inputs"][number]["source"]) {
  if (source === "user") {
    return "Användarinmatning";
  }

  if (source === "derived") {
    return "Härlett";
  }

  if (source === "default") {
    return "Default";
  }

  return "Referensdata";
}

export type ResultScopeKey = "total" | "embodied" | "operational" | "mobility" | "site";

const RESULT_SCOPE_META: Record<ResultScopeKey, { label: string; note: string }> = {
  total: {
    label: "Total livscykel",
    note: "Hela kalkylens sammanlagda resultat, uppdelat i embodied, drift, mobilitet och site."
  },
  embodied: {
    label: "Embodied A1-A5",
    note: "Stomme, grundläggning, klimatskal och installationer i uppförandet."
  },
  operational: {
    label: "Drift / B6",
    note: "Energi, värme och drift över byggnadens livslängd."
  },
  mobility: {
    label: "Mobilitet",
    note: "Vardagsresor, tillgänglighet och parkeringsstyrning över livslängden."
  },
  site: {
    label: "Site / läge",
    note: "Tomt, läge, mark och andra platsbundna drivare."
  }
};

export function getResultScopeLabel(scope: ResultScopeKey) {
  return RESULT_SCOPE_META[scope].label;
}

export function getResultScopeNote(scope: ResultScopeKey) {
  return RESULT_SCOPE_META[scope].note;
}

export function getBenchmarkReferenceTypeLabel(profile: BenchmarkProfile | StandardProfile) {
  if ("scheme" in profile) {
    return `${LABELS.standardScheme[profile.scheme]} screeningprofil`;
  }

  return "Kommunprofil";
}

export function getBenchmarkCoverageLabel(profile: BenchmarkProfile | StandardProfile) {
  const supportedMetrics = COMPARISON_METRICS.filter((metric) => {
    if ("scheme" in profile) {
      if (metric === "total") {
        return false;
      }

      return profile.metrics[metric] !== undefined;
    }

    if (metric === "perM2") {
      return profile.normalPerM2KgCo2e !== undefined || profile.targetPerM2KgCo2e !== undefined;
    }

    if (metric === "perPerson") {
      return (
        profile.normalPerPersonKgCo2e !== undefined || profile.targetPerPersonKgCo2e !== undefined
      );
    }

    if (metric === "perHa") {
      return profile.normalPerHaKgCo2e !== undefined || profile.targetPerHaKgCo2e !== undefined;
    }

    return false;
  }).map((metric) => metricLabel(metric).toLowerCase());

  const missingMetrics = COMPARISON_METRICS.filter((metric) => {
    if ("scheme" in profile) {
      if (metric === "total") {
        return false;
      }

      return profile.metrics[metric] === undefined;
    }

    if (metric === "perM2") {
      return profile.normalPerM2KgCo2e === undefined && profile.targetPerM2KgCo2e === undefined;
    }

    if (metric === "perPerson") {
      return (
        profile.normalPerPersonKgCo2e === undefined && profile.targetPerPersonKgCo2e === undefined
      );
    }

    if (metric === "perHa") {
      return profile.normalPerHaKgCo2e === undefined && profile.targetPerHaKgCo2e === undefined;
    }

    return true;
  }).map((metric) => metricLabel(metric).toLowerCase());

  const supportText = supportedMetrics.length
    ? `Stöd: ${supportedMetrics.join(", ")}`
    : "Stöd saknas";
  const missingText = missingMetrics.length ? ` • saknar ${missingMetrics.join(", ")}` : "";

  if ("scheme" in profile) {
    return `${supportText}${missingText} • total härleds vid behov`;
  }

  return `${supportText}${missingText}${supportedMetrics.length ? " • total härleds vid behov" : ""}`;
}

export function getBenchmarkScopeSummaryCopy(selectedMetric: ComparisonMetric) {
  return `Vald visning: ${metricLabel(
    selectedMetric
  )}. Benchmarkerna är screeningreferenser på valt nyckeltal och ska läsas tillsammans med delposterna nedan.`;
}

export function getBenchmarkScopeDiagramCopy(selectedMetric: ComparisonMetric) {
  return `Diagrammet visar ${metricLabel(
    selectedMetric
  ).toLowerCase()} som screeningreferens. Delposterna nedan visar vad som faktiskt ingår i jämförelsen.`;
}

export function getInputUncertaintyLevel(
  source: CalculationExplanation["inputs"][number]["source"]
): "low" | "medium" | "high" {
  if (source === "user") {
    return "low";
  }

  if (source === "derived" || source === "reference") {
    return "medium";
  }

  return "high";
}

export function getInputUncertaintyLabel(
  source: CalculationExplanation["inputs"][number]["source"]
): string {
  const level = getInputUncertaintyLevel(source);
  if (level === "low") {
    return "Säker";
  }

  if (level === "medium") {
    return "Medel";
  }

  return "Hög";
}

export function categoryTraceKey(traceKey: string) {
  return (
    traceKey === "totals" ||
    traceKey === "perM2" ||
    traceKey === "perPerson" ||
    traceKey === "perHa" ||
    traceKey.startsWith("embodied.") ||
    traceKey.startsWith("operational.") ||
    traceKey.startsWith("site.") ||
    traceKey.startsWith("mobility.") ||
    traceKey.startsWith("baseline.")
  );
}

function formatValuePath(path: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Ej angivet";
  }

  if (typeof value === "number") {
    const hasDecimals =
      path.includes("Pct") ||
      path.includes("ratio") ||
      path.includes("Ratio") ||
      path.includes("share") ||
      path.includes("Share");

    return formatNumber(value, hasDecimals ? 2 : 0);
  }

  if (typeof value === "boolean") {
    return value ? "Ja" : "Nej";
  }

  if (typeof value !== "string") {
    return JSON.stringify(value);
  }

  if (path === "buildingType") {
    return LABELS.buildingType[value as keyof typeof LABELS.buildingType] ?? value;
  }

  if (path === "frameMaterial" || path === "existingFrameMaterial") {
    return LABELS.frameMaterial[value as keyof typeof LABELS.frameMaterial] ?? value;
  }

  if (path === "energyStandard" || path === "existingEnergyStandard") {
    return LABELS.energyStandard[value as keyof typeof LABELS.energyStandard] ?? value;
  }

  if (path === "heatingType") {
    return LABELS.heatingType[value as keyof typeof LABELS.heatingType] ?? value;
  }

  if (path === "buildingForm") {
    return LABELS.buildingForm[value as keyof typeof LABELS.buildingForm] ?? value;
  }

  if (path === "urbanContext") {
    return LABELS.urbanContext[value as keyof typeof LABELS.urbanContext] ?? value;
  }

  if (path === "proxyProfile") {
    return LABELS.proxyProfile[value as keyof typeof LABELS.proxyProfile] ?? "Anpassad";
  }

  if (path === "groundCondition") {
    return LABELS.groundCondition[value as keyof typeof LABELS.groundCondition] ?? value;
  }

  if (path === "foundationType") {
    return LABELS.foundationType[value as keyof typeof LABELS.foundationType] ?? value;
  }

  if (path === "parkingStructureType") {
    return (
      LABELS.parkingStructureType[value as keyof typeof LABELS.parkingStructureType] ?? value
    );
  }

  if (path === "interventionType") {
    return LABELS.interventionType[value as keyof typeof LABELS.interventionType] ?? value;
  }

  if (path === "retrofitDepth") {
    return LABELS.retrofitDepth[value as keyof typeof LABELS.retrofitDepth] ?? value;
  }

  if (path === "landType") {
    return LABELS.landType[value as keyof typeof LABELS.landType] ?? value;
  }

  return value;
}

function labelForPath(path: string) {
  if (inputLabelMap[path]) {
    return inputLabelMap[path];
  }

  if (path.startsWith("uValues.")) {
    const suffix = path.slice("uValues.".length);
    if (suffix === "yttervagg") {
      return "Ytterväggens U-värde";
    }

    if (suffix === "tak") {
      return "Takets U-värde";
    }

    if (suffix === "fonster") {
      return "Fönstrets U-värde";
    }
  }

  return path
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\./g, " / ")
    .replace(/^./, (char) => char.toUpperCase());
}

function resolveMobilityUseType(buildingType?: CalculateRequest["buildingType"]) {
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

function resolveServiceTripShare(buildingType?: CalculateRequest["buildingType"]) {
  const useType = resolveMobilityUseType(buildingType);

  if (useType === "residential") {
    return 0.06;
  }

  if (useType === "workplace") {
    return 0.08;
  }

  if (useType === "education") {
    return 0.04;
  }

  return 0.09;
}

function getScenarioMetricValue(result: CalculationResult, metric: ComparisonMetric) {
  if (metric === "total") {
    return result.totals.value;
  }

  if (metric === "perM2") {
    return result.perM2.value;
  }

  if (metric === "perPerson") {
    return result.perPerson.value;
  }

  return result.perHa?.value;
}

function getScenarioMetricUnit(result: CalculationResult, metric: ComparisonMetric) {
  if (metric === "total") {
    return result.totals.unit;
  }

  if (metric === "perM2") {
    return result.perM2.unit;
  }

  if (metric === "perPerson") {
    return result.perPerson.unit;
  }

  return result.perHa?.unit ?? "kg CO2e/ha";
}

function getRunLabel(run: ScenarioRun) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(run.createdAt));
}

function getTraceKeys(result: CalculationResult, inputKey: string) {
  const keys = new Set<string>();

  for (const explanation of result.explanations) {
    if (explanation.inputs.some((input) => input.key === inputKey)) {
      keys.add(explanation.traceKey);
    }
  }

  return Array.from(keys);
}

function getDefaultExplanation(result: CalculationResult, traceKey: string) {
  const explanationIds = result.explanationIndex[traceKey] ?? [];
  return (
    result.explanations.find((entry) => explanationIds.includes(entry.id)) ??
    result.explanations.find((entry) => entry.traceKey === traceKey) ??
    null
  );
}

function mergeSource(
  current: AnalysisTraceRow["source"],
  next: CalculationExplanation["inputs"][number]["source"]
) {
  const priority: Record<AnalysisTraceRow["source"], number> = {
    user: 4,
    derived: 3,
    default: 2,
    reference: 1
  };

  return priority[next] > priority[current] ? next : current;
}

function metricLabel(metric: ComparisonMetric) {
  if (metric === "total") {
    return "Totalt";
  }

  if (metric === "perM2") {
    return "Per m2";
  }

  if (metric === "perPerson") {
    return "Per person";
  }

  return "Per ha";
}

export function buildSnapshotHighlights(snapshot?: CalculateRequest | null): AnalysisSnapshotHighlight[] {
  if (!snapshot) {
    return [];
  }

  const highlights: AnalysisSnapshotHighlight[] = [
    {
      label: "Byggnadstyp",
      value: formatValuePath("buildingType", snapshot.buildingType)
    },
    {
      label: "Bruttoarea",
      value: `${formatNumber(snapshot.grossFloorAreaM2)} m2`
    },
    {
      label: "Byggår",
      value: formatNumber(snapshot.buildYear)
    },
    {
      label: "Stommaterial",
      value: formatValuePath("frameMaterial", snapshot.frameMaterial)
    },
    {
      label: "Energistandard",
      value: formatValuePath("energyStandard", snapshot.energyStandard)
    },
    {
      label: "Uppvärmning",
      value: formatValuePath("heatingType", snapshot.heatingType)
    }
  ];

  if (snapshot.buildingForm) {
    highlights.push({
      label: "Byggnadsform",
      value: formatValuePath("buildingForm", snapshot.buildingForm)
    });
  }

  if (snapshot.proxyProfile) {
    highlights.push({
      label: "Proxyprofil",
      value: formatValuePath("proxyProfile", snapshot.proxyProfile)
    });
  }

  if (snapshot.urbanContext) {
    highlights.push({
      label: "Lägesprofil",
      value: formatValuePath("urbanContext", snapshot.urbanContext)
    });
  }

  if (snapshot.siteAreaM2 !== undefined) {
    highlights.push({
      label: "Tomtyta",
      value: `${formatNumber(snapshot.siteAreaM2)} m2`
    });
  }

  if (snapshot.floorsAboveGround !== undefined) {
    highlights.push({
      label: "Våningar ovan mark",
      value: formatNumber(snapshot.floorsAboveGround)
    });
  }

  if (snapshot.basementFloors !== undefined) {
    highlights.push({
      label: "Källarvåningar",
      value: formatNumber(snapshot.basementFloors)
    });
  }

  if (snapshot.buildingFootprintM2 !== undefined) {
    highlights.push({
      label: "Byggnadsfotavtryck",
      value: `${formatNumber(snapshot.buildingFootprintM2)} m2`
    });
  }

  if (snapshot.parkingStructureType) {
    const parking = formatValuePath("parkingStructureType", snapshot.parkingStructureType);
    const garageFloors =
      snapshot.parkingGarageFloors !== undefined ? ` • ${formatNumber(snapshot.parkingGarageFloors)} vån` : "";
    highlights.push({
      label: "Parkeringslösning",
      value: `${parking}${garageFloors}`
    });
  }

  if (snapshot.groundCondition) {
    highlights.push({
      label: "Markförhållande",
      value: formatValuePath("groundCondition", snapshot.groundCondition)
    });
  }

  if (snapshot.foundationType) {
    highlights.push({
      label: "Grundläggning",
      value: formatValuePath("foundationType", snapshot.foundationType)
    });
  }

  if (snapshot.landType) {
    highlights.push({
      label: "Marktyp",
      value: formatValuePath("landType", snapshot.landType)
    });
  }

  if (snapshot.interventionType) {
    highlights.push({
      label: "Åtgärdstyp",
      value: formatValuePath("interventionType", snapshot.interventionType)
    });
  }

  if (snapshot.retainedStructureSharePct !== undefined) {
    highlights.push({
      label: "Bevarad struktur",
      value: `${formatNumber(snapshot.retainedStructureSharePct)}%`
    });
  }

  if (snapshot.addedGrossFloorAreaM2 !== undefined) {
    highlights.push({
      label: "Tillagd area",
      value: `${formatNumber(snapshot.addedGrossFloorAreaM2)} m2`
    });
  }

  if (snapshot.addedFloors !== undefined) {
    highlights.push({
      label: "Tillagda våningar",
      value: formatNumber(snapshot.addedFloors)
    });
  }

  if (snapshot.siteLocation) {
    highlights.push({
      label: "Läge",
      value: `${formatNumber(snapshot.siteLocation.lat, 4)}, ${formatNumber(snapshot.siteLocation.lon, 4)}`
    });
  }

  if (snapshot.transitOverrides) {
    const pieces = [
      snapshot.transitOverrides.distanceToTransitStopM !== undefined
        ? `${formatNumber(snapshot.transitOverrides.distanceToTransitStopM)} m hållplats`
        : null,
      snapshot.transitOverrides.distanceToRailStationM !== undefined
        ? `${formatNumber(snapshot.transitOverrides.distanceToRailStationM)} m station`
        : null,
      snapshot.transitOverrides.departuresPerHour !== undefined
        ? `${formatNumber(snapshot.transitOverrides.departuresPerHour)} avg/h`
        : null
    ].filter(Boolean);

    if (pieces.length) {
      highlights.push({
        label: "Kollektivtrafik",
        value: pieces.join(" • ")
      });
    }
  }

  if (snapshot.distanceToServiceM !== undefined) {
    highlights.push({
      label: "Service",
      value: `${formatNumber(snapshot.distanceToServiceM)} m`
    });
  }

  return highlights;
}

function scoreFromRange(value: number, thresholds: Array<{ max: number; score: number }>, fallback: number) {
  for (const threshold of thresholds) {
    if (value <= threshold.max) {
      return threshold.score;
    }
  }

  return fallback;
}

export function buildMobilityFactorRows(
  snapshot?: CalculateRequest | null,
  result?: CalculationResult | null
): MobilityFactorRow[] {
  const mobility = result?.mobility.inputs;
  const buildingType = snapshot?.buildingType;
  const context = snapshot?.urbanContext ?? mobility?.urbanContext;
  const people = Math.max(result?.population.totalPeople ?? 0, 1);
  const parkingSpaces = snapshot?.parkingSpaces ?? 0;
  const parkingIntensity = parkingSpaces / people;
  const transitStopDistance = mobility?.distanceToTransitStopM ?? snapshot?.transitOverrides?.distanceToTransitStopM;
  const railDistance = mobility?.distanceToRailStationM ?? snapshot?.transitOverrides?.distanceToRailStationM;
  const departuresPerHour = mobility?.departuresPerHour ?? snapshot?.transitOverrides?.departuresPerHour ?? 0;
  const serviceDistance = mobility?.distanceToServiceM ?? snapshot?.distanceToServiceM;
  const serviceTripShare = resolveServiceTripShare(buildingType);

  const contextScore =
    context === "stockholm_innerstad"
      ? 94
      : context === "central_storstad"
        ? 80
        : context === "urban"
          ? 66
          : 48;

  const parkingScore = Math.max(0, Math.min(100, Math.round(100 - Math.min(90, parkingIntensity * 90))));
  const transitScore = transitStopDistance !== undefined
    ? scoreFromRange(
        transitStopDistance,
        [
          { max: 400, score: 96 },
          { max: 700, score: 76 },
          { max: 1500, score: 48 }
        ],
        24
      )
    : 18;
  const railScore = railDistance !== undefined
    ? scoreFromRange(
        railDistance,
        [
          { max: 900, score: 96 },
          { max: 1800, score: 72 },
          { max: 5000, score: 42 }
        ],
        22
      )
    : 18;
  const serviceAccessScore = serviceDistance !== undefined
    ? scoreFromRange(
        serviceDistance,
        [
          { max: 200, score: 96 },
          { max: 500, score: 80 },
          { max: 1000, score: 58 },
          { max: 2000, score: 36 }
        ],
        18
      )
    : 18;
  const departuresScore = Math.max(0, Math.min(100, Math.round(departuresPerHour * 8)));
  const serviceScore = Math.max(0, Math.min(100, Math.round(serviceTripShare * 1000)));

  return [
    {
      id: "urbanContext",
      label: "Lägesprofil",
      value: labelUrbanContext(context),
      note:
        context === "stockholm_innerstad"
          ? "Stark kollektivtrafik, service och gångbarhet dämpar bilandelen tydligt."
          : context === "central_storstad"
            ? "Centralläge med god tillgänglighet och lägre biltryck än generellt urbanläge."
            : context === "urban"
              ? "Ett mellanting där bil, kollektivtrafik och gång vägs mer jämnt."
              : "Förortsläge där bilandel och parkeringsberoende lätt ökar.",
      score: contextScore,
      direction:
        context === "stockholm_innerstad" || context === "central_storstad"
          ? "transit"
          : context === "urban"
            ? "mixed"
            : "car"
    },
    {
      id: "parking",
      label: "Bilplatser per person",
      value: `${formatNumber(parkingIntensity, 2)}`,
      note:
        parkingIntensity === 0
          ? "Inga p-platser gör det svårt att motivera vardagsbilism i modellen."
          : parkingIntensity < 0.3
            ? "Låg tillgång till parkering styr vardagsresor mot andra färdmedel."
            : parkingIntensity < 0.8
              ? "Medelhög tillgång ger blandad resprofil."
              : "Hög tillgång till bilplats stärker bilandelen tydligt.",
      score: parkingScore,
      direction: parkingIntensity < 0.3 ? "transit" : parkingIntensity < 0.8 ? "mixed" : "car"
    },
    {
      id: "transitStop",
      label: "Avstånd till hållplats",
      value: transitStopDistance !== undefined ? `${formatNumber(transitStopDistance)} m` : "Ej angivet",
      note:
        transitStopDistance !== undefined
          ? transitStopDistance <= 400
            ? "Kort gångavstånd ger stark transitstyrning."
            : transitStopDistance <= 700
              ? "Mellanläge med god men inte optimal kollektivtrafikaccess."
              : "Längre avstånd gör att bil och cykel blir relativt starkare."
          : "Använd plats eller transitöverskrivning för att se effekten.",
      score: transitScore,
      direction: transitScore >= 75 ? "transit" : transitScore >= 45 ? "mixed" : "car"
    },
    {
      id: "serviceAccess",
      label: "Avstånd till service",
      value: serviceDistance !== undefined ? `${formatNumber(serviceDistance)} m` : "Ej angivet",
      note:
        serviceDistance !== undefined
          ? serviceDistance <= 200
            ? "Mycket nära vardagsservice dämpar bilberoendet i modellen."
            : serviceDistance <= 500
              ? "Ganska nära service ger en liten men tydlig lättnad för bilandel."
              : serviceDistance <= 1000
                ? "Service finns i rimligt gångavstånd och ger en mindre effekt."
                : "Längre serviceavstånd ger ingen extra dämpning."
          : "Ange avstånd till service för att visa denna extra platsfaktor.",
      score: serviceAccessScore,
      direction: serviceAccessScore >= 75 ? "transit" : serviceAccessScore >= 45 ? "mixed" : "car"
    },
    {
      id: "railStation",
      label: "Avstånd till station",
      value: railDistance !== undefined ? `${formatNumber(railDistance)} m` : "Ej angivet",
      note:
        railDistance !== undefined
          ? railDistance <= 900
            ? "Tåg- eller stationsnärhet stärker kollektivtrafikandelen tydligt."
            : railDistance <= 1800
              ? "Stationsaccess finns men är inte riktigt nära."
              : "Lång stationsnärhet dämpar rälsandel och höjer biltryck."
          : "Använd plats eller transitöverskrivning för att se effekten.",
      score: railScore,
      direction: railScore >= 75 ? "transit" : railScore >= 45 ? "mixed" : "car"
    },
    {
      id: "departures",
      label: "Avgångar per timme",
      value: `${formatNumber(departuresPerHour)} avg/h`,
      note:
        departuresPerHour >= 10
          ? "Hög avgångstäthet gör kollektivtrafiken mer konkurrenskraftig."
          : departuresPerHour >= 4
            ? "Måttlig avgångstäthet ger blandad resprofil."
            : "Låg avgångstäthet ger svagare transitstyrning.",
      score: departuresScore,
      direction: departuresScore >= 75 ? "transit" : departuresScore >= 45 ? "mixed" : "car"
    },
    {
      id: "serviceTrips",
      label: "Service-/besöksresor i modellen",
      value: `${Math.round(serviceTripShare * 100)} % tillägg`,
      note:
        buildingType === "handel"
          ? "Handel får högre serviceandel eftersom kund- och leveransflöden är större."
          : buildingType === "skola"
            ? "Skolor har lägre serviceandel men tydliga dagtidsflöden."
            : "Serviceandelen är en typologi-proxy för extra vardags- och besöksresor.",
      score: serviceScore,
      direction: "mixed"
    }
  ];
}

export function buildTraceRows(result: CalculationResult): AnalysisTraceRow[] {
  const rows = new Map<string, AnalysisTraceRow>();

  for (const explanation of result.explanations) {
    if (!categoryTraceKey(explanation.traceKey)) {
      continue;
    }

    for (const input of explanation.inputs) {
      const rowKey = `${input.key}::${input.value}`;
      const existing = rows.get(rowKey);
      const traceKeys = existing?.usedIn ?? [];
      const nextTraceKeys = Array.from(new Set([...traceKeys, explanation.traceKey]));
      const nextSource = existing ? mergeSource(existing.source, input.source) : input.source;
      const uncertaintyLevel = getInputUncertaintyLevel(nextSource);

      rows.set(rowKey, {
        id: rowKey,
        key: input.key,
        label: input.label || labelForPath(input.key),
        value: input.value,
        source: nextSource,
        sourceLabel: sourceLabel(nextSource),
        uncertaintyLevel,
        uncertaintyLabel: getInputUncertaintyLabel(nextSource),
        traceKey: explanation.traceKey,
        explanationTitle: explanation.title,
        explanationSummary: explanation.summary,
        evidenceTitle: explanation.evidence[0]?.title,
        usedIn: nextTraceKeys
      });
    }
  }

  return Array.from(rows.values()).sort((left, right) => {
    if (left.label !== right.label) {
      return left.label.localeCompare(right.label, "sv");
    }

    return left.value.localeCompare(right.value, "sv");
  });
}

export const buildInputTraceRows = buildTraceRows;

export function buildBranchRows(result: CalculationResult): AnalysisBranchRow[] {
  const total = Math.max(result.totals.value, 1);
  const siteDrivers = result.topDrivers.filter(
    (driver) => driver.category === "site" || driver.traceKey?.startsWith("site.")
  );

  const embodiedTraceKeys = result.embodied.breakdown
    .map((item) => item.traceKey)
    .filter((traceKey): traceKey is string => Boolean(traceKey));
  const operationalTraceKeys = result.operational.breakdown
    .map((item) => item.traceKey)
    .filter((traceKey): traceKey is string => Boolean(traceKey));
  const mobilityTraceKeys = result.mobility.breakdown
    .map((item) => item.traceKey)
    .filter((traceKey): traceKey is string => Boolean(traceKey));
  const siteTraceKeys = siteDrivers
    .map((driver) => driver.traceKey)
    .filter((traceKey): traceKey is string => Boolean(traceKey));

  const siteValue = siteDrivers.reduce((sum, driver) => sum + driver.impactKgCo2e, 0);

  return [
    {
      id: "embodied",
      label: "Embodied A1-A5",
      value: result.embodied.totalKgCo2e,
      unit: "kg CO2e",
      sharePct: (result.embodied.totalKgCo2e / total) * 100,
      note: getResultScopeNote("embodied"),
      traceKey: embodiedTraceKeys[0] ?? result.totals.traceKey,
      traceKeys: embodiedTraceKeys,
      breakdown: result.embodied.breakdown.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.valueKgCo2e,
        traceKey: item.traceKey
      }))
    },
    {
      id: "operational",
      label: "Drift / B6",
      value: result.operational.lifetimeKgCo2e,
      unit: "kg CO2e",
      sharePct: (result.operational.lifetimeKgCo2e / total) * 100,
      note: getResultScopeNote("operational"),
      traceKey: operationalTraceKeys[0] ?? result.perM2.traceKey,
      traceKeys: operationalTraceKeys,
      breakdown: result.operational.breakdown.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.valueKgCo2e,
        traceKey: item.traceKey
      }))
    },
    {
      id: "mobility",
      label: "Mobilitet",
      value: result.mobility.lifetimeKgCo2e,
      unit: "kg CO2e",
      sharePct: (result.mobility.lifetimeKgCo2e / total) * 100,
      note: getResultScopeNote("mobility"),
      traceKey: mobilityTraceKeys[0] ?? result.mobility.breakdown[0]?.traceKey ?? result.perPerson.traceKey,
      traceKeys: mobilityTraceKeys,
      breakdown: result.mobility.breakdown.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.valueKgCo2e,
        traceKey: item.traceKey
      }))
    },
    {
      id: "site",
      label: "Site / läge",
      value: siteValue,
      unit: "kg CO2e",
      sharePct: (siteValue / total) * 100,
      note:
        siteDrivers.length > 0
          ? getResultScopeNote("site")
          : "Ingen explicit site-post med numeriskt värde i den här körningen.",
      traceKey: siteTraceKeys[0],
      traceKeys: siteTraceKeys,
      breakdown: siteDrivers.map((driver) => ({
        key: driver.key,
        label: driver.label,
        value: driver.impactKgCo2e,
        traceKey: driver.traceKey
      }))
    }
  ];
}

export function buildTraceEntries(result: CalculationResult) {
  return result.explanations
    .filter((explanation) => categoryTraceKey(explanation.traceKey))
    .sort((left, right) => left.title.localeCompare(right.title, "sv"));
}

export function buildRunComparisonRows(
  selectedRun: ScenarioRun,
  comparisonRun: ScenarioRun | null
): AnalysisComparisonRow[] {
  if (!comparisonRun) {
    return [];
  }

  const rows = ["total", "perM2", "perPerson", "perHa"]
    .map((metric) => {
      const selectedValue = getScenarioMetricValue(selectedRun.result, metric as ComparisonMetric);
      const comparisonValue = getScenarioMetricValue(comparisonRun.result, metric as ComparisonMetric);

      if (
        metric === "perHa" &&
        (selectedRun.result.perHa === undefined || comparisonRun.result.perHa === undefined)
      ) {
        return null;
      }

      if (selectedValue === undefined || comparisonValue === undefined) {
        return null;
      }

      const delta = selectedValue - comparisonValue;
      const base = Math.max(Math.abs(comparisonValue), 1);

      return {
        metric: metric as ComparisonMetric,
        label: metricLabel(metric as ComparisonMetric),
        unit: getScenarioMetricUnit(selectedRun.result, metric as ComparisonMetric),
        selectedValue,
        comparisonValue,
        delta,
        deltaPct: (delta / base) * 100
      };
    })
    .filter((row): row is AnalysisComparisonRow => Boolean(row));

  return rows.filter((row): row is AnalysisComparisonRow => Boolean(row));
}

export function buildTrendPoints(runs: ScenarioRun[], selectedMetric: ComparisonMetric) {
  return runs
    .map((run) => {
      const value = getScenarioMetricValue(run.result, selectedMetric);
      if (value === undefined) {
        return null;
      }

      return {
        id: run.id,
        label: getRunLabel(run),
        value,
        meta: `Scenario-körning ${run.createdAt}`
      };
    })
    .filter(
      (point: { id: string; label: string; value: number; meta: string } | null): point is {
        id: string;
        label: string;
        value: number;
        meta: string;
      } => Boolean(point)
    );
}

export function buildBenchmarkRows(
  result: CalculationResult,
  selectedMetric: ComparisonMetric,
  benchmarkProfiles: BenchmarkProfile[],
  selectedBenchmarkIds: string[],
  standardProfiles: StandardProfile[],
  selectedStandardIds: string[],
  input?: CalculateRequest | null,
  dataSources?: DataSourcesResponse | null
) {
  const selectedBenchmarks = benchmarkProfiles.filter((profile) =>
    selectedBenchmarkIds.includes(profile.id)
  );
  const applicableStandards = standardProfiles.filter((profile) => {
    const buildingType = input?.buildingType;
    const interventionType = input?.interventionType ?? "nybyggnad";
    return (
      (!buildingType || profile.applicableBuildingTypes.includes(buildingType)) &&
      profile.applicableInterventions.includes(interventionType)
    );
  });
  const selectedStandards = applicableStandards.filter((profile) =>
    selectedStandardIds.includes(profile.id)
  );
  const standardDataset = dataSources?.datasets.find((dataset) => dataset.dataset === "standard-profiles");

  return [
    {
      id: "actual-run",
      label: "Aktuell körning",
      value: getScenarioMetricValue(result, selectedMetric),
      kind: "actual" as const,
      meta: "Total livscykel i modellen"
    },
    ...selectedBenchmarks.flatMap((profile) => [
      {
        id: `${profile.id}-normal`,
        label: `${profile.name} normal`,
        value: getBenchmarkMetricValue(profile, selectedMetric, "Normalvärde", result),
        kind: "benchmark" as const,
        meta: `${getBenchmarkReferenceTypeLabel(profile)} • ${profile.sourceLabel} • v${profile.version}`
      },
      {
        id: `${profile.id}-target`,
        label: `${profile.name} mål`,
        value: getBenchmarkMetricValue(profile, selectedMetric, "Målvärde", result),
        kind: "target" as const,
        meta: `${getBenchmarkReferenceTypeLabel(profile)} • uppdaterad ${profile.updatedAt}`
      }
    ]),
    ...selectedStandards
      .filter((profile) => getStandardMetricValue(profile, selectedMetric) !== undefined)
      .map((profile) => ({
        id: profile.id,
        label: profile.label,
        value: getStandardMetricValue(profile, selectedMetric) ?? 0,
        kind: "standard" as const,
        meta: `${getBenchmarkReferenceTypeLabel(profile)} • ${LABELS.standardScheme[profile.scheme]} ${profile.version}${
          standardDataset ? ` • ${standardDataset.updatedAt}` : ""
        }`
      }))
  ].filter(
    (
      row
    ): row is { id: string; label: string; value: number; kind: "actual" | "benchmark" | "target" | "standard"; meta: string } =>
      row.value !== undefined
  );
}

export function buildBenchmarkComparisons(result: CalculationResult, selectedMetric: ComparisonMetric) {
  return [...result.vsBenchmark, ...result.vsTarget].filter((item) => item.metric === selectedMetric);
}

export function getActiveScenarioRun(scenario: Scenario | null, runId?: string) {
  if (!scenario) {
    return null;
  }

  const runs = scenario.runs ?? [];
  const selectedRun = runs.find((run) => run.id === runId) ?? runs[runs.length - 1] ?? null;

  if (selectedRun) {
    return selectedRun;
  }

  if (!scenario.latestResult) {
    return null;
  }

  return {
    id: `${scenario.id}-latest`,
    scenarioId: scenario.id,
    createdAt: scenario.lastCalculatedAt ?? scenario.updatedAt,
    result: scenario.latestResult,
    inputSnapshot: scenario.quickInput
  } satisfies ScenarioRun;
}

export function getComparisonScenarioRun(scenario: Scenario | null, activeRun: ScenarioRun | null) {
  if (!scenario || !activeRun) {
    return null;
  }

  const runs = [...(scenario.runs ?? [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
  const activeIndex = runs.findIndex((run) => run.id === activeRun.id);

  if (activeIndex > 0) {
    return runs[activeIndex - 1];
  }

  if (activeIndex === -1 && runs.length > 1) {
    return runs[runs.length - 2];
  }

  return null;
}

export function resolveSourceTitles(sourceIds: string[], dataSources?: DataSourcesResponse | null) {
  if (!dataSources) {
    return [];
  }

  return sourceIds
    .map((sourceId) => dataSources.sources.find((source) => source.id === sourceId)?.title)
    .filter((title): title is string => Boolean(title));
}

export function findExplanationByTraceKey(result: CalculationResult, traceKey: string) {
  const explanationIds = result.explanationIndex[traceKey] ?? [];
  return (
    result.explanations.find((entry) => explanationIds.includes(entry.id)) ??
    result.explanations.find((entry) => entry.traceKey === traceKey) ??
    null
  );
}

function getBenchmarkMetricValue(
  profile: BenchmarkProfile,
  metric: ComparisonMetric,
  referenceLabel: "Normalvärde" | "Målvärde",
  result: CalculationResult
) {
  if (metric === "perM2") {
    return referenceLabel === "Normalvärde"
      ? profile.normalPerM2KgCo2e
      : profile.targetPerM2KgCo2e;
  }

  if (metric === "perPerson") {
    return referenceLabel === "Normalvärde"
      ? profile.normalPerPersonKgCo2e
      : profile.targetPerPersonKgCo2e;
  }

  if (metric === "perHa") {
    return referenceLabel === "Normalvärde"
      ? profile.normalPerHaKgCo2e
      : profile.targetPerHaKgCo2e;
  }

  const derivedArea = result.perM2.value > 0 ? result.totals.value / result.perM2.value : 0;
  const perM2Value =
    referenceLabel === "Normalvärde" ? profile.normalPerM2KgCo2e : profile.targetPerM2KgCo2e;
  return Math.round(perM2Value * derivedArea);
}

function getStandardMetricValue(profile: StandardProfile, metric: ComparisonMetric) {
  return profile.metrics[metric];
}
