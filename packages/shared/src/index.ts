export const BUILDING_TYPES = [
  "smahus",
  "flerbostadshus",
  "kontor",
  "skola",
  "handel"
] as const;

export const FRAME_MATERIALS = ["tra", "betong", "stal", "hybrid"] as const;

export const ENERGY_STANDARDS = [
  "aldre",
  "normal",
  "modern",
  "passivhus"
] as const;

export const HEATING_TYPES = [
  "fjarrvarme",
  "varmepump",
  "el",
  "biobransle"
] as const;

export const LAND_TYPES = [
  "tidigare_bebyggd",
  "hardgjord",
  "gronyta",
  "skog",
  "jordbruksmark"
] as const;

export const BUILDING_FORMS = ["kompakt", "normal", "fragmenterad"] as const;

export const URBAN_CONTEXTS = [
  "stockholm_innerstad",
  "central_storstad",
  "urban",
  "suburban"
] as const;

export const PROXY_PROFILES = ["bestPractice", "balanced", "conservative"] as const;

export const FOUNDATION_TYPES = [
  "platta_pa_mark",
  "kantbalk",
  "kallare",
  "palar"
] as const;

export const GROUND_CONDITIONS = [
  "berg_fastmark",
  "sand_grus",
  "normal_mark",
  "lera_mjuk",
  "gyttja_mjuk",
  "fyllning_osaker"
] as const;

export const PARKING_STRUCTURE_TYPES = [
  "none",
  "garage_ovan_mark",
  "garage_under_mark"
] as const;

export const INTERVENTION_TYPES = [
  "nybyggnad",
  "ombyggnad",
  "pabyggnad"
] as const;

export const RETROFIT_DEPTHS = ["light", "medium", "deep"] as const;

export const OBJECT_TYPES = [
  "byggnad",
  "gata",
  "park",
  "anlaggning",
  "mobilitet"
] as const;

export const MODEL3D_SOURCE_FORMATS = ["glb", "gltf"] as const;
export const MODEL3D_PART_CATEGORIES = [
  "volym",
  "stomme",
  "fasad",
  "tak",
  "grund",
  "garage",
  "installationer",
  "site"
] as const;

export const SCENARIO_MODES = ["quick", "plan"] as const;
export const EXPORT_FORMATS = ["csv", "png"] as const;
export const COMPARISON_METRICS = ["total", "perM2", "perPerson", "perHa"] as const;
export const STANDARD_SCHEMES = ["miljobyggnad", "breeam-se"] as const;
export const EVIDENCE_TYPES = [
  "standard",
  "official-statistic",
  "research",
  "provider-data",
  "internal-assumption"
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];
export type FrameMaterial = (typeof FRAME_MATERIALS)[number];
export type EnergyStandard = (typeof ENERGY_STANDARDS)[number];
export type HeatingType = (typeof HEATING_TYPES)[number];
export type LandType = (typeof LAND_TYPES)[number];
export type BuildingForm = (typeof BUILDING_FORMS)[number];
export type UrbanContext = (typeof URBAN_CONTEXTS)[number];
export type ProxyProfile = (typeof PROXY_PROFILES)[number];
export type FoundationType = (typeof FOUNDATION_TYPES)[number];
export type GroundCondition = (typeof GROUND_CONDITIONS)[number];
export type ParkingStructureType = (typeof PARKING_STRUCTURE_TYPES)[number];
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export type RetrofitDepth = (typeof RETROFIT_DEPTHS)[number];
export type PlanObjectType = (typeof OBJECT_TYPES)[number];
export type Model3DSourceFormat = (typeof MODEL3D_SOURCE_FORMATS)[number];
export type Model3DPartCategory = (typeof MODEL3D_PART_CATEGORIES)[number];
export type ScenarioMode = (typeof SCENARIO_MODES)[number];
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ComparisonMetric = (typeof COMPARISON_METRICS)[number];
export type StandardScheme = (typeof STANDARD_SCHEMES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const LEGACY_URBAN_CONTEXT_ALIASES = {
  central: "central_storstad",
  perifer: "suburban"
} as const;

export function normalizeUrbanContext(value: unknown): UrbanContext | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if ((URBAN_CONTEXTS as readonly string[]).includes(value)) {
    return value as UrbanContext;
  }

  return LEGACY_URBAN_CONTEXT_ALIASES[value as keyof typeof LEGACY_URBAN_CONTEXT_ALIASES];
}

export interface UValues {
  yttervagg?: number;
  tak?: number;
  fonster?: number;
}

export interface SiteLocation {
  lat: number;
  lon: number;
}

export interface TransitOverrides {
  distanceToTransitStopM?: number;
  distanceToRailStationM?: number;
  departuresPerHour?: number;
}

export interface ExistingBuildingInput {
  grossFloorAreaM2: number;
  buildYear: number;
  frameMaterial: FrameMaterial;
  energyStandard: EnergyStandard;
  specificEnergyUseKwhM2Year?: number;
}

export interface CalculateRequest {
  buildingType: BuildingType;
  grossFloorAreaM2: number;
  buildYear: number;
  frameMaterial: FrameMaterial;
  energyStandard: EnergyStandard;
  heatingType: HeatingType;
  buildingForm?: BuildingForm;
  urbanContext?: UrbanContext;
  proxyProfile?: ProxyProfile;
  specificEnergyUseKwhM2Year?: number;
  uValues?: UValues;
  estimatedResidents?: number;
  estimatedWorkers?: number;
  siteAreaM2?: number;
  floorsAboveGround?: number;
  basementFloors?: number;
  buildingFootprintM2?: number;
  glazingRatioPct?: number;
  parkingSpaces?: number;
  parkingStructureType?: ParkingStructureType;
  parkingGarageFloors?: number;
  landType?: LandType;
  groundCondition?: GroundCondition;
  foundationType?: FoundationType;
  siteLocation?: SiteLocation;
  distanceToServiceM?: number;
  transitOverrides?: TransitOverrides;
  interventionType?: InterventionType;
  existingBuilding?: ExistingBuildingInput;
  retrofitDepth?: RetrofitDepth;
  retainedStructureSharePct?: number;
  addedGrossFloorAreaM2?: number;
  addedFloors?: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  valueKgCo2e: number;
  unit: "kgCO2e";
  shareOfTotalPct?: number;
  note?: string;
  traceKey?: string;
}

export interface SourceReference {
  id: string;
  title: string;
  publisher: string;
  license: string;
  url: string;
  note?: string;
  updatedAt?: string;
}

export interface MethodCatalogEntry {
  id: string;
  sourceId: string;
  evidenceType: EvidenceType;
  title: string;
  publisher: string;
  url: string;
  citationShort: string;
  appliesTo: string[];
  versionOrYear: string;
}

export interface EvidenceReference {
  methodId: string;
  sourceId: string;
  evidenceType: EvidenceType;
  title: string;
  publisher: string;
  url: string;
  citationShort: string;
  versionOrYear: string;
}

export interface FormulaReference {
  expression: string;
  description?: string;
}

export interface InputTrace {
  key: string;
  label: string;
  value: string;
  source: "user" | "derived" | "default" | "reference";
}

export interface CalculationExplanation {
  id: string;
  traceKey: string;
  title: string;
  summary: string;
  formulaText: string;
  formula?: FormulaReference;
  calculationSteps: string[];
  inputs: InputTrace[];
  defaultsApplied: string[];
  evidence: EvidenceReference[];
  limitations: string[];
}

export interface AssumptionEntry {
  label: string;
  value: string;
}

export interface EmbodiedResult {
  totalKgCo2e: number;
  breakdown: BreakdownItem[];
}

export interface OperationalResult {
  annualKgCo2e: number;
  lifetimeKgCo2e: number;
  breakdown: BreakdownItem[];
}

export interface MobilityInputs {
  accessibilityBand: "high" | "medium" | "low";
  urbanContext: UrbanContext;
  distanceToTransitStopM?: number;
  distanceToRailStationM?: number;
  departuresPerHour?: number;
  distanceToServiceM?: number;
  source: "override" | "siteLocation" | "geometry" | "default";
}

export interface MobilityResult {
  annualKgCo2e: number;
  lifetimeKgCo2e: number;
  breakdown: BreakdownItem[];
  inputs: MobilityInputs;
}

export interface MetricValue {
  label: string;
  value: number;
  unit: string;
  traceKey?: string;
}

export interface PopulationEstimate {
  residents: number;
  workers: number;
  totalPeople: number;
  source: "user" | "estimated";
}

export interface BenchmarkComparison {
  metric: ComparisonMetric;
  label: string;
  referenceLabel: string;
  actualValue: number;
  referenceValue: number;
  delta: number;
  deltaPct: number;
  status: "below" | "above" | "equal";
  unit: string;
  traceKey?: string;
}

export interface DriverInsight {
  key: string;
  label: string;
  category: "embodied" | "operational" | "site" | "mobility" | "plan";
  impactKgCo2e: number;
  sharePct: number;
  explanation: string;
  traceKey?: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  expectedImpact: "high" | "medium" | "low";
  lever: string;
  traceKey?: string;
}

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type GeoJsonGeometry = GeoJsonPoint | GeoJsonPolygon | GeoJsonMultiPolygon;

export interface PlanObject {
  id: string;
  name: string;
  objectType: PlanObjectType;
  grossFloorAreaM2: number;
  areaHa?: number;
  residents?: number;
  workers?: number;
  quickInput: CalculateRequest;
  geometry?: GeoJsonGeometry;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PlanObjectResult {
  planObjectId: string;
  name: string;
  objectType: PlanObjectType;
  totalKgCo2e: number;
  perM2KgCo2e: number;
  dominantDriver: string;
  geometry?: GeoJsonGeometry;
}

export interface BuildingModel3DPart {
  id: string;
  label: string;
  category: Model3DPartCategory;
  meshNames: string[];
  traceKey?: string;
  climateKgCo2e?: number;
  shareOfTotalPct?: number;
  note?: string;
}

export interface BuildingModel3D {
  id: string;
  name: string;
  sourceFormat: Model3DSourceFormat;
  sourceFileName?: string;
  importedAt: string;
  georeference?: SiteLocation;
  footprint?: GeoJsonGeometry;
  heightMeters?: number;
  scaleMetersPerUnit?: number;
  rotationDegrees?: number;
  parts: BuildingModel3DPart[];
  notes?: string[];
}

export interface BaselineExistingSummary {
  totalKgCo2e: number;
  perM2KgCo2e: number;
  perPersonKgCo2e: number;
  perHaKgCo2e?: number;
  annualOperationalKgCo2e: number;
  lifetimeMobilityKgCo2e: number;
}

export interface BaselineComparison {
  totalDeltaKgCo2e: number;
  annualOperationalDeltaKgCo2e: number;
  lifetimeMobilityDeltaKgCo2e: number;
  avoidedNewbuildKgCo2e?: number;
}

export interface CalculationResult {
  embodied: EmbodiedResult;
  operational: OperationalResult;
  mobility: MobilityResult;
  assumptions: AssumptionEntry[];
  sources: SourceReference[];
  uncertaintyRangePct: number;
  totals: MetricValue;
  perM2: MetricValue;
  perPerson: MetricValue;
  perHa?: MetricValue;
  population: PopulationEstimate;
  vsBenchmark: BenchmarkComparison[];
  vsTarget: BenchmarkComparison[];
  topDrivers: DriverInsight[];
  recommendedActions: RecommendedAction[];
  explanations: CalculationExplanation[];
  explanationIndex: Record<string, string[]>;
  baselineExisting?: BaselineExistingSummary;
  baselineComparison?: BaselineComparison;
  byPlanObject?: PlanObjectResult[];
}

export interface ScenarioRun {
  id: string;
  scenarioId: string;
  createdAt: string;
  result: CalculationResult;
  inputSnapshot?: CalculateRequest;
}

export interface DataSourceDataset {
  dataset: string;
  version: string;
  updatedAt: string;
  sourceIds: string[];
  status: "active" | "planned";
}

export interface DataSourcesResponse {
  stockholmProfile: string;
  datasets: DataSourceDataset[];
  sources: SourceReference[];
  methodCatalog: MethodCatalogEntry[];
  standardProfiles: StandardProfile[];
}

export interface StandardProfile {
  id: string;
  scheme: StandardScheme;
  version: string;
  level: string;
  label: string;
  summary: string;
  sourceIds: string[];
  applicableBuildingTypes: BuildingType[];
  applicableInterventions: InterventionType[];
  metrics: Partial<Record<ComparisonMetric, number>>;
  notes: string[];
}

export interface Organization {
  id: string;
  name: string;
  audience: "kommun" | "byggherre" | "konsult";
  region: string;
}

export interface UserSession {
  email: string;
  organizationId: string;
  organizationName: string;
}

export interface BenchmarkProfile {
  id: string;
  organizationId: string;
  name: string;
  sourceLabel: string;
  version: string;
  updatedAt: string;
  applicability: string;
  normalPerM2KgCo2e: number;
  targetPerM2KgCo2e: number;
  normalPerPersonKgCo2e: number;
  targetPerPersonKgCo2e: number;
  normalPerHaKgCo2e?: number;
  targetPerHaKgCo2e?: number;
  defaultBtaPerResidentM2: number;
  defaultBtaPerWorkerM2: number;
  heatingFactorOverrides?: Partial<Record<HeatingType, number>>;
  districtHeatingTargetKgCo2ePerKwh?: number;
  notes: string[];
}

export interface TargetProfile {
  id: string;
  organizationId: string;
  name: string;
  targetYear: number;
  targetPerM2KgCo2e: number;
  targetPerPersonKgCo2e: number;
  targetPerHaKgCo2e?: number;
  notes: string[];
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  mode: ScenarioMode;
  quickInput?: CalculateRequest;
  planObjects: PlanObject[];
  buildingModel3D?: BuildingModel3D;
  runs: ScenarioRun[];
  latestResult?: CalculationResult;
  lastCalculatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  scenarios: Scenario[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceResponse {
  session: UserSession | null;
  organizations: Organization[];
  projects: Project[];
  benchmarkProfiles: BenchmarkProfile[];
  targetProfiles: TargetProfile[];
}

export interface CreateSessionRequest {
  email: string;
  organizationId: string;
}

export interface CreateProjectRequest {
  organizationId: string;
  name: string;
  description?: string;
}

export interface CreateScenarioRequest {
  name: string;
  description?: string;
  mode?: ScenarioMode;
  quickInput?: CalculateRequest;
}

export interface DuplicateScenarioRequest {
  name?: string;
}

export interface ScenarioCalculationRequest {
  quickInput?: CalculateRequest;
}

export interface ScenarioComparison {
  projectId: string;
  baseScenarioId: string;
  candidateScenarioId: string;
  metrics: Array<{
    metric: ComparisonMetric;
    baseValue: number;
    candidateValue: number;
    delta: number;
    deltaPct: number;
    unit: string;
  }>;
  changedDrivers: DriverInsight[];
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface ScenarioImportGeoJsonRequest {
  geojson: GeoJsonFeatureCollection;
}

export interface ScenarioImportModel3DRequest {
  model: BuildingModel3D;
}

export interface ScenarioImportTabularRequest {
  format: "csv" | "json";
  content?: string;
  rows?: Array<Record<string, string | number>>;
}

export interface ScenarioImportResponse {
  importedCount: number;
  scenario: Scenario;
  warnings: string[];
}

export interface ScenarioImportModel3DResponse {
  scenario: Scenario;
  model: BuildingModel3D;
}

export const LABELS = {
  buildingType: {
    smahus: "Småhus",
    flerbostadshus: "Flerbostadshus",
    kontor: "Kontor",
    skola: "Skola",
    handel: "Handel"
  },
  frameMaterial: {
    tra: "Trä",
    betong: "Betong",
    stal: "Stål",
    hybrid: "Hybrid"
  },
  energyStandard: {
    aldre: "Äldre bestånd",
    normal: "Normal standard",
    modern: "Modern standard",
    passivhus: "Passivhus"
  },
  heatingType: {
    fjarrvarme: "Fjärrvärme",
    varmepump: "Värmepump",
    el: "Direktel",
    biobransle: "Biobränsle"
  },
  landType: {
    tidigare_bebyggd: "Tidigare bebyggd mark",
    hardgjord: "Hårdgjord yta",
    gronyta: "Grönyta",
    skog: "Skogsmark",
    jordbruksmark: "Jordbruksmark"
  },
  groundCondition: {
    berg_fastmark: "Berg / fastmark",
    sand_grus: "Sand / grus",
    normal_mark: "Normal mark",
    lera_mjuk: "Mjuk lera",
    gyttja_mjuk: "Gyttja / mycket mjuk mark",
    fyllning_osaker: "Fyllning / osäker mark"
  },
  buildingForm: {
    kompakt: "Kompakt",
    normal: "Normal",
    fragmenterad: "Fragmenterad"
  },
  basementFloors: "Källarvåningar",
  urbanContext: {
    stockholm_innerstad: "Stockholm innerstad",
    central_storstad: "Central annan storstad",
    urban: "Urban",
    suburban: "Förort",
    central: "Central annan storstad",
    perifer: "Förort"
  },
  proxyProfile: {
    bestPractice: "Best practice",
    balanced: "Balanserad",
    conservative: "Konservativ"
  },
  foundationType: {
    platta_pa_mark: "Platta på mark",
    kantbalk: "Kantbalk",
    kallare: "Källare",
    palar: "Pålning"
  },
  parkingStructureType: {
    none: "Inget garage",
    garage_ovan_mark: "Garage ovan mark",
    garage_under_mark: "Garage under mark"
  },
  interventionType: {
    nybyggnad: "Nybyggnad",
    ombyggnad: "Ombyggnad",
    pabyggnad: "Påbyggnad"
  },
  retrofitDepth: {
    light: "Lätt",
    medium: "Mellan",
    deep: "Djup"
  },
  objectType: {
    byggnad: "Byggnad",
    gata: "Gata",
    park: "Park",
    anlaggning: "Anläggning",
    mobilitet: "Mobilitet"
  },
  model3DSourceFormat: {
    glb: "GLB",
    gltf: "GLTF"
  },
  model3DPartCategory: {
    volym: "Volym",
    stomme: "Stomme",
    fasad: "Fasad",
    tak: "Tak",
    grund: "Grund",
    garage: "Garage",
    installationer: "Installationer",
    site: "Tomt"
  },
  evidenceType: {
    standard: "Standard",
    "official-statistic": "Officiell statistik",
    research: "Forskning",
    "provider-data": "Leverantörsdata",
    "internal-assumption": "Schablon/proxy"
  },
  standardScheme: {
    miljobyggnad: "Miljöbyggnad",
    "breeam-se": "BREEAM-SE"
  }
} as const;

export function labelUrbanContext(value: unknown) {
  const normalized = normalizeUrbanContext(value);

  if (normalized) {
    return LABELS.urbanContext[normalized];
  }

  if (typeof value === "string") {
    return LABELS.urbanContext[value as keyof typeof LABELS.urbanContext] ?? value;
  }

  return "";
}

export const STOCKHOLM_PROFILE_NAME = "Stockholm MVP 2026";
export const BUILDING_LIFETIME_YEARS = 50;
export const DEFAULT_UNCERTAINTY_RANGE_PCT = 20;

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function createEmptyMetric(label: string, unit: string, traceKey?: string): MetricValue {
  return {
    label,
    value: 0,
    unit,
    traceKey
  };
}
