import {
  BUILDING_TYPES,
  BUILDING_FORMS,
  COMPARISON_METRICS,
  ENERGY_STANDARDS,
  GROUND_CONDITIONS,
  FOUNDATION_TYPES,
  FRAME_MATERIALS,
  HEATING_TYPES,
  INTERVENTION_TYPES,
  LAND_TYPES,
  LABELS,
  PARKING_STRUCTURE_TYPES,
  PROXY_PROFILES,
  RETROFIT_DEPTHS,
  URBAN_CONTEXTS,
  formatNumber,
  type BenchmarkProfile,
  type BenchmarkComparison,
  type CalculateRequest,
  type CalculationExplanation,
  type CalculationResult,
  type ComparisonMetric,
  type DataSourcesResponse,
  type Project,
  type Scenario,
  type ScenarioComparison,
  type ScenarioRun,
  type StandardProfile,
  type ProxyProfile,
  type UserSession,
  type WorkspaceResponse
} from "../../../packages/shared/src";
import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  calculateClimateImpact,
  calculateScenarioApi,
  compareScenariosApi,
  createProjectApi,
  deleteProjectApi,
  createScenarioApi,
  deleteScenarioApi,
  duplicateScenarioApi,
  fetchDataSources,
  fetchHealth,
  fetchScenarioAccessStatus,
  fetchWorkspace,
  importGeoJsonApi,
  importTabularApi,
  loginSession,
  unlockScenarioAccess,
  type ApiHealthResponse
} from "./lib/api";
import { BenchmarkPositionChart } from "./components/BenchmarkPositionChart";
import { AnalysisPage } from "./components/AnalysisPage";
import { BreakdownChart } from "./components/BreakdownChart";
import { ExplanationDrawer } from "./components/ExplanationDrawer";
import { GeoJsonMap } from "./components/GeoJsonMap";
import { ExplainButton } from "./components/ExplainButton";
import { LifecycleShareChart } from "./components/LifecycleShareChart";
import { RunTrendChart } from "./components/RunTrendChart";
import { Building3DViewer } from "./components/Building3DViewer";
import { DecisionWorkbench } from "./components/DecisionWorkbench";
import {
  getActiveScenarioRun,
  getBenchmarkCoverageLabel,
  getBenchmarkReferenceTypeLabel,
  getBenchmarkScopeDiagramCopy,
  getBenchmarkScopeSummaryCopy,
  getResultScopeLabel,
  getResultScopeNote,
  getInputUncertaintyLabel,
  getInputUncertaintyLevel
} from "./lib/analysis";
import { BUILDING_TYPE_PRESETS } from "./lib/decisionSupport";

interface FormState {
  buildingType: CalculateRequest["buildingType"];
  grossFloorAreaM2: string;
  buildYear: string;
  frameMaterial: CalculateRequest["frameMaterial"];
  energyStandard: CalculateRequest["energyStandard"];
  heatingType: CalculateRequest["heatingType"];
  buildingForm: CalculateRequest["buildingForm"];
  urbanContext: CalculateRequest["urbanContext"];
  proxyProfile: ProxyProfile | "custom";
  specificEnergyUseKwhM2Year: string;
  wallUValue: string;
  roofUValue: string;
  windowUValue: string;
  estimatedResidents: string;
  estimatedWorkers: string;
  siteAreaM2: string;
  floorsAboveGround: string;
  basementFloors: string;
  buildingFootprintM2: string;
  glazingRatioPct: string;
  parkingSpaces: string;
  parkingStructureType: NonNullable<CalculateRequest["parkingStructureType"]>;
  parkingGarageFloors: string;
  siteLat: string;
  siteLon: string;
  distanceToTransitStopM: string;
  distanceToRailStationM: string;
  departuresPerHour: string;
  landType: NonNullable<CalculateRequest["landType"]>;
  groundCondition: NonNullable<CalculateRequest["groundCondition"]>;
  foundationType: NonNullable<CalculateRequest["foundationType"]>;
  interventionType: NonNullable<CalculateRequest["interventionType"]>;
  existingGrossFloorAreaM2: string;
  existingBuildYear: string;
  existingFrameMaterial: CalculateRequest["frameMaterial"];
  existingEnergyStandard: CalculateRequest["energyStandard"];
  existingSpecificEnergyUseKwhM2Year: string;
  retrofitDepth: NonNullable<CalculateRequest["retrofitDepth"]>;
  retainedStructureSharePct: string;
  addedGrossFloorAreaM2: string;
  addedFloors: string;
}

const STOCKHOLM_LOCATION_PRESET = {
  lat: "59.3293",
  lon: "18.0686"
} as const;

const initialForm: FormState = {
  buildingType: "flerbostadshus",
  grossFloorAreaM2: "",
  buildYear: "",
  frameMaterial: "betong",
  energyStandard: "normal",
  heatingType: "fjarrvarme",
  buildingForm: "normal",
  urbanContext: "urban",
  proxyProfile: "custom",
  specificEnergyUseKwhM2Year: "",
  wallUValue: "",
  roofUValue: "",
  windowUValue: "",
  estimatedResidents: "",
  estimatedWorkers: "",
  siteAreaM2: "",
  floorsAboveGround: "",
  basementFloors: "",
  buildingFootprintM2: "",
  glazingRatioPct: "",
  parkingSpaces: "",
  parkingStructureType: "none",
  parkingGarageFloors: "",
  siteLat: "",
  siteLon: "",
  distanceToTransitStopM: "",
  distanceToRailStationM: "",
  departuresPerHour: "",
  landType: "tidigare_bebyggd",
  groundCondition: "normal_mark",
  foundationType: "platta_pa_mark",
  interventionType: "nybyggnad",
  existingGrossFloorAreaM2: "",
  existingBuildYear: "",
  existingFrameMaterial: "betong",
  existingEnergyStandard: "normal",
  existingSpecificEnergyUseKwhM2Year: "",
  retrofitDepth: "medium",
  retainedStructureSharePct: "",
  addedGrossFloorAreaM2: "",
  addedFloors: ""
};

function createDraftForm(seed?: Partial<FormState>): FormState {
  const form: FormState = {
    ...initialForm,
    buildingType: "flerbostadshus",
    grossFloorAreaM2: "1200",
    buildYear: "2032",
    frameMaterial: "betong",
    energyStandard: "normal",
    heatingType: "fjarrvarme",
    buildingForm: "normal",
    urbanContext: "urban",
    parkingStructureType: "none",
    groundCondition: "normal_mark",
    basementFloors: "",
    ...seed
  };

  return applyBuildingTypePresetToForm(form, form.buildingType);
}

function applyBuildingTypePresetToForm(form: FormState, buildingType: FormState["buildingType"]) {
  const preset = BUILDING_TYPE_PRESETS[buildingType];

  return {
    ...form,
    buildingType,
    buildingForm: form.buildingForm === initialForm.buildingForm ? preset.buildingForm : form.buildingForm,
    urbanContext: form.urbanContext === initialForm.urbanContext ? preset.urbanContext : form.urbanContext,
    floorsAboveGround:
      form.floorsAboveGround === initialForm.floorsAboveGround
        ? String(preset.floorsAboveGround)
        : form.floorsAboveGround,
    parkingStructureType:
      form.parkingStructureType === initialForm.parkingStructureType
        ? preset.parkingStructureType
        : form.parkingStructureType,
    parkingGarageFloors:
      form.parkingStructureType === "none"
        ? ""
        : form.parkingGarageFloors === initialForm.parkingGarageFloors
          ? String(preset.parkingGarageFloors)
          : form.parkingGarageFloors
  };
}

function applyProxyProfileToForm(form: FormState, proxyProfile: FormState["proxyProfile"]): FormState {
  if (proxyProfile === "custom") {
    return {
      ...form,
      proxyProfile
    };
  }

  if (proxyProfile === "bestPractice") {
    return {
      ...form,
      proxyProfile,
      buildingForm: "kompakt",
      urbanContext: "stockholm_innerstad",
      landType: "tidigare_bebyggd",
      groundCondition: "berg_fastmark",
      foundationType: "platta_pa_mark",
      basementFloors: "",
      parkingStructureType: "none",
      parkingGarageFloors: ""
    };
  }

  if (proxyProfile === "conservative") {
    return {
      ...form,
      proxyProfile,
      buildingForm: "fragmenterad",
      urbanContext: "suburban",
      landType: "gronyta",
      groundCondition: "fyllning_osaker",
      foundationType: "palar",
      basementFloors: "",
      parkingStructureType: "garage_under_mark",
      parkingGarageFloors: form.parkingStructureType === "none" ? "2" : form.parkingGarageFloors || "2"
    };
  }

  return {
    ...form,
    proxyProfile,
    buildingForm: "normal",
    urbanContext: "urban",
    landType: "tidigare_bebyggd",
    groundCondition: "normal_mark",
    foundationType: "platta_pa_mark",
    basementFloors: "",
    parkingStructureType: "none",
    parkingGarageFloors: ""
  };
}

const PROXY_PROFILE_SENSITIVE_FIELDS = new Set<keyof FormState>([
  "buildingForm",
  "urbanContext",
  "landType",
  "groundCondition",
  "foundationType",
  "basementFloors",
  "parkingStructureType",
  "parkingGarageFloors"
]);

function getProxyProfileBadge(profile: FormState["proxyProfile"]) {
  if (profile === "bestPractice") {
    return "Best practice";
  }

  if (profile === "conservative") {
    return "Konservativ";
  }

  if (profile === "custom") {
    return "Anpassad";
  }

  return LABELS.proxyProfile[profile];
}

function toNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  return Number(value.replace(",", "."));
}

function payloadToForm(payload?: CalculateRequest): FormState {
  if (!payload) {
    return initialForm;
  }

  return {
    buildingType: payload.buildingType,
    grossFloorAreaM2: String(payload.grossFloorAreaM2 ?? ""),
    buildYear: String(payload.buildYear ?? ""),
    frameMaterial: payload.frameMaterial,
    energyStandard: payload.energyStandard,
    heatingType: payload.heatingType,
    buildingForm: payload.buildingForm ?? "normal",
    urbanContext: payload.urbanContext ?? "urban",
    proxyProfile: payload.proxyProfile ?? "custom",
    specificEnergyUseKwhM2Year: payload.specificEnergyUseKwhM2Year
      ? String(payload.specificEnergyUseKwhM2Year)
      : "",
    wallUValue: payload.uValues?.yttervagg ? String(payload.uValues.yttervagg) : "",
    roofUValue: payload.uValues?.tak ? String(payload.uValues.tak) : "",
    windowUValue: payload.uValues?.fonster ? String(payload.uValues.fonster) : "",
    estimatedResidents: payload.estimatedResidents ? String(payload.estimatedResidents) : "",
    estimatedWorkers: payload.estimatedWorkers ? String(payload.estimatedWorkers) : "",
    siteAreaM2: payload.siteAreaM2 ? String(payload.siteAreaM2) : "",
    floorsAboveGround: payload.floorsAboveGround ? String(payload.floorsAboveGround) : "",
    buildingFootprintM2: payload.buildingFootprintM2 ? String(payload.buildingFootprintM2) : "",
    basementFloors: payload.basementFloors ? String(payload.basementFloors) : "",
    glazingRatioPct: payload.glazingRatioPct ? String(payload.glazingRatioPct) : "",
    parkingSpaces: payload.parkingSpaces ? String(payload.parkingSpaces) : "",
    parkingStructureType: payload.parkingStructureType ?? "none",
    parkingGarageFloors: payload.parkingGarageFloors ? String(payload.parkingGarageFloors) : "",
    siteLat: payload.siteLocation ? String(payload.siteLocation.lat) : "",
    siteLon: payload.siteLocation ? String(payload.siteLocation.lon) : "",
    distanceToTransitStopM: payload.transitOverrides?.distanceToTransitStopM
      ? String(payload.transitOverrides.distanceToTransitStopM)
      : "",
    distanceToRailStationM: payload.transitOverrides?.distanceToRailStationM
      ? String(payload.transitOverrides.distanceToRailStationM)
      : "",
    departuresPerHour: payload.transitOverrides?.departuresPerHour
      ? String(payload.transitOverrides.departuresPerHour)
      : "",
    landType: payload.landType ?? "tidigare_bebyggd",
    groundCondition: payload.groundCondition ?? "normal_mark",
    foundationType: payload.foundationType ?? "platta_pa_mark",
    interventionType: payload.interventionType ?? "nybyggnad",
    existingGrossFloorAreaM2: payload.existingBuilding?.grossFloorAreaM2
      ? String(payload.existingBuilding.grossFloorAreaM2)
      : "",
    existingBuildYear: payload.existingBuilding?.buildYear
      ? String(payload.existingBuilding.buildYear)
      : "",
    existingFrameMaterial: payload.existingBuilding?.frameMaterial ?? "betong",
    existingEnergyStandard: payload.existingBuilding?.energyStandard ?? "normal",
    existingSpecificEnergyUseKwhM2Year: payload.existingBuilding?.specificEnergyUseKwhM2Year
      ? String(payload.existingBuilding.specificEnergyUseKwhM2Year)
      : "",
    retrofitDepth: payload.retrofitDepth ?? "medium",
    retainedStructureSharePct: payload.retainedStructureSharePct
      ? String(payload.retainedStructureSharePct)
      : "",
    addedGrossFloorAreaM2: payload.addedGrossFloorAreaM2
      ? String(payload.addedGrossFloorAreaM2)
      : "",
    addedFloors: payload.addedFloors ? String(payload.addedFloors) : ""
  };
}

function buildPayload(form: FormState) {
  const grossFloorAreaM2 = Number(form.grossFloorAreaM2);
  const buildYear = Number(form.buildYear);

  if (!grossFloorAreaM2 || grossFloorAreaM2 <= 0) {
    throw new Error("Ange en giltig bruttoarea i kvadratmeter.");
  }

  if (!buildYear || buildYear < 1850 || buildYear > 2100) {
    throw new Error("Ange ett giltigt byggår mellan 1850 och 2100.");
  }

  const payload: CalculateRequest = {
    buildingType: form.buildingType,
    grossFloorAreaM2,
    buildYear,
    frameMaterial: form.frameMaterial,
    energyStandard: form.energyStandard,
    heatingType: form.heatingType
  };

  payload.buildingForm = form.buildingForm;
  payload.urbanContext = form.urbanContext;
  if (form.proxyProfile !== "custom") {
    payload.proxyProfile = form.proxyProfile;
  }

  const specificEnergyUseKwhM2Year = toNumber(form.specificEnergyUseKwhM2Year);
  if (specificEnergyUseKwhM2Year !== undefined) {
    payload.specificEnergyUseKwhM2Year = specificEnergyUseKwhM2Year;
  }

  const estimatedResidents = toNumber(form.estimatedResidents);
  if (estimatedResidents !== undefined) {
    payload.estimatedResidents = estimatedResidents;
  }

  const estimatedWorkers = toNumber(form.estimatedWorkers);
  if (estimatedWorkers !== undefined) {
    payload.estimatedWorkers = estimatedWorkers;
  }

  const siteAreaM2 = toNumber(form.siteAreaM2);
  if (siteAreaM2 !== undefined) {
    payload.siteAreaM2 = siteAreaM2;
  }

  const floorsAboveGround = toNumber(form.floorsAboveGround);
  if (floorsAboveGround !== undefined) {
    payload.floorsAboveGround = floorsAboveGround;
  }

  const buildingFootprintM2 = toNumber(form.buildingFootprintM2);
  if (buildingFootprintM2 !== undefined) {
    payload.buildingFootprintM2 = buildingFootprintM2;
  }

  const basementFloors = toNumber(form.basementFloors);
  if (form.foundationType === "kallare" && basementFloors !== undefined) {
    payload.basementFloors = basementFloors;
  }

  const glazingRatioPct = toNumber(form.glazingRatioPct);
  if (glazingRatioPct !== undefined) {
    payload.glazingRatioPct = glazingRatioPct;
  }

  const parkingSpaces = toNumber(form.parkingSpaces);
  if (parkingSpaces !== undefined) {
    payload.parkingSpaces = parkingSpaces;
  }

  payload.parkingStructureType = form.parkingStructureType;

  const parkingGarageFloors = toNumber(form.parkingGarageFloors);
  if (form.parkingStructureType !== "none" && parkingGarageFloors !== undefined) {
    payload.parkingGarageFloors = parkingGarageFloors;
  }

  const siteLat = toNumber(form.siteLat);
  const siteLon = toNumber(form.siteLon);
  if (siteLat !== undefined && siteLon !== undefined) {
    payload.siteLocation = {
      lat: siteLat,
      lon: siteLon
    };
  }

  const distanceToTransitStopM = toNumber(form.distanceToTransitStopM);
  const distanceToRailStationM = toNumber(form.distanceToRailStationM);
  const departuresPerHour = toNumber(form.departuresPerHour);
  if (
    distanceToTransitStopM !== undefined ||
    distanceToRailStationM !== undefined ||
    departuresPerHour !== undefined
  ) {
    payload.transitOverrides = {
      distanceToTransitStopM,
      distanceToRailStationM,
      departuresPerHour
    };
  }

  payload.landType = form.landType;
  payload.groundCondition = form.groundCondition;
  payload.foundationType = form.foundationType;
  payload.interventionType = form.interventionType;

  const retainedStructureSharePct = toNumber(form.retainedStructureSharePct);
  if (retainedStructureSharePct !== undefined) {
    payload.retainedStructureSharePct = retainedStructureSharePct;
  }

  const addedGrossFloorAreaM2 = toNumber(form.addedGrossFloorAreaM2);
  if (addedGrossFloorAreaM2 !== undefined) {
    payload.addedGrossFloorAreaM2 = addedGrossFloorAreaM2;
  }

  const addedFloors = toNumber(form.addedFloors);
  if (addedFloors !== undefined) {
    payload.addedFloors = addedFloors;
  }

  payload.retrofitDepth = form.retrofitDepth;

  const existingGrossFloorAreaM2 = toNumber(form.existingGrossFloorAreaM2);
  const existingBuildYear = toNumber(form.existingBuildYear);
  const existingSpecificEnergyUseKwhM2Year = toNumber(form.existingSpecificEnergyUseKwhM2Year);
  if (
    existingGrossFloorAreaM2 !== undefined &&
    existingBuildYear !== undefined &&
    form.interventionType !== "nybyggnad"
  ) {
    payload.existingBuilding = {
      grossFloorAreaM2: existingGrossFloorAreaM2,
      buildYear: existingBuildYear,
      frameMaterial: form.existingFrameMaterial,
      energyStandard: form.existingEnergyStandard,
      specificEnergyUseKwhM2Year: existingSpecificEnergyUseKwhM2Year
    };
  }

  const uValues = {
    yttervagg: toNumber(form.wallUValue),
    tak: toNumber(form.roofUValue),
    fonster: toNumber(form.windowUValue)
  };

  if (Object.values(uValues).some((value) => value !== undefined)) {
    payload.uValues = uValues;
  }

  return payload;
}

function downloadFile(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportResultToCsv(fileName: string, result: CalculationResult) {
  const rows = [
    ["metric", "value", "unit"],
    ["total", String(result.totals.value), result.totals.unit],
    ["perM2", String(result.perM2.value), result.perM2.unit],
    ["perPerson", String(result.perPerson.value), result.perPerson.unit],
    ["mobilityAnnual", String(result.mobility.annualKgCo2e), "kg CO2e/år"],
    ["mobilityLifetime", String(result.mobility.lifetimeKgCo2e), "kg CO2e"],
    ...result.topDrivers.map((driver) => [
      `driver:${driver.label}`,
      String(driver.impactKgCo2e),
      "kg CO2e"
    ]),
    ...result.assumptions.map((assumption) => [
      `assumption:${assumption.label}`,
      assumption.value,
      ""
    ])
  ];

  const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  downloadFile(fileName, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function exportResultToPng(fileName: string, result: CalculationResult, title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.fillStyle = "#f4efe5";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#1f1a17";
  context.font = "bold 42px Avenir Next";
  context.fillText(title, 72, 88);
  context.font = "24px Avenir Next";
  context.fillStyle = "#4c4a45";
  context.fillText(`Totalt: ${formatNumber(result.totals.value)} ${result.totals.unit}`, 72, 168);
  context.fillText(`Per m2: ${formatNumber(result.perM2.value)} ${result.perM2.unit}`, 72, 214);
  context.fillText(
    `Per person: ${formatNumber(result.perPerson.value)} ${result.perPerson.unit}`,
    72,
    260
  );
  context.fillText(
    `Mobilitet livslängd: ${formatNumber(result.mobility.lifetimeKgCo2e)} kg CO2e`,
    72,
    306
  );
  context.fillStyle = "#1d6a55";
  context.font = "bold 28px Avenir Next";
  context.fillText("Största utsläppsdrivare", 72, 360);
  context.font = "22px Avenir Next";
  context.fillStyle = "#1f1a17";

  result.topDrivers.slice(0, 4).forEach((driver, index) => {
    context.fillText(
      `${index + 1}. ${driver.label}: ${formatNumber(driver.impactKgCo2e)} kg CO2e`,
      72,
      410 + index * 44
    );
  });

  canvas.toBlob((blob) => {
    if (blob) {
      downloadFile(fileName, blob);
    }
  }, "image/png");
}

function getMethodStatus(result: CalculationResult) {
  const counters = {
    standard: 0,
    official: 0,
    proxy: 0
  };

  for (const explanation of result.explanations) {
    const primary = explanation.evidence[0]?.evidenceType;

    if (primary === "standard") {
      counters.standard += 1;
    } else if (primary === "official-statistic" || primary === "provider-data") {
      counters.official += 1;
    } else if (primary) {
      counters.proxy += 1;
    }
  }

  return counters;
}

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

function categoryTraceKey(traceKey: string) {
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

function InputCatalog({ result }: { result: CalculationResult }) {
  const entries = result.explanations.filter(
    (entry) =>
      categoryTraceKey(entry.traceKey) &&
      !entry.traceKey.startsWith("benchmark.")
  );

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Indata och källspår</p>
        <h3>Vilka värden som användes i varje kategori</h3>
      </div>
      <div className="input-catalog">
        {entries.map((entry) => (
          <article key={entry.id} className="input-card">
            <div className="input-card-header">
              <strong>{entry.title}</strong>
              <span>{entry.traceKey}</span>
            </div>
            <p className="microcopy">{entry.summary}</p>
            <ul className="input-list">
              {entry.inputs.map((input) => (
                <li key={`${entry.id}-${input.key}`}>
                  <div className="input-list-row">
                    <strong>{input.label}</strong>
                    <span>{input.value}</span>
                  </div>
                  <div className="input-meta">
                    <span className={`input-origin input-origin-${input.source}`}>
                      {sourceLabel(input.source)}
                    </span>
                    <span className={`input-origin input-origin-${getInputUncertaintyLevel(input.source)}`}>
                      {getInputUncertaintyLabel(input.source)}
                    </span>
                    <span>
                      Källa:{" "}
                      {input.source === "user"
                        ? "Användaren"
                        : input.source === "derived"
                          ? entry.evidence[0]?.title ?? "Härlett från modellregler"
                          : entry.evidence[0]?.title ?? "Intern modellprofil"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {entry.evidence.length ? (
              <div className="input-evidence">
                <strong>Kopplade källor</strong>
                <ul className="drawer-list">
                  {entry.evidence.map((evidence) => (
                    <li key={`${entry.id}-${evidence.methodId}`}>
                      <a href={evidence.url} target="_blank" rel="noreferrer">
                        {evidence.title}
                      </a>
                      <span>
                        {LABELS.evidenceType[evidence.evidenceType]} • {evidence.publisher} •{" "}
                        {evidence.versionOrYear}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
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

  return result.perHa?.value ?? 0;
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
  return roundMetric(perM2Value * derivedArea);
}

function getStandardMetricValue(profile: StandardProfile, metric: ComparisonMetric) {
  return profile.metrics[metric];
}

function roundMetric(value: number) {
  return Math.round(value);
}

function getMetricLabel(metric: ComparisonMetric) {
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

function formatRunTimestamp(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function resolveSourceTitles(sourceIds: string[], dataSources?: DataSourcesResponse | null) {
  if (!dataSources) {
    return [];
  }

  return sourceIds
    .map((sourceId) => dataSources.sources.find((source) => source.id === sourceId)?.title)
    .filter((title): title is string => Boolean(title));
}

function getBenchmarkStatusClass(status: BenchmarkComparison["status"]) {
  if (status === "below") {
    return "comparison-status comparison-status-good";
  }

  if (status === "above") {
    return "comparison-status comparison-status-warn";
  }

  return "comparison-status comparison-status-neutral";
}

function getRunDriverChanges(baseResult: CalculationResult, candidateResult: CalculationResult) {
  const labels = new Set([
    ...baseResult.topDrivers.map((driver) => driver.label),
    ...candidateResult.topDrivers.map((driver) => driver.label)
  ]);

  return Array.from(labels)
    .map((label) => {
      const baseDriver = baseResult.topDrivers.find((driver) => driver.label === label);
      const candidateDriver = candidateResult.topDrivers.find((driver) => driver.label === label);
      const baseValue = baseDriver?.impactKgCo2e ?? 0;
      const candidateValue = candidateDriver?.impactKgCo2e ?? 0;
      return {
        label,
        delta: candidateValue - baseValue,
        candidateValue,
        explanation: candidateDriver?.explanation ?? baseDriver?.explanation ?? "Ingen kommentar."
      };
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 4);
}

type AppRoute =
  | { kind: "home" }
  | { kind: "quick" }
  | { kind: "scenario" }
  | { kind: "analysis"; scenarioId: string; runId?: string };

function parseAppRoute(pathname: string, search: string): AppRoute {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "analysis" && segments[1]) {
    const params = new URLSearchParams(search);
    return {
      kind: "analysis",
      scenarioId: decodeURIComponent(segments[1]),
      runId: params.get("runId") ?? undefined
    };
  }

  if (segments[0] === "quickcalc" || segments[0] === "quick") {
    return { kind: "quick" };
  }

  if (segments[0] === "scenario" || segments[0] === "workspace") {
    return { kind: "scenario" };
  }

  return { kind: "home" };
}

function buildAnalysisPath(scenarioId: string, runId?: string) {
  const params = new URLSearchParams();

  if (runId) {
    params.set("runId", runId);
  }

  const query = params.toString();
  return `/analysis/${encodeURIComponent(scenarioId)}${query ? `?${query}` : ""}`;
}

function buildScenarioPath() {
  return "/scenario";
}

function buildQuickPath() {
  return "/quickcalc";
}

function buildHomePath() {
  return "/";
}

type WorkflowRegistryCard = {
  order: number;
  id: string;
  title: string;
  summary: string;
  codeState: string;
  uiState: string;
  deployState: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

function ScenarioComparisonBoard({
  id,
  project,
  benchmarkProfiles,
  standardProfiles,
  selectedBenchmarkIds,
  selectedStandardIds,
  selectedMetric,
  focusScenarioId,
  onToggleBenchmark,
  onToggleStandard,
  onMetricChange
}: {
  id?: string;
  project: Project | null;
  benchmarkProfiles: BenchmarkProfile[];
  standardProfiles: StandardProfile[];
  selectedBenchmarkIds: string[];
  selectedStandardIds: string[];
  selectedMetric: ComparisonMetric;
  focusScenarioId?: string;
  onToggleBenchmark: (benchmarkId: string) => void;
  onToggleStandard: (standardId: string) => void;
  onMetricChange: (metric: ComparisonMetric) => void;
}) {
  const scenarios = project?.scenarios.filter((scenario) => scenario.latestResult) ?? [];

  const focusScenario =
    scenarios.find((scenario) => scenario.id === focusScenarioId) ?? scenarios[0];
  const focusResult = focusScenario?.latestResult as CalculationResult | undefined;
  const selectedBenchmarks = benchmarkProfiles.filter((profile) =>
    selectedBenchmarkIds.includes(profile.id)
  );
  const selectedStandards = standardProfiles.filter((profile) =>
    selectedStandardIds.includes(profile.id)
  );
  const benchmarkRows = selectedBenchmarks.flatMap((profile) => {
    const referenceRows: Array<{
      id: string;
      label: string;
      value: number;
      unit: string;
      kind: "normal" | "target";
    }> = [];
    const baseResult = focusResult;

    if (!baseResult) {
      return referenceRows;
    }

    const normalValue = getBenchmarkMetricValue(
      profile,
      selectedMetric,
      "Normalvärde",
      baseResult
    );
    if (normalValue !== undefined) {
      referenceRows.push({
        id: `${profile.id}-normal`,
        label: `${profile.name} • Normalvärde`,
        value: normalValue,
        unit: getScenarioMetricUnit(baseResult, selectedMetric),
        kind: "normal"
      });
    }

    const targetValue = getBenchmarkMetricValue(profile, selectedMetric, "Målvärde", baseResult);
    if (targetValue !== undefined) {
      referenceRows.push({
        id: `${profile.id}-target`,
        label: `${profile.name} • Målvärde`,
        value: targetValue,
        unit: getScenarioMetricUnit(baseResult, selectedMetric),
        kind: "target"
      });
    }

    return referenceRows;
  });
  const standardRows = selectedStandards
    .filter((profile) => {
      if (!focusResult) {
        return false;
      }

      const buildingType = focusScenario?.quickInput?.buildingType;
      const interventionType = focusScenario?.quickInput?.interventionType ?? "nybyggnad";

      return (
        getStandardMetricValue(profile, selectedMetric) !== undefined &&
        (!buildingType || profile.applicableBuildingTypes.includes(buildingType)) &&
        profile.applicableInterventions.includes(interventionType)
      );
    })
    .map((profile) => ({
      id: profile.id,
      label: profile.label,
      value: getStandardMetricValue(profile, selectedMetric) ?? 0,
      unit: focusResult ? getScenarioMetricUnit(focusResult, selectedMetric) : "kg CO2e",
      kind: "standard" as const,
      summary: profile.summary,
      scheme: LABELS.standardScheme[profile.scheme]
    }));
  const allValues = [
    ...scenarios.map((scenario) =>
      getScenarioMetricValue(scenario.latestResult as CalculationResult, selectedMetric)
    ),
    ...benchmarkRows.map((row) => row.value),
    ...standardRows.map((row) => row.value)
  ];
  const maxValue = Math.max(...allValues, 1);
  const hasComparableScenarios = scenarios.length >= 2;

  return (
    <section className="panel panel-soft" id={id}>
      <div className="section-heading">
        <p className="eyebrow">Jämförelsevy</p>
        <h3>Flera varianter mot flera benchmarkprofiler</h3>
      </div>

      {!hasComparableScenarios ? (
        <div className="empty-state-workbench">
          <article className="inline-panel">
            <strong>Jämförelse väntar på fler scenarier</strong>
            <span>
              {project?.scenarios.length
                ? "Skapa eller duplicera ett andra beräknat scenario för att låsa upp sida vid sida-jämförelse."
                : "Skapa först ett projekt och ett scenario, sedan kan du jämföra flera alternativ här."}
            </span>
            <span>
              Den här ytan är redan byggd och synlig, men kräver minst två beräknade scenarier för att bli fullt aktiv.
            </span>
          </article>
          <div className="decision-actions">
            <button type="button" className="ghost-button" disabled>
              Välj fokusscenario
            </button>
            <button type="button" className="ghost-button" disabled>
              Lägg till benchmark
            </button>
            <button type="button" className="submit-button" disabled>
              Jämför scenarier
            </button>
          </div>
        </div>
      ) : null}

      <div className="comparison-toolbar">
        <div className="segmented-control" role="tablist" aria-label="Jämförelsemått">
          {COMPARISON_METRICS.map((metric) => (
            <button
              key={metric}
              type="button"
              className={`pill-button ${selectedMetric === metric ? "pill-button-active" : ""}`}
              onClick={() => onMetricChange(metric)}
            >
              {getMetricLabel(metric)}
            </button>
          ))}
        </div>
        <div className="benchmark-pills" aria-label="Benchmarkprofiler">
          {benchmarkProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`pill-button ${selectedBenchmarkIds.includes(profile.id) ? "pill-button-active" : ""}`}
              onClick={() => onToggleBenchmark(profile.id)}
            >
              {profile.name}
            </button>
          ))}
        </div>
        <div className="benchmark-pills" aria-label="Standardprofiler">
          {standardProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`pill-button ${selectedStandardIds.includes(profile.id) ? "pill-button-active" : ""}`}
              onClick={() => onToggleStandard(profile.id)}
            >
              {profile.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bars comparison-bars">
        {scenarios.map((scenario) => {
          const result = scenario.latestResult as CalculationResult;
          const value = getScenarioMetricValue(result, selectedMetric);
          const baseValue = focusResult ? getScenarioMetricValue(focusResult, selectedMetric) : value;
          const delta = value - baseValue;

          return (
            <div
              key={scenario.id}
              className={`bar-row comparison-visual-row ${
                scenario.id === focusScenario?.id ? "comparison-visual-row-active" : ""
              }`}
            >
              <div className="bar-copy">
                <strong>{scenario.name}</strong>
                <span>
                  {formatNumber(value)} {getScenarioMetricUnit(result, selectedMetric)}
                  {scenario.id !== focusScenario?.id ? ` • ${delta > 0 ? "+" : ""}${formatNumber(delta)}` : " • Bas"}
                </span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max(6, (value / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}

        {benchmarkRows.map((row) => (
          <div
            key={row.id}
            className={`bar-row comparison-visual-row comparison-visual-row-benchmark comparison-visual-row-${row.kind}`}
          >
            <div className="bar-copy">
              <strong>{row.label}</strong>
              <span>
                {formatNumber(row.value)} {row.unit}
              </span>
            </div>
            <div className="bar-track comparison-track-benchmark">
              <div
                className="bar-fill comparison-fill-benchmark"
                style={{ width: `${Math.max(6, (row.value / maxValue) * 100)}%` }}
              />
            </div>
          </div>
        ))}

        {standardRows.map((row) => (
          <div
            key={row.id}
            className="bar-row comparison-visual-row comparison-visual-row-standard"
          >
            <div className="bar-copy">
              <strong>{row.label}</strong>
              <span>
                {formatNumber(row.value)} {row.unit} • {row.scheme}
              </span>
            </div>
            <div className="bar-track comparison-track-standard">
              <div
                className="bar-fill comparison-fill-standard"
                style={{ width: `${Math.max(6, (row.value / maxValue) * 100)}%` }}
              />
            </div>
            <p className="microcopy">{row.summary}</p>
          </div>
        ))}
      </div>

      <div className="comparison-matrix">
        <div className="comparison-matrix-row comparison-matrix-header">
          <span>Scenario</span>
          <span>Totalt</span>
          <span>Per m2</span>
          <span>Per person</span>
          <span>Per ha</span>
        </div>
        {scenarios.map((scenario) => {
          const result = scenario.latestResult as CalculationResult;
          return (
            <div
              key={scenario.id}
              className={`comparison-matrix-row ${
                scenario.id === focusScenario.id ? "comparison-matrix-row-active" : ""
              }`}
            >
              <strong>{scenario.name}</strong>
              <span>{formatNumber(result.totals.value)}</span>
              <span>{formatNumber(result.perM2.value)}</span>
              <span>{formatNumber(result.perPerson.value)}</span>
              <span>{result.perHa ? formatNumber(result.perHa.value) : "—"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResultMatrix({
  id,
  title,
  scenario,
  result,
  comparison,
  dataSources,
  benchmarkProfiles = [],
  standardProfiles = [],
  selectedBenchmarkIds = [],
  selectedStandardIds = [],
  selectedMetric = "perM2",
  baseRunId,
  candidateRunId,
  onBaseRunChange,
  onCandidateRunChange,
  onOpenAnalysis,
  onExplain
}: {
  id?: string;
  title: string;
  scenario?: Scenario | null;
  result: CalculationResult | null;
  comparison?: ScenarioComparison | null;
  dataSources?: DataSourcesResponse | null;
  benchmarkProfiles?: BenchmarkProfile[];
  standardProfiles?: StandardProfile[];
  selectedBenchmarkIds?: string[];
  selectedStandardIds?: string[];
  selectedMetric?: ComparisonMetric;
  baseRunId?: string;
  candidateRunId?: string;
  onBaseRunChange?: (runId: string) => void;
  onCandidateRunChange?: (runId: string) => void;
  onOpenAnalysis?: (scenarioId: string, runId?: string) => void;
  onExplain?: (traceKey: string) => void;
}) {
  const activeResult = scenario?.latestResult ?? result;

  if (!activeResult) {
    return (
      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Resultat</p>
          <h2>{title}</h2>
        </div>
        <div className="empty-state">
          <strong>Kör en beräkning för att se resultat.</strong>
          <p>Här visas nyckeltal, benchmark, åtgärder, källor och fördelning per kategori.</p>
        </div>
      </section>
    );
  }

  const runs = scenario?.runs ?? [];
  const candidateRun =
    runs.find((run) => run.id === candidateRunId) ?? runs[runs.length - 1] ?? null;
  const baseRun =
    runs.find((run) => run.id === baseRunId) ??
    (runs.length > 1 ? runs[runs.length - 2] : null);
  const candidateResult = candidateRun?.result ?? activeResult;
  const candidateInput =
    candidateRun?.inputSnapshot ?? scenario?.planObjects[0]?.quickInput ?? scenario?.quickInput;
  const methodStatus = getMethodStatus(candidateResult);
  const analysisButton = scenario && onOpenAnalysis ? (
    <div className="result-module-actions">
      <button
        type="button"
        className="ghost-button"
        onClick={() => onOpenAnalysis(scenario.id, candidateRun?.id)}
      >
        Visa analys
      </button>
    </div>
  ) : null;
  const selectedBenchmarks = benchmarkProfiles.filter((profile) =>
    selectedBenchmarkIds.includes(profile.id)
  );
  const standardDataset = dataSources?.datasets.find((dataset) => dataset.dataset === "standard-profiles");
  const applicableStandards = standardProfiles.filter((profile) => {
    const buildingType = candidateInput?.buildingType;
    const interventionType = candidateInput?.interventionType ?? "nybyggnad";
    return (
      (!buildingType || profile.applicableBuildingTypes.includes(buildingType)) &&
      profile.applicableInterventions.includes(interventionType)
    );
  });
  const selectedStandards = applicableStandards.filter((profile) =>
    selectedStandardIds.includes(profile.id)
  );
  const benchmarkRows = [
    {
      id: "actual-run",
      label: candidateRun ? "Aktuell körning" : "Aktuellt resultat",
      value: getScenarioMetricValue(candidateResult, selectedMetric),
      kind: "actual" as const,
      meta: candidateRun ? formatRunTimestamp(candidateRun.createdAt) : "Senaste resultat"
    },
    ...selectedBenchmarks.flatMap((profile) => [
      {
        id: `${profile.id}-normal`,
        label: `${profile.name} normal`,
        value: getBenchmarkMetricValue(profile, selectedMetric, "Normalvärde", candidateResult),
        kind: "benchmark" as const,
        meta: `${profile.sourceLabel} • v${profile.version}`
      },
      {
        id: `${profile.id}-target`,
        label: `${profile.name} mål`,
        value: getBenchmarkMetricValue(profile, selectedMetric, "Målvärde", candidateResult),
        kind: "target" as const,
        meta: `Uppdaterad ${profile.updatedAt}`
      }
    ]),
    ...selectedStandards
      .filter((profile) => getStandardMetricValue(profile, selectedMetric) !== undefined)
      .map((profile) => ({
        id: profile.id,
        label: profile.label,
        value: getStandardMetricValue(profile, selectedMetric) ?? 0,
        kind: "standard" as const,
        meta: `${LABELS.standardScheme[profile.scheme]} ${profile.version}`
      }))
  ].filter((row): row is { id: string; label: string; value: number; kind: "actual" | "benchmark" | "target" | "standard"; meta: string } => row.value !== undefined);
  const trendPoints = runs.map((run) => ({
    id: run.id,
    label: formatRunTimestamp(run.createdAt),
    value: getScenarioMetricValue(run.result, selectedMetric),
    meta:
      run.id === candidateRun?.id
        ? "Aktiv körning"
        : run.id === baseRun?.id
          ? "Bas för jämförelse"
          : "Sparad körning"
  }));
  const benchmarkComparisons = [...candidateResult.vsBenchmark, ...candidateResult.vsTarget].filter(
    (item) => item.metric === selectedMetric
  );
  const runDriverChanges =
    baseRun?.result ? getRunDriverChanges(baseRun.result, candidateResult) : [];
  const lifecycleItems = [
    {
      key: "embodied",
      label: "Embodied",
      value: candidateResult.embodied.totalKgCo2e
    },
    {
      key: "operational",
      label: "Drift över livslängd",
      value: candidateResult.operational.lifetimeKgCo2e
    },
    {
      key: "mobility",
      label: "Mobilitet över livslängd",
      value: candidateResult.mobility.lifetimeKgCo2e
    }
  ];
  const scenarioBuildingForms = Array.from(
    new Set(
      (scenario?.planObjects ?? []).map((planObject) => planObject.quickInput.buildingForm ?? "normal")
    )
  );
  const scenarioUrbanContexts = Array.from(
    new Set(
      (scenario?.planObjects ?? []).map((planObject) => planObject.quickInput.urbanContext ?? "urban")
    )
  );
  const scenarioBuildingFormLabel =
    scenarioBuildingForms.length === 1
      ? LABELS.buildingForm[scenarioBuildingForms[0]]
      : scenarioBuildingForms.length > 1
        ? "Flera byggnadsformer"
        : LABELS.buildingForm[candidateInput?.buildingForm ?? "normal"];
  const scenarioUrbanContextLabel =
    scenarioUrbanContexts.length === 1
      ? LABELS.urbanContext[scenarioUrbanContexts[0]]
      : scenarioUrbanContexts.length > 1
        ? "Flera lägen"
        : LABELS.urbanContext[candidateResult.mobility.inputs.urbanContext];

  return (
    <section className="panel result-module" id={id}>
      <section className="result-module-header">
        <div className="section-heading">
          <p className="eyebrow">Resultat</p>
          <h2>{title}</h2>
        </div>
        {analysisButton}
        <div className="report-kpi-grid">
          <article className="report-kpi">
            <div className="inline-with-action">
              <span>{candidateResult.totals.label}</span>
              {candidateResult.totals.traceKey && onExplain ? (
                <ExplainButton
                  label={candidateResult.totals.label}
                  onClick={() => onExplain(candidateResult.totals.traceKey ?? "totals")}
                />
              ) : null}
            </div>
            <strong>
              {formatNumber(candidateResult.totals.value)} {candidateResult.totals.unit}
            </strong>
            <span>Embodied + drift + mobilitet över livslängd</span>
          </article>
          <article className="report-kpi">
            <div className="inline-with-action">
              <span>{candidateResult.perM2.label}</span>
              {candidateResult.perM2.traceKey && onExplain ? (
                <ExplainButton
                  label={candidateResult.perM2.label}
                  onClick={() => onExplain(candidateResult.perM2.traceKey ?? "perM2")}
                />
              ) : null}
            </div>
            <strong>
              {formatNumber(candidateResult.perM2.value)} {candidateResult.perM2.unit}
            </strong>
            <span>Huvudmått för benchmark i rapportvyn</span>
          </article>
          <article className="report-kpi">
            <div className="inline-with-action">
              <span>{candidateResult.perPerson.label}</span>
              {candidateResult.perPerson.traceKey && onExplain ? (
                <ExplainButton
                  label={candidateResult.perPerson.label}
                  onClick={() => onExplain(candidateResult.perPerson.traceKey ?? "perPerson")}
                />
              ) : null}
            </div>
            <strong>
              {formatNumber(candidateResult.perPerson.value)} {candidateResult.perPerson.unit}
            </strong>
            <span>{candidateResult.population.totalPeople} personer i underlaget</span>
          </article>
          {candidateResult.perHa ? (
            <article className="report-kpi">
              <div className="inline-with-action">
                <span>{candidateResult.perHa.label}</span>
                {candidateResult.perHa.traceKey && onExplain ? (
                  <ExplainButton
                    label={candidateResult.perHa.label}
                    onClick={() => onExplain(candidateResult.perHa?.traceKey ?? "perHa")}
                  />
                ) : null}
              </div>
              <strong>
                {formatNumber(candidateResult.perHa.value)} {candidateResult.perHa.unit}
              </strong>
              <span>Visas när platsyta finns i underlaget</span>
            </article>
          ) : null}
        </div>
      </section>

      <section className="result-section">
        <div className="section-heading">
          <p className="eyebrow">Benchmark</p>
          <h3>Benchmarkstatus och referenser</h3>
        </div>
        <p className="microcopy">{getBenchmarkScopeSummaryCopy(selectedMetric)}</p>
        <div className="report-dual-grid">
          <BenchmarkPositionChart
            title={`Position för ${getMetricLabel(selectedMetric).toLowerCase()}`}
            unit={getScenarioMetricUnit(candidateResult, selectedMetric)}
            rows={benchmarkRows}
            scopeLabel={getResultScopeLabel("total")}
            scopeNote={getBenchmarkScopeDiagramCopy(selectedMetric)}
          />
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Benchmarkstatus</p>
              <h3>Aktuella gap</h3>
            </div>
            <div className="benchmark-scope-copy">
              <span className="scope-badge">Screeningreferenser</span>
              <p className="microcopy">
                Kommunprofiler och standardprofiler är referenser för tidiga skeden, inte
                officiella certifieringsutfall.
              </p>
            </div>
            <div className="comparison-list">
              {benchmarkComparisons.map((item) => (
                <article key={`${item.referenceLabel}-${item.metric}`} className="comparison-card">
                  <strong className="inline-with-action">
                    <span>
                      {item.referenceLabel} • {item.label}
                    </span>
                    {item.traceKey && onExplain ? (
                      <ExplainButton
                        label={`${item.referenceLabel} ${item.label}`}
                        onClick={() => onExplain(item.traceKey ?? "perM2")}
                      />
                    ) : null}
                  </strong>
                  <span>
                    Utfall {formatNumber(item.actualValue)} mot referens {formatNumber(item.referenceValue)}
                  </span>
                  <span className={getBenchmarkStatusClass(item.status)}>
                    {item.delta > 0 ? "+" : ""}
                    {formatNumber(item.delta)} ({item.deltaPct}%)
                  </span>
                </article>
              ))}
            </div>
            <div className="report-table">
              {selectedBenchmarks.map((profile) => (
                <div key={profile.id} className="report-table-row">
                  <strong>{profile.name}</strong>
                  <span>
                    {getBenchmarkReferenceTypeLabel(profile)} • {profile.applicability}
                  </span>
                  <span>
                    {profile.sourceLabel} • v{profile.version} • {profile.updatedAt}
                  </span>
                  <span>{getBenchmarkCoverageLabel(profile)}</span>
                </div>
              ))}
              {selectedStandards.map((profile) => (
                <div key={profile.id} className="report-table-row">
                  <strong>{profile.label}</strong>
                  <span>
                    {getBenchmarkReferenceTypeLabel(profile)} • {profile.version} • {profile.level}
                  </span>
                  <span>
                    {resolveSourceTitles(profile.sourceIds, dataSources).join(", ") || "Bundlad referenskälla"}
                    {standardDataset ? ` • uppdaterad ${standardDataset.updatedAt}` : ""}
                  </span>
                  <span>{getBenchmarkCoverageLabel(profile)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="result-section">
        <div className="section-heading">
          <p className="eyebrow">Form och läge</p>
          <h3>Byggnadsform, kompakthet och site / läge</h3>
        </div>
        <div className="comparison-list">
          <article className="comparison-card">
            <strong>Byggnadsform</strong>
            <span>{scenarioBuildingFormLabel}</span>
            <span>Formfaktorn används som en screeningproxy för hur kompakt byggnaden är.</span>
          </article>
          <article className="comparison-card">
            <strong>Lägesprofil</strong>
            <span>{scenarioUrbanContextLabel}</span>
            <span>Centralare lägen och bättre serviceaccess ger lägre bilanvändning i modellen.</span>
          </article>
          <article className="comparison-card">
            <strong>Tillgänglighet</strong>
            <span>{candidateResult.mobility.inputs.accessibilityBand}</span>
            <span>Bandad proxy baserad på transitavstånd och avgångsfrekvens.</span>
          </article>
        </div>
      </section>

      <section className="result-section">
        <div className="section-heading">
          <p className="eyebrow">Körningsjämförelse</p>
          <h3>Jämför två sparade körningar</h3>
        </div>
        {runs.length >= 2 ? (
          <>
            <div className="report-controls">
              <label>
                Bas körning
                <select
                  value={baseRun?.id ?? ""}
                  onChange={(event) => onBaseRunChange?.(event.target.value)}
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {formatRunTimestamp(run.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kandidatkörning
                <select
                  value={candidateRun?.id ?? ""}
                  onChange={(event) => onCandidateRunChange?.(event.target.value)}
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {formatRunTimestamp(run.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {baseRun ? (
              <div className="report-table">
                {COMPARISON_METRICS.filter(
                  (metric) =>
                    metric !== "perHa" || (baseRun.result.perHa && candidateResult.perHa)
                ).map((metric) => {
                  const baseValue = getScenarioMetricValue(baseRun.result, metric);
                  const candidateValue = getScenarioMetricValue(candidateResult, metric);
                  const delta = candidateValue - baseValue;
                  return (
                    <div key={metric} className="report-table-row">
                      <strong>{getMetricLabel(metric)}</strong>
                      <span>
                        {formatNumber(baseValue)} → {formatNumber(candidateValue)}{" "}
                        {getScenarioMetricUnit(candidateResult, metric)}
                      </span>
                      <span>{delta > 0 ? "+" : ""}{formatNumber(delta)}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="comparison-list">
              {runDriverChanges.map((driver) => (
                <article key={driver.label} className="comparison-card">
                  <strong>{driver.label}</strong>
                  <span>{driver.explanation}</span>
                  <span>{driver.delta > 0 ? "+" : ""}{formatNumber(driver.delta)} kg CO2e</span>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>Minst två körningar behövs för att jämföra över tid.</strong>
            <p>När scenariot beräknas flera gånger sparas varje körning automatiskt här.</p>
          </div>
        )}

        {comparison ? (
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Scenario mot scenario</p>
              <h3>Separat jämförelse mellan alternativ</h3>
            </div>
            <div className="comparison-list">
              {comparison.metrics.map((metric) => (
                <article key={metric.metric} className="comparison-card">
                  <strong>{getMetricLabel(metric.metric)}</strong>
                  <span>
                    Bas {formatNumber(metric.baseValue)} → Kandidat {formatNumber(metric.candidateValue)}
                  </span>
                  <span>{metric.delta > 0 ? "+" : ""}{formatNumber(metric.delta)} ({metric.deltaPct}%)</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <section className="result-section">
        <div className="section-heading">
          <p className="eyebrow">Diagram</p>
          <h3>Trend och fördelning</h3>
        </div>
        <div className="report-dual-grid">
          <RunTrendChart
            title={`Utveckling över sparade körningar (${getMetricLabel(selectedMetric).toLowerCase()})`}
            unit={getScenarioMetricUnit(candidateResult, selectedMetric)}
            points={trendPoints}
          />
          <LifecycleShareChart title="Livscykelfördelning" items={lifecycleItems} />
        </div>
        <div className="details-grid">
          <BreakdownChart
            title="Embodied klimatpåverkan"
            items={candidateResult.embodied.breakdown}
            scopeLabel={getResultScopeLabel("embodied")}
            scopeNote={getResultScopeNote("embodied")}
            onExplain={onExplain}
          />
          <BreakdownChart
            title="Driftutsläpp per år"
            items={candidateResult.operational.breakdown}
            scopeLabel={getResultScopeLabel("operational")}
            scopeNote={getResultScopeNote("operational")}
            onExplain={onExplain}
          />
          <BreakdownChart
            title="Mobilitet per år"
            items={candidateResult.mobility.breakdown}
            scopeLabel={getResultScopeLabel("mobility")}
            scopeNote={getResultScopeNote("mobility")}
            onExplain={onExplain}
          />
        </div>
      </section>

      <section className="result-section">
        <div className="section-heading">
          <p className="eyebrow">Drivare</p>
          <h3>Utsläppsdrivare och rekommenderade åtgärder</h3>
        </div>
        <div className="report-dual-grid">
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Beslutsstöd</p>
              <h3>Största utsläppsdrivare</h3>
            </div>
            <ul className="insight-list">
              {candidateResult.topDrivers.map((driver) => (
                <li key={driver.key}>
                  <strong className="inline-with-action">
                    <span>
                      {driver.label} • {formatNumber(driver.impactKgCo2e)} kg CO2e
                    </span>
                    {driver.traceKey && onExplain ? (
                      <ExplainButton
                        label={driver.label}
                        onClick={() => onExplain(driver.traceKey ?? "totals")}
                      />
                    ) : null}
                  </strong>
                  <span>{driver.explanation}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Åtgärder</p>
              <h3>Rekommenderade nästa steg</h3>
            </div>
            <ul className="insight-list">
              {candidateResult.recommendedActions.map((action) => (
                <li key={action.id}>
                  <strong className="inline-with-action">
                    <span>
                      {action.title} • {action.expectedImpact}
                    </span>
                    {action.traceKey && onExplain ? (
                      <ExplainButton
                        label={action.title}
                        onClick={() => onExplain(action.traceKey ?? "totals")}
                      />
                    ) : null}
                  </strong>
                  <span>{action.description}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {candidateResult.baselineExisting && candidateResult.baselineComparison ? (
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Före och efter</p>
              <h3>Basfall mot intervention</h3>
            </div>
            <div className="comparison-list">
              <article className="comparison-card">
                <strong className="inline-with-action">
                  <span>Befintligt basfall</span>
                  {onExplain ? (
                    <ExplainButton
                      label="Befintligt basfall"
                      onClick={() => onExplain("baseline.existing")}
                    />
                  ) : null}
                </strong>
                <span>
                  Total {formatNumber(candidateResult.baselineExisting.totalKgCo2e)} kg CO2e
                </span>
                <span>
                  {formatNumber(candidateResult.baselineExisting.annualOperationalKgCo2e)} kg CO2e/år drift
                </span>
              </article>
              <article className="comparison-card">
                <strong className="inline-with-action">
                  <span>Delta mot basfall</span>
                  {onExplain ? (
                    <ExplainButton
                      label="Delta mot basfall"
                      onClick={() => onExplain("baseline.delta")}
                    />
                  ) : null}
                </strong>
                <span>
                  {candidateResult.baselineComparison.totalDeltaKgCo2e > 0 ? "+" : ""}
                  {formatNumber(candidateResult.baselineComparison.totalDeltaKgCo2e)} kg CO2e totalt
                </span>
                <span>
                  {candidateResult.baselineComparison.annualOperationalDeltaKgCo2e > 0 ? "+" : ""}
                  {formatNumber(candidateResult.baselineComparison.annualOperationalDeltaKgCo2e)} kg CO2e/år drift
                </span>
                <span>
                  {candidateResult.baselineComparison.lifetimeMobilityDeltaKgCo2e > 0 ? "+" : ""}
                  {formatNumber(candidateResult.baselineComparison.lifetimeMobilityDeltaKgCo2e)} kg CO2e mobilitet
                </span>
              </article>
            </div>
          </section>
        ) : null}
      </section>

      <section className="result-section">
        <div className="section-heading">
          <p className="eyebrow">Metod</p>
          <h3>Metodstatus, antaganden och källspår</h3>
        </div>
        <div className="report-dual-grid">
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Metodstatus</p>
              <h3>Verifierbarhet i den här körningen</h3>
            </div>
            <ul className="insight-list">
              <li>
                <strong>{methodStatus.standard} poster med standardstöd</strong>
                <span>Direkt vägledda av standard eller normerad metod via myndighet eller standardram.</span>
              </li>
              <li>
                <strong>{methodStatus.official} poster med officiell statistik eller leverantörsdata</strong>
                <span>Underbyggda av statistik, myndighetsdata eller lokala emissionsvärden.</span>
              </li>
              <li>
                <strong>{methodStatus.proxy} poster med schablon eller proxy</strong>
                <span>Visas öppet som screeningantaganden och ska användas med försiktighet.</span>
              </li>
            </ul>
          </section>
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Antaganden</p>
              <h3>Metod och källor</h3>
            </div>
            <dl className="assumption-list">
              {candidateResult.assumptions.map((assumption) => (
                <div key={assumption.label}>
                  <dt>{assumption.label}</dt>
                  <dd>{assumption.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <InputCatalog result={candidateResult} />

        <section className="report-card">
          <div className="section-heading">
            <p className="eyebrow">Källor</p>
            <h3>Källor i den valda körningen</h3>
          </div>
          <ul className="source-list">
            {candidateResult.sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <span>
                  {source.publisher} • {source.license}
                  {source.updatedAt ? ` • ${source.updatedAt}` : ""}
                </span>
                {source.note ? <p className="microcopy">{source.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </section>

      {candidateResult.byPlanObject?.length ? <GeoJsonMap planObjects={candidateResult.byPlanObject} /> : null}
    </section>
  );
}

function ScenarioTable({ project }: { project: Project | null }) {
  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Scenarioöversikt</p>
        <h3>{project?.name ?? "Scenarioöversikt"}</h3>
      </div>
      {project && project.scenarios.length > 0 ? (
        <div className="scenario-table">
          {project.scenarios.map((scenario) => (
            <article key={scenario.id} className="scenario-row">
              <strong>{scenario.name}</strong>
              <span>
                {scenario.mode === "plan" ? "Planobjekt" : "Snabbkalkyl"} • {scenario.runs?.length ?? 0} körningar
              </span>
              <span>
                {scenario.latestResult
                  ? `${formatNumber(scenario.latestResult.totals.value)} kg CO2e`
                  : "Ej beräknad"}
              </span>
              <span>{scenario.lastCalculatedAt ? formatRunTimestamp(scenario.lastCalculatedAt) : "Inte körd"}</span>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state-workbench">
          <p className="lede">
            Här samlas alla scenarier i projektet. När du skapat det första alternativet kan du följa körhistorik,
            beräkningar och jämförelser på samma plats.
          </p>
          <div className="inline-panel">
            <strong>Inget scenario ännu</strong>
            <span>Skapa ett scenario i arbetsytan ovan för att låsa upp denna översikt.</span>
          </div>
        </div>
      )}
    </section>
  );
}

interface ScenarioMatrixDraft {
  id: string;
  name: string;
  form: FormState;
}

function ScenarioMatrixEditor({
  scenario,
  onImportRows,
  disabled
}: {
  scenario: Scenario | null;
  onImportRows: (rows: Array<Record<string, string | number>>) => Promise<number>;
  disabled?: boolean;
}) {
  const [draftRows, setDraftRows] = useState<ScenarioMatrixDraft[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!scenario) {
      setDraftRows([]);
      return;
    }

    const seedForm = scenario.quickInput ? payloadToForm(scenario.quickInput) : createDraftForm();
    setDraftRows([
      {
        id: `draft-${scenario.id}-1`,
        name: `${scenario.name} 1`,
        form: seedForm
      }
    ]);
  }, [scenario?.id, scenario?.name, scenario?.mode]);

  function updateDraftRow<K extends keyof FormState>(rowId: string, key: K, value: FormState[K]) {
    setDraftRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextForm = {
          ...row.form,
          [key]: value
        };

        return {
          ...row,
          form:
            key === "buildingType"
              ? applyBuildingTypePresetToForm(nextForm, value as FormState["buildingType"])
              : nextForm
        };
      })
    );
  }

  function updateDraftName(rowId: string, value: string) {
    setDraftRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, name: value } : row))
    );
  }

  function addDraftRow() {
    setDraftRows((current) => [
      ...current,
      {
        id: `draft-${scenario?.id ?? "scenario"}-${current.length + 1}-${Date.now()}`,
        name: `Byggnad ${current.length + 1}`,
        form: createDraftForm()
      }
    ]);
  }

  function duplicateDraftRow(rowId: string) {
    setDraftRows((current) => {
      const match = current.find((row) => row.id === rowId);
      if (!match) {
        return current;
      }

      return [
        ...current,
        {
          id: `draft-${scenario?.id ?? "scenario"}-${current.length + 1}-${Date.now()}`,
          name: `${match.name} kopia`,
          form: { ...match.form }
        }
      ];
    });
  }

  function removeDraftRow(rowId: string) {
    setDraftRows((current) => current.filter((row) => row.id !== rowId));
  }

  async function handleSaveDraftRows() {
    if (!scenario) {
      return;
    }

    setDraftError(null);

    try {
      const rows = draftRows.map((row) => {
        const payload = buildPayload(row.form);
        const rawRow = {
          id: row.id,
          name: row.name,
          objectType: "byggnad",
          buildingType: payload.buildingType,
          grossFloorAreaM2: payload.grossFloorAreaM2,
          buildYear: payload.buildYear,
          frameMaterial: payload.frameMaterial,
          energyStandard: payload.energyStandard,
          heatingType: payload.heatingType,
          buildingForm: payload.buildingForm,
          urbanContext: payload.urbanContext,
          residents: payload.estimatedResidents,
          workers: payload.estimatedWorkers,
          siteAreaM2: payload.siteAreaM2,
          floorsAboveGround: payload.floorsAboveGround,
          buildingFootprintM2: payload.buildingFootprintM2,
          basementFloors: payload.basementFloors,
          glazingRatioPct: payload.glazingRatioPct,
          parkingSpaces: payload.parkingSpaces,
          parkingStructureType: payload.parkingStructureType,
          parkingGarageFloors: payload.parkingGarageFloors,
          landType: payload.landType,
          groundCondition: payload.groundCondition,
          foundationType: payload.foundationType,
          lat: payload.siteLocation?.lat,
          lon: payload.siteLocation?.lon,
          distanceToTransitStopM: payload.transitOverrides?.distanceToTransitStopM,
          distanceToRailStationM: payload.transitOverrides?.distanceToRailStationM,
          departuresPerHour: payload.transitOverrides?.departuresPerHour,
          interventionType: payload.interventionType,
          existingGrossFloorAreaM2: payload.existingBuilding?.grossFloorAreaM2,
          existingBuildYear: payload.existingBuilding?.buildYear,
          existingFrameMaterial: payload.existingBuilding?.frameMaterial,
          existingEnergyStandard: payload.existingBuilding?.energyStandard,
          existingSpecificEnergyUseKwhM2Year: payload.existingBuilding?.specificEnergyUseKwhM2Year,
          retainedStructureSharePct: payload.retainedStructureSharePct,
          addedGrossFloorAreaM2: payload.addedGrossFloorAreaM2,
          addedFloors: payload.addedFloors,
          retrofitDepth: payload.retrofitDepth
        };
        return Object.fromEntries(
          Object.entries(rawRow).filter(([, value]) => value !== undefined)
        ) as Record<string, string | number>;
      });

      setIsSaving(true);
      await onImportRows(rows);
      setDraftRows([
        {
          id: `draft-${scenario.id}-1`,
          name: `${scenario.name} 1`,
          form: createDraftForm()
        }
      ]);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Tabellen kunde inte sparas.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!scenario) {
    return (
      <section className="report-card matrix-card">
        <div className="section-heading">
          <p className="eyebrow">Tabellinmatning</p>
          <h3>Flera byggnader i samma scenario</h3>
        </div>
        <div className="empty-state-workbench">
          <strong>Välj eller skapa ett scenario för att börja använda tabellinmatningen.</strong>
          <span>
            Den här vyn är redan på plats och visar flera byggnader i samma scenario när en aktiv
            körning finns.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="report-card matrix-card">
      <div className="section-heading">
        <p className="eyebrow">Tabellinmatning</p>
        <h3>Flera byggnader i samma scenario</h3>
      </div>
      <p className="microcopy">
        Varje kolumn blir ett eget planobjekt i scenariot. Det passar när ett projekt har flera byggnader med olika förutsättningar.
      </p>

      <div className="matrix-toolbar">
        <button type="button" className="ghost-button" onClick={addDraftRow} disabled={disabled}>
          Lägg till byggnad
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => draftRows[0] && duplicateDraftRow(draftRows[0].id)}
          disabled={disabled || draftRows.length === 0}
        >
          Duplicera första
        </button>
        <button
          type="button"
          className="submit-button"
          onClick={handleSaveDraftRows}
          disabled={disabled || isSaving || draftRows.length === 0}
        >
          {isSaving ? "Sparar tabell..." : "Importera till scenario"}
        </button>
      </div>

      {draftError ? (
        <p className="form-error" role="alert">
          {draftError}
        </p>
      ) : null}

      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Fält</th>
              {draftRows.map((row, index) => (
                <th key={row.id}>
                  <div className="matrix-column-head">
                    <input
                      value={row.name}
                      onChange={(event) => updateDraftName(row.id, event.target.value)}
                      aria-label={`Namn för byggnad ${index + 1}`}
                      placeholder={`Byggnad ${index + 1}`}
                      disabled={disabled}
                    />
                    <div className="matrix-column-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => duplicateDraftRow(row.id)}
                        disabled={disabled}
                      >
                        Kopiera
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => removeDraftRow(row.id)}
                        disabled={disabled || draftRows.length === 1}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Byggnadstyp",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.buildingType}
                    onChange={(event) =>
                      updateDraftRow(row.id, "buildingType", event.target.value as FormState["buildingType"])
                    }
                    disabled={disabled}
                  >
                    {BUILDING_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.buildingType[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "BTA (m2)",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.grossFloorAreaM2}
                    onChange={(event) => updateDraftRow(row.id, "grossFloorAreaM2", event.target.value)}
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Byggår",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.form.buildYear}
                    onChange={(event) => updateDraftRow(row.id, "buildYear", event.target.value)}
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Stommaterial",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.frameMaterial}
                    onChange={(event) =>
                      updateDraftRow(row.id, "frameMaterial", event.target.value as FormState["frameMaterial"])
                    }
                    disabled={disabled}
                  >
                    {FRAME_MATERIALS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.frameMaterial[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Energistandard",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.energyStandard}
                    onChange={(event) =>
                      updateDraftRow(row.id, "energyStandard", event.target.value as FormState["energyStandard"])
                    }
                    disabled={disabled}
                  >
                    {ENERGY_STANDARDS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.energyStandard[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Uppvärmning",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.heatingType}
                    onChange={(event) =>
                      updateDraftRow(row.id, "heatingType", event.target.value as FormState["heatingType"])
                    }
                    disabled={disabled}
                  >
                    {HEATING_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.heatingType[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Byggnadsform",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.buildingForm ?? "normal"}
                    onChange={(event) =>
                      updateDraftRow(row.id, "buildingForm", event.target.value as FormState["buildingForm"])
                    }
                    disabled={disabled}
                  >
                    {BUILDING_FORMS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.buildingForm[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Lägesprofil",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.urbanContext ?? "urban"}
                    onChange={(event) =>
                      updateDraftRow(row.id, "urbanContext", event.target.value as FormState["urbanContext"])
                    }
                    disabled={disabled}
                  >
                    {URBAN_CONTEXTS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.urbanContext[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Latitud",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.siteLat}
                    onChange={(event) => updateDraftRow(row.id, "siteLat", event.target.value)}
                    disabled={disabled}
                    placeholder="Valfritt"
                  />
                )
              },
              {
                label: "Longitud",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.siteLon}
                    onChange={(event) => updateDraftRow(row.id, "siteLon", event.target.value)}
                    disabled={disabled}
                    placeholder="Valfritt"
                  />
                )
              },
              {
                label: "Våningar",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.form.floorsAboveGround}
                    onChange={(event) =>
                      updateDraftRow(row.id, "floorsAboveGround", event.target.value)
                    }
                    disabled={disabled}
                    placeholder="Default"
                  />
                )
              },
              {
                label: "Källarvåningar",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={row.form.basementFloors}
                    onChange={(event) => updateDraftRow(row.id, "basementFloors", event.target.value)}
                    disabled={disabled || row.form.foundationType !== "kallare"}
                    placeholder="1"
                  />
                )
              },
              {
                label: "Fotavtryck (m2)",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.buildingFootprintM2}
                    onChange={(event) =>
                      updateDraftRow(row.id, "buildingFootprintM2", event.target.value)
                    }
                    disabled={disabled}
                    placeholder="Härleds annars"
                  />
                )
              },
              {
                label: "Glasandel (%)",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.glazingRatioPct}
                    onChange={(event) => updateDraftRow(row.id, "glazingRatioPct", event.target.value)}
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Boende",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.form.estimatedResidents}
                    onChange={(event) => updateDraftRow(row.id, "estimatedResidents", event.target.value)}
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Arbetande",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.form.estimatedWorkers}
                    onChange={(event) => updateDraftRow(row.id, "estimatedWorkers", event.target.value)}
                    disabled={disabled}
                  />
                )
              },
          {
            label: "Parkering",
            render: (row: ScenarioMatrixDraft) => (
              <input
                type="number"
                    inputMode="numeric"
                    value={row.form.parkingSpaces}
                    onChange={(event) => updateDraftRow(row.id, "parkingSpaces", event.target.value)}
                  disabled={disabled}
                />
              )
            },
              {
                label: "Parkeringslösning",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.parkingStructureType ?? "none"}
                    onChange={(event) => {
                      const nextValue = event.target.value as FormState["parkingStructureType"];
                      updateDraftRow(row.id, "parkingStructureType", nextValue);
                      if (nextValue === "none") {
                        updateDraftRow(row.id, "parkingGarageFloors", "");
                      }
                    }}
                    disabled={disabled}
                  >
                    {PARKING_STRUCTURE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.parkingStructureType[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Garagevåningar",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={row.form.parkingGarageFloors}
                    onChange={(event) =>
                      updateDraftRow(row.id, "parkingGarageFloors", event.target.value)
                    }
                    disabled={disabled || row.form.parkingStructureType === "none"}
                    placeholder="1"
                  />
                )
              },
              {
                label: "Platsyta (m2)",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.siteAreaM2}
                    onChange={(event) => updateDraftRow(row.id, "siteAreaM2", event.target.value)}
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Markförhållande",
                render: (row: ScenarioMatrixDraft) => (
                  <select
                    value={row.form.groundCondition ?? "normal_mark"}
                    onChange={(event) =>
                      updateDraftRow(
                        row.id,
                        "groundCondition",
                        event.target.value as FormState["groundCondition"]
                      )
                    }
                    disabled={disabled}
                  >
                    {GROUND_CONDITIONS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.groundCondition[option]}
                      </option>
                    ))}
                  </select>
                )
              },
              {
                label: "Hållplatsavstånd",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.distanceToTransitStopM}
                    onChange={(event) =>
                      updateDraftRow(row.id, "distanceToTransitStopM", event.target.value)
                    }
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Spårstationsavstånd",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.distanceToRailStationM}
                    onChange={(event) =>
                      updateDraftRow(row.id, "distanceToRailStationM", event.target.value)
                    }
                    disabled={disabled}
                  />
                )
              },
              {
                label: "Avgångar/timme",
                render: (row: ScenarioMatrixDraft) => (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.form.departuresPerHour}
                    onChange={(event) => updateDraftRow(row.id, "departuresPerHour", event.target.value)}
                    disabled={disabled}
                  />
                )
              }
            ].map((field) => (
              <tr key={field.label}>
                <th>{field.label}</th>
                {draftRows.map((row) => (
                  <td key={`${row.id}-${field.label}`}>{field.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseAppRoute(window.location.pathname, window.location.search)
  );
  const [dataSources, setDataSources] = useState<DataSourcesResponse | null>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealthResponse | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [allBenchmarkProfiles, setAllBenchmarkProfiles] = useState<BenchmarkProfile[]>([]);
  const [quickForm, setQuickForm] = useState<FormState>(initialForm);
  const [scenarioForm, setScenarioForm] = useState<FormState>(initialForm);
  const [quickResult, setQuickResult] = useState<CalculationResult | null>(null);
  const [scenarioResult, setScenarioResult] = useState<CalculationResult | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [activeExplanation, setActiveExplanation] = useState<CalculationExplanation | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [isScenarioSubmitting, setIsScenarioSubmitting] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("stockholm-stad");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("planerare@stockholm.se");
  const [newProjectName, setNewProjectName] = useState("");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [compareBaseId, setCompareBaseId] = useState("");
  const [compareCandidateId, setCompareCandidateId] = useState("");
  const [selectedComparisonMetric, setSelectedComparisonMetric] =
    useState<ComparisonMetric>("perM2");
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState<string[]>([]);
  const [selectedStandardIds, setSelectedStandardIds] = useState<string[]>([]);
  const [selectedBaseRunId, setSelectedBaseRunId] = useState("");
  const [selectedCandidateRunId, setSelectedCandidateRunId] = useState("");
  const [scenarioEditorMode, setScenarioEditorMode] = useState<"single" | "multi">("single");
  const [scenarioAccessCode, setScenarioAccessCode] = useState("");
  const [scenarioAccessError, setScenarioAccessError] = useState<string | null>(null);
  const [isScenarioUnlocked, setIsScenarioUnlocked] = useState(false);
  const [isScenarioAccessLoading, setIsScenarioAccessLoading] = useState(true);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseAppRoute(window.location.pathname, window.location.search));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    fetchHealth()
      .then((health) => setApiHealth(health))
      .catch(() => setApiHealth(null));

    fetchScenarioAccessStatus()
      .then((status) => setIsScenarioUnlocked(status.unlocked))
      .catch(() => setIsScenarioUnlocked(false))
      .finally(() => setIsScenarioAccessLoading(false));

    Promise.all([fetchDataSources(), fetchWorkspace()])
      .then(([sources, workspaceResponse]) => {
        setDataSources(sources);
        setWorkspace(workspaceResponse);
        setAllBenchmarkProfiles(workspaceResponse.benchmarkProfiles);
        setSelectedOrganizationId(
          workspaceResponse.session?.organizationId ??
            workspaceResponse.organizations[0]?.id ??
            "stockholm-stad"
        );
      })
      .catch(() => {
        setDataSources(null);
        setWorkspace(null);
      });
  }, []);

  const projects = useMemo(
    () =>
      workspace?.projects.filter(
        (project) => project.organizationId === (workspace.session?.organizationId ?? selectedOrganizationId)
      ) ?? [],
    [selectedOrganizationId, workspace]
  );

  const currentProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const currentScenario =
    currentProject?.scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    currentProject?.scenarios[0] ??
    null;

  useEffect(() => {
    if (!currentScenario) {
      setScenarioEditorMode("single");
      return;
    }

    setScenarioEditorMode(
      currentScenario.mode === "plan" || currentScenario.planObjects.length > 0 ? "multi" : "single"
    );
  }, [currentScenario?.id, currentScenario?.mode, currentScenario?.planObjects.length]);

  const analysisContext = useMemo(() => {
    if (route.kind !== "analysis") {
      return null;
    }

    for (const project of workspace?.projects ?? []) {
      const scenario = project.scenarios.find((entry) => entry.id === route.scenarioId);
      if (scenario) {
        return { project, scenario };
      }
    }

    return null;
  }, [route, workspace?.projects]);
  const analysisSelectedRun = analysisContext?.scenario
    ? getActiveScenarioRun(analysisContext.scenario, route.kind === "analysis" ? route.runId : undefined)
    : null;

  useEffect(() => {
    if (workspace?.benchmarkProfiles?.length) {
      setAllBenchmarkProfiles((current) => {
        const merged = new Map(current.map((profile) => [profile.id, profile]));
        for (const profile of workspace.benchmarkProfiles) {
          merged.set(profile.id, profile);
        }
        return Array.from(merged.values());
      });
    }
  }, [workspace?.benchmarkProfiles]);

  function handleScenarioAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    unlockScenarioAccess({ code: scenarioAccessCode })
      .then(() => {
        setIsScenarioUnlocked(true);
        setScenarioAccessError(null);
        setScenarioAccessCode("");
        if (route.kind !== "scenario") {
          navigateTo(buildScenarioPath());
        }
      })
      .catch((error) => {
        setIsScenarioUnlocked(false);
        setScenarioAccessError(error instanceof Error ? error.message : "Ogiltig kod");
      })
      .finally(() => {
        setIsScenarioAccessLoading(false);
      });
  }

  useEffect(() => {
    if (currentProject && currentProject.id !== selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }

    if (currentScenario && currentScenario.id !== selectedScenarioId) {
      setSelectedScenarioId(currentScenario.id);
    }

    if (currentScenario) {
      setScenarioForm(payloadToForm(currentScenario.quickInput));
      setScenarioResult(currentScenario.latestResult ?? null);
      const scenarioRuns = currentScenario.runs ?? [];
      const latestRun = scenarioRuns[scenarioRuns.length - 1];
      const previousRun =
        scenarioRuns.length > 1
          ? scenarioRuns[scenarioRuns.length - 2]
          : scenarioRuns[0];
      setSelectedCandidateRunId(latestRun?.id ?? "");
      setSelectedBaseRunId(previousRun?.id ?? latestRun?.id ?? "");
    }

    if (currentProject && currentProject.scenarios.length >= 2) {
      setCompareBaseId((existing) => existing || currentProject.scenarios[0].id);
      setCompareCandidateId((existing) => existing || currentProject.scenarios[1].id);
    }
  }, [currentProject, currentScenario, selectedProjectId, selectedScenarioId]);

  async function refreshWorkspace(organizationId = workspace?.session?.organizationId ?? selectedOrganizationId) {
    const response = await fetchWorkspace(organizationId);
    startTransition(() => {
      setWorkspace(response);
    });
    return response;
  }

  function navigateTo(pathname: string, replace = false) {
    const url = new URL(window.location.href);
    url.pathname = pathname;
    url.search = "";
    if (replace) {
      window.history.replaceState({}, "", url.toString());
    } else {
      window.history.pushState({}, "", url.toString());
    }
    setRoute(parseAppRoute(window.location.pathname, window.location.search));
  }

  function openAnalysis(scenarioId: string, runId?: string) {
    navigateTo(buildAnalysisPath(scenarioId, runId));
  }

  function updateQuickForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setQuickForm((current) => {
      const next = {
        ...current,
        [key]: value
      };

      if (key === "proxyProfile") {
        return applyProxyProfileToForm(next, value as FormState["proxyProfile"]);
      }

      const withBuildingPreset =
        key === "buildingType"
          ? applyBuildingTypePresetToForm(next, value as FormState["buildingType"])
          : next;

      if (
        current.proxyProfile !== "custom" &&
        key !== "buildingType" &&
        PROXY_PROFILE_SENSITIVE_FIELDS.has(key)
      ) {
        return {
          ...withBuildingPreset,
          proxyProfile: "custom"
        };
      }

      return current.proxyProfile !== "custom"
        ? applyProxyProfileToForm(withBuildingPreset, current.proxyProfile)
        : withBuildingPreset;
    });
  }

  function updateScenarioForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setScenarioForm((current) => {
      const next = {
        ...current,
        [key]: value
      };

      if (key === "proxyProfile") {
        return applyProxyProfileToForm(next, value as FormState["proxyProfile"]);
      }

      const withBuildingPreset =
        key === "buildingType"
          ? applyBuildingTypePresetToForm(next, value as FormState["buildingType"])
          : next;

      if (
        current.proxyProfile !== "custom" &&
        key !== "buildingType" &&
        PROXY_PROFILE_SENSITIVE_FIELDS.has(key)
      ) {
        return {
          ...withBuildingPreset,
          proxyProfile: "custom"
        };
      }

      return current.proxyProfile !== "custom"
        ? applyProxyProfileToForm(withBuildingPreset, current.proxyProfile)
        : withBuildingPreset;
    });
  }

  function openExplanation(result: CalculationResult | null, traceKey: string) {
    if (!result) {
      return;
    }

    const explanationIds = result.explanationIndex[traceKey] ?? [];
    const match =
      result.explanations.find((entry) => explanationIds.includes(entry.id)) ??
      result.explanations.find((entry) => entry.traceKey === traceKey) ??
      null;

    setActiveExplanation(match);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);

    try {
      const session = await loginSession({
        email: loginEmail,
        organizationId: selectedOrganizationId
      });
      await refreshWorkspace(session.organizationId);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Kunde inte öppna arbetsytan.");
    }
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);

    try {
      const projectName = newProjectName.trim();

      if (projectName.length < 2) {
        throw new Error("Ange ett projektnamn med minst 2 tecken.");
      }

      const project = await createProjectApi({
        organizationId: workspace?.session?.organizationId ?? selectedOrganizationId,
        name: projectName
      });

      setNewProjectName("");
      await refreshWorkspace(project.organizationId);
      setSelectedProjectId(project.id);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Projektet kunde inte skapas.");
    }
  }

  async function handleDeleteProject(projectId: string) {
    setWorkspaceError(null);

    const projectToDelete = projects.find((project) => project.id === projectId);
    if (!projectToDelete) {
      return;
    }

    if (
      !window.confirm(
        `Ta bort projektet "${projectToDelete.name}" och alla dess scenarier? Det går inte att ångra.`
      )
    ) {
      return;
    }

    try {
      const wasSelectedProjectDeleted = selectedProjectId === projectId;
      const previousSelectedProjectId = selectedProjectId;
      const previousSelectedScenarioId = selectedScenarioId;

      const deletedProject = await deleteProjectApi(projectId);
      setComparison(null);
      setActiveExplanation(null);
      setNewScenarioName("");

      const nextWorkspace = await refreshWorkspace(deletedProject.organizationId);
      const nextProjects = nextWorkspace.projects.filter(
        (project) => project.organizationId === deletedProject.organizationId
      );
      const preservedProject =
        !wasSelectedProjectDeleted
          ? nextProjects.find((project) => project.id === previousSelectedProjectId) ?? null
          : null;
      const nextProject = preservedProject ?? nextProjects[0] ?? null;
      const nextScenario =
        nextProject?.scenarios.find((scenario) => scenario.id === previousSelectedScenarioId) ??
        nextProject?.scenarios[0] ??
        null;

      setSelectedProjectId(nextProject?.id ?? "");
      setSelectedScenarioId(nextScenario?.id ?? "");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Projektet kunde inte tas bort.");
    }
  }

  async function handleCreateScenario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);

    try {
      if (!currentProject) {
        throw new Error("Skapa eller välj ett projekt först.");
      }

      const scenarioName = newScenarioName.trim();

      if (scenarioName.length < 2) {
        throw new Error("Ange ett scenarionamn med minst 2 tecken.");
      }

      let quickInput: CalculateRequest | undefined;
      try {
        quickInput = buildPayload(scenarioForm);
      } catch {
        quickInput = undefined;
      }

      const scenario = await createScenarioApi(currentProject.id, {
        name: scenarioName,
        mode: "quick",
        quickInput
      });

      setNewScenarioName("");
      await refreshWorkspace(currentProject.organizationId);
      setSelectedScenarioId(scenario.id);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Scenariot kunde inte skapas."
      );
    }
  }

  async function handleDeleteScenario(scenarioId: string) {
    setWorkspaceError(null);

    if (!currentProject) {
      return;
    }

    const scenarioToDelete = currentProject.scenarios.find((scenario) => scenario.id === scenarioId);
    if (!scenarioToDelete) {
      return;
    }

    if (
      !window.confirm(
        `Ta bort scenariot "${scenarioToDelete.name}"? Det går inte att ångra.`
      )
    ) {
      return;
    }

    try {
      const wasSelectedScenarioDeleted = selectedScenarioId === scenarioId;
      const previousSelectedScenarioId = selectedScenarioId;

      await deleteScenarioApi(currentProject.id, scenarioId);
      setComparison(null);
      setActiveExplanation(null);

      const nextWorkspace = await refreshWorkspace(currentProject.organizationId);
      const nextProject =
        nextWorkspace.projects.find((project) => project.id === currentProject.id) ?? null;
      const nextScenario =
        !wasSelectedScenarioDeleted
          ? nextProject?.scenarios.find((scenario) => scenario.id === previousSelectedScenarioId) ??
            nextProject?.scenarios[0] ??
            null
          : nextProject?.scenarios[0] ?? null;

      setSelectedScenarioId(nextScenario?.id ?? "");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Scenariot kunde inte tas bort.");
    }
  }

  async function duplicateScenarioById(scenarioId: string) {
    setWorkspaceError(null);

    try {
      if (!currentProject) {
        throw new Error("Välj ett scenario att duplicera.");
      }

      const sourceScenario =
        currentProject.scenarios.find((scenario) => scenario.id === scenarioId) ?? currentScenario;

      if (!sourceScenario) {
        throw new Error("Scenariot hittades inte.");
      }

      const duplicate = await duplicateScenarioApi(
        currentProject.id,
        sourceScenario.id,
        `${sourceScenario.name} alternativ`
      );
      await refreshWorkspace(currentProject.organizationId);
      setSelectedScenarioId(duplicate.id);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Scenariot kunde inte dupliceras."
      );
    }
  }

  async function handleDuplicateScenario() {
    if (!currentScenario) {
      return;
    }

    await duplicateScenarioById(currentScenario.id);
  }

  async function handleQuickCalculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickError(null);

    try {
      const payload = buildPayload(quickForm);
      setIsQuickSubmitting(true);
      const response = await calculateClimateImpact(payload);
      startTransition(() => {
        setQuickResult(response);
      });
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : "Beräkningen kunde inte genomföras.");
    } finally {
      setIsQuickSubmitting(false);
    }
  }

  async function handleScenarioCalculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);

    try {
      if (!currentScenario) {
        throw new Error("Välj eller skapa ett scenario först.");
      }

      const payload = buildPayload(scenarioForm);
      setIsScenarioSubmitting(true);
      const response = await calculateScenarioApi(currentScenario.id, payload);
      setScenarioResult(response.result);
      await refreshWorkspace(currentProject?.organizationId ?? selectedOrganizationId);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Scenariot kunde inte beräknas.");
    } finally {
      setIsScenarioSubmitting(false);
    }
  }

  async function handleCompareScenarios() {
    setWorkspaceError(null);

    try {
      if (!currentProject || !compareBaseId || !compareCandidateId) {
        throw new Error("Välj två scenarier att jämföra.");
      }

      const response = await compareScenariosApi(currentProject.id, compareBaseId, compareCandidateId);
      setComparison(response);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Jämförelsen misslyckades.");
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    setWorkspaceError(null);

    try {
      if (!currentScenario) {
        throw new Error("Välj ett scenario före import.");
      }

      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const text = await file.text();

      if (file.name.endsWith(".csv")) {
        await importTabularApi(currentScenario.id, {
          format: "csv",
          content: text
        });
      } else {
        await importGeoJsonApi(currentScenario.id, JSON.parse(text));
      }

      await refreshWorkspace(currentProject?.organizationId ?? selectedOrganizationId);
      event.target.value = "";
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Importen misslyckades.");
    }
  }

  async function handleMatrixImportRows(rows: Array<Record<string, string | number>>) {
    if (!currentScenario) {
      throw new Error("Välj ett scenario före tabellimport.");
    }

    const response = await importTabularApi(currentScenario.id, {
      format: "json",
      rows
    });

    const calculation = await calculateScenarioApi(currentScenario.id);
    startTransition(() => {
      setScenarioResult(calculation.result);
    });
    await refreshWorkspace(currentProject?.organizationId ?? selectedOrganizationId);
    return response.importedCount;
  }

  function renderCalculationForm(
    form: FormState,
    update: <K extends keyof FormState>(key: K, value: FormState[K]) => void,
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void,
    submitLabel: string,
    disabled = false
  ) {
    function applyStockholmLocationPreset() {
      update("siteLat", STOCKHOLM_LOCATION_PRESET.lat as FormState["siteLat"]);
      update("siteLon", STOCKHOLM_LOCATION_PRESET.lon as FormState["siteLon"]);
    }

    return (
      <form onSubmit={onSubmit} className="form-grid">
        <fieldset className="form-grid-fieldset" disabled={disabled}>
        <label>
          Byggnadstyp
          <select
            aria-label="Byggnadstyp"
            value={form.buildingType}
            onChange={(event) => update("buildingType", event.target.value as FormState["buildingType"])}
          >
            {BUILDING_TYPES.map((option) => (
              <option key={option} value={option}>
                {LABELS.buildingType[option]}
              </option>
            ))}
          </select>
          <span className="microcopy">Typvalet laddar rimliga startvärden för form, våningar, läge och parkering.</span>
        </label>

        <label>
          Bruttoarea (m2)
          <input
            aria-label="Bruttoarea"
            type="number"
            inputMode="decimal"
            value={form.grossFloorAreaM2}
            onChange={(event) => update("grossFloorAreaM2", event.target.value)}
            placeholder="Exempel: 1200"
          />
        </label>

        <label>
          Byggår
          <input
            aria-label="Byggår"
            type="number"
            inputMode="numeric"
            value={form.buildYear}
            onChange={(event) => update("buildYear", event.target.value)}
            placeholder="Exempel: 2030"
          />
        </label>

        <label>
          Stommaterial
          <select
            value={form.frameMaterial}
            onChange={(event) =>
              update("frameMaterial", event.target.value as FormState["frameMaterial"])
            }
          >
            {FRAME_MATERIALS.map((option) => (
              <option key={option} value={option}>
                {LABELS.frameMaterial[option]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Energistandard
          <select
            value={form.energyStandard}
            onChange={(event) =>
              update("energyStandard", event.target.value as FormState["energyStandard"])
            }
          >
            {ENERGY_STANDARDS.map((option) => (
              <option key={option} value={option}>
                {LABELS.energyStandard[option]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Uppvärmning
          <select
            value={form.heatingType}
            onChange={(event) => update("heatingType", event.target.value as FormState["heatingType"])}
          >
            {HEATING_TYPES.map((option) => (
              <option key={option} value={option}>
                {LABELS.heatingType[option]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Byggnadsform
          <select
            value={form.buildingForm ?? "normal"}
            onChange={(event) =>
              update("buildingForm", event.target.value as FormState["buildingForm"])
            }
          >
            {BUILDING_FORMS.map((option) => (
              <option key={option} value={option}>
                {LABELS.buildingForm[option]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Lägesprofil
          <select
            value={form.urbanContext ?? "urban"}
            onChange={(event) =>
              update("urbanContext", event.target.value as FormState["urbanContext"])
            }
          >
            {URBAN_CONTEXTS.map((option) => (
              <option key={option} value={option}>
                {LABELS.urbanContext[option]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Boende valfritt
          <input
            type="number"
            inputMode="numeric"
            value={form.estimatedResidents}
            onChange={(event) => update("estimatedResidents", event.target.value)}
            placeholder="Exempel: 56"
          />
        </label>

        <label>
          Arbetande valfritt
          <input
            type="number"
            inputMode="numeric"
            value={form.estimatedWorkers}
            onChange={(event) => update("estimatedWorkers", event.target.value)}
            placeholder="Exempel: 20"
          />
        </label>

        <label className="full-width">
          Specifik energianvändning (kWh/m2,år) valfritt
          <input
            type="number"
            inputMode="decimal"
            value={form.specificEnergyUseKwhM2Year}
            onChange={(event) => update("specificEnergyUseKwhM2Year", event.target.value)}
            placeholder="Lämna tomt för schablon"
          />
        </label>

        <div className="full-width grouped-fields">
          <div className="section-heading">
            <p className="eyebrow">Frivilliga U-värden</p>
            <h3>Kalibrera driftprofilen</h3>
          </div>
          <div className="triple-grid">
            <label>
              Yttervägg
              <input
                type="number"
                inputMode="decimal"
                value={form.wallUValue}
                onChange={(event) => update("wallUValue", event.target.value)}
                placeholder="0,30"
              />
            </label>
            <label>
              Tak
              <input
                type="number"
                inputMode="decimal"
                value={form.roofUValue}
                onChange={(event) => update("roofUValue", event.target.value)}
                placeholder="0,20"
              />
            </label>
            <label>
              Fönster
              <input
                type="number"
                inputMode="decimal"
                value={form.windowUValue}
                onChange={(event) => update("windowUValue", event.target.value)}
                placeholder="1,2"
              />
            </label>
          </div>
        </div>

        <details className="full-width grouped-fields advanced-params">
          <summary>Avancerade parametrar</summary>
          <div className="advanced-sections">
            <section>
              <div className="section-heading">
                <p className="eyebrow">Osäkerhetsramar</p>
                <h3>Proxyprofil och best practice</h3>
              </div>
              <div className="triple-grid">
                <label className="full-width">
                  Proxyprofil
                  <select
                    value={form.proxyProfile}
                    onChange={(event) =>
                      update("proxyProfile", event.target.value as FormState["proxyProfile"])
                    }
                  >
                    <option value="custom">Anpassad</option>
                    {PROXY_PROFILES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.proxyProfile[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">
                    Väljer en rekommenderad proxyuppsättning för osäkra indata. Manuell ändring av
                    proxyfält återgår till Anpassad.
                  </span>
                </label>
                <div className="full-width grouped-fields">
                  <div className="decision-chip-row">
                    <span className="decision-chip">Säkra värden: direkt inmatade</span>
                    <span className="decision-chip">Medel: härledd eller refererad</span>
                    <span className="decision-chip">Hög: default eller proxy</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="section-heading">
                <p className="eyebrow">Ingrepp i befintlig byggnad</p>
                <h3>Nybyggnad, ombyggnad eller påbyggnad</h3>
              </div>
              <div className="triple-grid">
                <label>
                  Interventionstyp
                  <select
                    value={form.interventionType}
                    onChange={(event) =>
                      update(
                        "interventionType",
                        event.target.value as FormState["interventionType"]
                      )
                    }
                  >
                    {INTERVENTION_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.interventionType[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">Nybyggnad kör full nybyggnadslogik, ombyggnad och påbyggnad jämförs mot befintligt basfall.</span>
                </label>
                <label>
                  Retrofitdjup
                  <select
                    value={form.retrofitDepth}
                    onChange={(event) =>
                      update("retrofitDepth", event.target.value as FormState["retrofitDepth"])
                    }
                  >
                    {RETROFIT_DEPTHS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.retrofitDepth[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">Styr screeningnivån för ombyggnad och påbyggnad.</span>
                </label>
                <label>
                  Bevarad struktur (%)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.retainedStructureSharePct}
                    onChange={(event) => update("retainedStructureSharePct", event.target.value)}
                    placeholder="Exempel: 70"
                  />
                  <span className="microcopy">Högre värde innebär större återbruk av befintlig struktur.</span>
                </label>
              </div>

              {form.interventionType !== "nybyggnad" ? (
                <div className="triple-grid">
                  <label>
                    Befintlig area (m2)
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.existingGrossFloorAreaM2}
                      onChange={(event) => update("existingGrossFloorAreaM2", event.target.value)}
                      placeholder="Exempel: 3200"
                    />
                  </label>
                  <label>
                    Befintligt byggår
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.existingBuildYear}
                      onChange={(event) => update("existingBuildYear", event.target.value)}
                      placeholder="Exempel: 1974"
                    />
                  </label>
                  <label>
                    Befintlig specifik energi valfritt
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.existingSpecificEnergyUseKwhM2Year}
                      onChange={(event) =>
                        update("existingSpecificEnergyUseKwhM2Year", event.target.value)
                      }
                      placeholder="kWh/m2,år"
                    />
                  </label>
                  <label>
                    Befintligt stommaterial
                    <select
                      value={form.existingFrameMaterial}
                      onChange={(event) =>
                        update(
                          "existingFrameMaterial",
                          event.target.value as FormState["existingFrameMaterial"]
                        )
                      }
                    >
                      {FRAME_MATERIALS.map((option) => (
                        <option key={option} value={option}>
                          {LABELS.frameMaterial[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Befintlig energistandard
                    <select
                      value={form.existingEnergyStandard}
                      onChange={(event) =>
                        update(
                          "existingEnergyStandard",
                          event.target.value as FormState["existingEnergyStandard"]
                        )
                      }
                    >
                      {ENERGY_STANDARDS.map((option) => (
                        <option key={option} value={option}>
                          {LABELS.energyStandard[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.interventionType === "pabyggnad" ? (
                    <>
                      <label>
                        Tillkommande area (m2)
                        <input
                          type="number"
                          inputMode="decimal"
                          value={form.addedGrossFloorAreaM2}
                          onChange={(event) => update("addedGrossFloorAreaM2", event.target.value)}
                          placeholder="Exempel: 1200"
                        />
                      </label>
                      <label>
                        Tillkommande våningar
                        <input
                          type="number"
                          inputMode="numeric"
                          value={form.addedFloors}
                          onChange={(event) => update("addedFloors", event.target.value)}
                          placeholder="Exempel: 2"
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section>
              <div className="section-heading">
                <p className="eyebrow">Byggnadsform</p>
                <h3>Volym och klimatskal</h3>
              </div>
              <div className="triple-grid">
                <label>
                  Våningar ovan mark
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.floorsAboveGround}
                    onChange={(event) => update("floorsAboveGround", event.target.value)}
                    placeholder="Default per byggnadstyp"
                  />
                  <span className="microcopy">Används för att härleda byggnadsfotavtryck om BYA saknas.</span>
                </label>
                <label>
                  BYA / fotavtryck (m2)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.buildingFootprintM2}
                    onChange={(event) => update("buildingFootprintM2", event.target.value)}
                    placeholder="Lämna tomt för härledning"
                  />
                  <span className="microcopy">Prioriteras över härledd BYA i grundläggningsposten.</span>
                </label>
                <label>
                  Glasandel (%)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.glazingRatioPct}
                    onChange={(event) => update("glazingRatioPct", event.target.value)}
                    placeholder="Default per byggnadstyp"
                  />
                  <span className="microcopy">Påverkar bara drift när egen specifik energi inte anges.</span>
                </label>
              </div>
            </section>

            <section>
              <div className="section-heading">
                <p className="eyebrow">Plats och mark</p>
                <h3>Tomt och grundläggning</h3>
              </div>
              <div className="triple-grid">
                <label>
                  Platsyta (m2)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.siteAreaM2}
                    onChange={(event) => update("siteAreaM2", event.target.value)}
                    placeholder="Behövs för per hektar"
                  />
                  <span className="microcopy">Gör att appen kan visa total klimatpåverkan per hektar.</span>
                </label>
                <label>
                  Marktyp
                  <select
                    value={form.landType}
                    onChange={(event) => update("landType", event.target.value as FormState["landType"])}
                  >
                    {LAND_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.landType[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">Används för screeningpost för markeffekt i planskede.</span>
                </label>
                <label>
                  Grundläggning
                  <select
                    value={form.foundationType}
                    onChange={(event) =>
                      update("foundationType", event.target.value as FormState["foundationType"])
                    }
                  >
                    {FOUNDATION_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.foundationType[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">Justerar grundläggningsposten i embodied-delen.</span>
                </label>
                {form.foundationType === "kallare" ? (
                  <label>
                    Källarvåningar
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={form.basementFloors}
                      onChange={(event) => update("basementFloors", event.target.value)}
                      placeholder="Exempel: 1"
                    />
                    <span className="microcopy">
                      Används för att öka grundpåverkan när byggnaden har källare under mark.
                    </span>
                  </label>
                ) : null}
                <label>
                  Markförhållande
                  <select
                    value={form.groundCondition}
                    onChange={(event) =>
                      update("groundCondition", event.target.value as FormState["groundCondition"])
                    }
                  >
                    {GROUND_CONDITIONS.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.groundCondition[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">Mjuk lera och gyttja höjer ofta grundläggningsinsatsen.</span>
                </label>
              </div>
            </section>

            <section>
              <div className="section-heading">
                <p className="eyebrow">Mobilitet och läge</p>
                <h3>Kollektivtrafik och platsdata</h3>
              </div>
              <div className="triple-grid">
                <label>
                  Latitud valfritt
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.siteLat}
                    onChange={(event) => update("siteLat", event.target.value)}
                    placeholder="59,33"
                  />
                  <span className="microcopy">Om koordinat anges beräknas transitnärhet från versionsstyrd stationsprofil.</span>
                </label>
                <label>
                  Longitud valfritt
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.siteLon}
                    onChange={(event) => update("siteLon", event.target.value)}
                    placeholder="18,06"
                  />
                  <span className="microcopy">Använd tillsammans med latitud för automatisk tillgänglighetsklassning.</span>
                </label>
                <div className="full-width quick-location-preset">
                  <span className="microcopy">Snabbval för platsdata</span>
                  <div className="quick-location-preset-actions">
                    <button
                      type="button"
                      className="ghost-button ghost-button-small"
                      onClick={applyStockholmLocationPreset}
                    >
                      Fyll Stockholm
                    </button>
                    <span className="microcopy">Fyller koordinater för Stockholms centrum.</span>
                  </div>
                </div>
                <label>
                  Parkeringsplatser
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.parkingSpaces}
                    onChange={(event) => update("parkingSpaces", event.target.value)}
                    placeholder="Exempel: 30"
                  />
                  <span className="microcopy">Påverkar både parkeringsposten och en försiktig mobilitetsjustering.</span>
                </label>
                <label>
                  Parkeringslösning
                  <select
                    value={form.parkingStructureType}
                    onChange={(event) => {
                      const nextValue = event.target.value as FormState["parkingStructureType"];
                      update("parkingStructureType", nextValue);
                      if (nextValue === "none") {
                        update("parkingGarageFloors", "");
                      }
                    }}
                  >
                    {PARKING_STRUCTURE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {LABELS.parkingStructureType[option]}
                      </option>
                    ))}
                  </select>
                  <span className="microcopy">Garage ger ofta en större klimatpåverkan än markparkering.</span>
                </label>
                <label>
                  Garagevåningar
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.parkingGarageFloors}
                    onChange={(event) => update("parkingGarageFloors", event.target.value)}
                    placeholder="1"
                    disabled={form.parkingStructureType === "none"}
                  />
                  <span className="microcopy">Används när garage byggs ovan eller under mark.</span>
                </label>
                <label>
                  Avstånd till hållplats (m)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.distanceToTransitStopM}
                    onChange={(event) => update("distanceToTransitStopM", event.target.value)}
                    placeholder="Exempel: 250"
                  />
                  <span className="microcopy">Manuellt override om du inte vill använda koordinat.</span>
                </label>
                <label>
                  Avstånd till spårstation (m)
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.distanceToRailStationM}
                    onChange={(event) => update("distanceToRailStationM", event.target.value)}
                    placeholder="Exempel: 700"
                  />
                  <span className="microcopy">Används tillsammans med hållplatsavstånd och turtäthet.</span>
                </label>
                <label>
                  Avgångar per timme
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.departuresPerHour}
                    onChange={(event) => update("departuresPerHour", event.target.value)}
                    placeholder="Exempel: 12"
                  />
                  <span className="microcopy">Hjälper modellen att skilja starkt kollektivtrafikläge från svagare lägen.</span>
                </label>
              </div>
            </section>
          </div>
        </details>

        <button type="submit" className="submit-button" disabled={disabled}>
          {submitLabel}
        </button>
        </fieldset>
      </form>
    );
  }

  const currentBenchmark = useMemo(
    () =>
      workspace?.benchmarkProfiles.find(
        (profile) => profile.organizationId === (workspace.session?.organizationId ?? selectedOrganizationId)
      ) ?? null,
    [selectedOrganizationId, workspace]
  );

  useEffect(() => {
    if (currentBenchmark && selectedBenchmarkIds.length === 0) {
      setSelectedBenchmarkIds([currentBenchmark.id]);
    }
  }, [currentBenchmark, selectedBenchmarkIds.length]);

  useEffect(() => {
    if (dataSources?.standardProfiles?.length && selectedStandardIds.length === 0) {
      setSelectedStandardIds([dataSources.standardProfiles[0].id]);
    }
  }, [dataSources?.standardProfiles, selectedStandardIds.length]);

  function toggleBenchmarkSelection(benchmarkId: string) {
    setSelectedBenchmarkIds((current) =>
      current.includes(benchmarkId)
        ? current.filter((id) => id !== benchmarkId)
        : [...current, benchmarkId]
    );
  }

  function toggleStandardSelection(standardId: string) {
    setSelectedStandardIds((current) =>
      current.includes(standardId)
        ? current.filter((id) => id !== standardId)
        : [...current, standardId]
    );
  }

  function handleAnalysisRunChange(runId: string) {
    if (route.kind !== "analysis" || !analysisContext) {
      return;
    }

    setActiveExplanation(null);
    navigateTo(buildAnalysisPath(analysisContext.scenario.id, runId), true);
  }

  function renderScenarioAccessForm() {
    if (isScenarioUnlocked) {
      return (
        <div className="scenario-access-form">
          <p className="scenario-access-status" aria-live="polite">
            Scenario är upplåst i den här webbläsaren.
          </p>
          <button type="button" className="submit-button" onClick={() => navigateTo(buildScenarioPath())}>
            Öppna scenario / projekt
          </button>
        </div>
      );
    }

    return (
      <form className="scenario-access-form" onSubmit={handleScenarioAccessSubmit}>
        <label>
          Scenario-kod
          <input
            type="password"
            value={scenarioAccessCode}
            onChange={(event) => {
              setScenarioAccessCode(event.target.value);
              if (scenarioAccessError) {
                setScenarioAccessError(null);
              }
            }}
            placeholder="Ange kod"
            autoComplete="off"
          />
        </label>
        <p className="microcopy">
          Ange koden för att öppna scenario, historik, import, analys och jämförelse.
        </p>
        {scenarioAccessError ? (
          <p className="form-error" role="alert">
            {scenarioAccessError}
          </p>
        ) : null}
        <button type="submit" className="submit-button" disabled={isScenarioAccessLoading}>
          Lås upp scenario
        </button>
      </form>
    );
  }

  function renderChooserPage() {
    return (
      <div className="app-shell mode-shell">
        <section className="panel intro-strip chooser-strip">
          <div className="intro-title">
            <p className="eyebrow">Start</p>
            <h1>Klimatberäknaren</h1>
            <p className="lede">
              Ett verktyg för tidiga skeden där du kan välja snabbkalkyl för ett enskilt koncept eller
              scenario / projekt för alternativ, historik, analys och jämförelse.
            </p>
          </div>
          <div className="intro-meta-row">
            <span>Snabbkalkyl eller scenario</span>
            <span>Samma beräkningsmotor bakom kulisserna</span>
            <span>Icke-relevanta delar döljs helt per läge</span>
          </div>
        </section>

        <section className="panel chooser-panel">
          <div className="section-heading">
            <p className="eyebrow">Kort väljare</p>
            <h2>Var vill du börja?</h2>
            <p className="lede">
              Snabbkalkyl visar bara screening för en byggnad. Scenario visar projekt, historik,
              import, analys och jämförelser.
            </p>
          </div>
          <div className="mode-chooser-grid">
            <article className="mode-card">
              <div className="feature-coverage-card-head">
                <div>
                  <p className="eyebrow">Snabbkalkyl</p>
                  <h3>Snabb screening</h3>
                </div>
                <span className="feature-coverage-chip">Direktläge</span>
              </div>
              <p className="microcopy">
                För enstaka byggnad eller ett tidigt koncept när du vill få ett snabbt resultat utan
                projektstruktur.
              </p>
              <button
                type="button"
                className="submit-button"
                onClick={() => navigateTo(buildQuickPath())}
              >
                Öppna snabbkalkyl
              </button>
            </article>

            <article className="mode-card">
              <div className="feature-coverage-card-head">
                <div>
                  <p className="eyebrow">Scenario / projekt</p>
                  <h3>Alternativ och analys</h3>
                </div>
                <span className="feature-coverage-chip">
                  {isScenarioUnlocked ? "Upplåst" : "Låst"}
                </span>
              </div>
              <p className="microcopy">
                För flera scenarier, körhistorik, 3D/form, import och analyser där du behöver jämföra
                och förklara val.
              </p>
              {renderScenarioAccessForm()}
            </article>
          </div>
        </section>

        <section className="panel panel-soft">
          <div className="feature-status-row">
            <span>API: {apiHealth?.ok ? "Online" : "Okänd"}</span>
            <span>PERSISTENS: {apiHealth?.persistence.mode ?? "Okänd"}</span>
            <span>Workspace: {workspace ? "Laddad" : "Väntar"}</span>
            <span>Scenario: {currentScenario ? "Aktivt" : "Saknas"}</span>
          </div>
        </section>

        {workspaceError ? (
          <p className="floating-error" role="alert">
            {workspaceError}
          </p>
        ) : null}

        <ExplanationDrawer explanation={activeExplanation} onClose={() => setActiveExplanation(null)} />
      </div>
    );
  }

  function renderScenarioAccessPage() {
    return (
      <div className="app-shell mode-shell">
        <section className="panel intro-strip chooser-strip">
          <div className="intro-title">
            <p className="eyebrow">Scenario / projekt</p>
            <h1>Scenario är låst</h1>
            <p className="lede">
              Ange koden för att öppna projekt, historik, import, analys och jämförelse. Snabbkalkyl
              fortsätter att fungera utan åtkomstkod.
            </p>
          </div>
          <div className="intro-actions">
            <button type="button" className="ghost-button" onClick={() => navigateTo(buildHomePath())}>
              Till väljaren
            </button>
            <button type="button" className="ghost-button" onClick={() => navigateTo(buildQuickPath())}>
              Till snabbkalkyl
            </button>
          </div>
          <div className="intro-meta-row">
            <span>Koden minns i den här webbläsaren</span>
            <span>Scenario visar projekt, historik och analys</span>
            <span>Snabbkalkyl är fortfarande direkt åtkomlig</span>
          </div>
        </section>

        <section className="panel chooser-panel scenario-gate-panel">
          <div className="section-heading">
            <p className="eyebrow">Låst läge</p>
            <h2>Öppna scenario / projekt</h2>
            <p className="lede">
              Ange åtkomstkoden för att fortsätta till scenarioläget. Vi låser bara scenarioflödet,
              inte snabbkalkylen.
            </p>
          </div>
          {renderScenarioAccessForm()}
        </section>

        {workspaceError ? (
          <p className="floating-error" role="alert">
            {workspaceError}
          </p>
        ) : null}

        <ExplanationDrawer explanation={activeExplanation} onClose={() => setActiveExplanation(null)} />
      </div>
    );
  }

  function renderQuickPage() {
    return (
      <div className="app-shell quick-shell">
        <section className="panel intro-strip compact-strip">
          <div className="intro-title">
            <p className="eyebrow">Snabbkalkyl</p>
            <h1>Direktläge för enskild byggnad</h1>
            <p className="lede">
              Här visas bara snabb screening och resultat för ett koncept. Inga projektscenarier,
              jämförelser eller importflöden visas på den här sidan.
            </p>
          </div>
          <div className="intro-actions">
            <button type="button" className="ghost-button" onClick={() => navigateTo(buildHomePath())}>
              Byt läge
            </button>
            <button type="button" className="ghost-button" onClick={() => navigateTo(buildScenarioPath())}>
              Till scenario / projekt
            </button>
          </div>
          <div className="intro-meta-row">
            <span>Samma kalkylmotor som scenariot</span>
            <span>Endast snabb screening och resultat</span>
            <span>Relevanta delar för ett direktläge</span>
          </div>
        </section>

        <section className="panel panel-form quick-panel" id="quick-workspace">
          <div className="section-heading">
            <p className="eyebrow">Snabbkalkyl</p>
            <h2>Räkna ett koncept direkt</h2>
          </div>
          {renderCalculationForm(
            quickForm,
            updateQuickForm,
            handleQuickCalculate,
            isQuickSubmitting ? "Beräknar..." : "Beräkna klimatpåverkan",
            isQuickSubmitting
          )}
          {quickError ? (
            <p className="form-error" role="alert">
              {quickError}
            </p>
          ) : null}
        </section>

        <ResultMatrix
          title="Resultat för snabbkalkyl"
          result={quickResult}
          dataSources={dataSources}
          benchmarkProfiles={allBenchmarkProfiles}
          standardProfiles={dataSources?.standardProfiles ?? []}
          selectedBenchmarkIds={selectedBenchmarkIds}
          selectedStandardIds={selectedStandardIds}
          selectedMetric={selectedComparisonMetric}
          onExplain={(traceKey) => openExplanation(quickResult, traceKey)}
        />

        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Källor</p>
            <h2>Underlag för snabbkalkylen</h2>
          </div>
          {dataSources ? (
            <ul className="source-list">
              {dataSources.sources.slice(0, 3).map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <span>
                    {source.publisher} • {source.license}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="microcopy">Källkatalogen kunde inte laddas just nu.</p>
          )}
        </section>

        {workspaceError ? (
          <p className="floating-error" role="alert">
            {workspaceError}
          </p>
        ) : null}

        <ExplanationDrawer explanation={activeExplanation} onClose={() => setActiveExplanation(null)} />
      </div>
    );
  }

  if (route.kind === "analysis") {
    return (
      <div className="app-shell analysis-shell">
        <AnalysisPage
          project={analysisContext?.project ?? null}
          scenario={analysisContext?.scenario ?? null}
          dataSources={dataSources}
          benchmarkProfiles={allBenchmarkProfiles}
          standardProfiles={dataSources?.standardProfiles ?? []}
          selectedBenchmarkIds={selectedBenchmarkIds}
          selectedStandardIds={selectedStandardIds}
          selectedMetric={selectedComparisonMetric}
          selectedRunId={route.runId}
          onRunChange={handleAnalysisRunChange}
          onMetricChange={setSelectedComparisonMetric}
          onToggleBenchmark={toggleBenchmarkSelection}
          onToggleStandard={toggleStandardSelection}
          onExplain={(traceKey) => {
            if (analysisSelectedRun) {
              openExplanation(analysisSelectedRun.result, traceKey);
            }
          }}
          onBack={() => navigateTo(buildScenarioPath(), true)}
          onPrint={() => window.print()}
        />

        {workspaceError ? (
          <p className="floating-error" role="alert">
            {workspaceError}
          </p>
        ) : null}

        <ExplanationDrawer explanation={activeExplanation} onClose={() => setActiveExplanation(null)} />
      </div>
    );
  }

  if (route.kind === "home") {
    return renderChooserPage();
  }

  if (route.kind === "quick") {
    return renderQuickPage();
  }

  if (route.kind === "scenario" && !isScenarioUnlocked) {
    return renderScenarioAccessPage();
  }

  return (
    <div className="app-shell">
      <section className="panel intro-strip">
        <div className="intro-title">
          <p className="eyebrow">Kommunversion prototyp</p>
          <h1>Klimatberäknare för scenarier och planalternativ</h1>
          <p className="lede">
            Tät arbetsyta för projekt, scenarier och rapporterbara resultat med benchmark, körhistorik och utskriftsvänliga moduler.
          </p>
        </div>
        <div className="intro-meta-row">
          <span>Profil: {dataSources?.stockholmProfile ?? "Stockholm MVP 2026"}</span>
          <span>Screeningnivå för tidiga beslut</span>
          <span>Öppna källor och verifierbara antaganden</span>
        </div>
        <div className="intro-actions">
          <button type="button" className="ghost-button" onClick={() => navigateTo(buildHomePath())}>
            Byt läge
          </button>
          <button type="button" className="ghost-button" onClick={() => navigateTo(buildQuickPath())}>
            Snabbkalkyl
          </button>
        </div>
      </section>

      <section className="panel workspace-panel" id="workspace-panel">
        <div className="section-heading">
          <p className="eyebrow">Arbetsyta</p>
          <h2>Projektinfo och scenarioeditor i full bredd</h2>
        </div>

        <div className="workspace-card-grid">
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Organisation</p>
              <h3>Session och kommunprofil</h3>
            </div>
            {workspace?.session ? (
              <div className="session-card">
                <strong>{workspace.session.organizationName}</strong>
                <span>{workspace.session.email}</span>
                <span>Aktiv organisation: {workspace.session.organizationId}</span>
              </div>
            ) : (
              <form className="stacked-form" onSubmit={handleLogin}>
                <label>
                  E-post
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                  />
                </label>
                <label>
                  Organisation
                  <select
                    value={selectedOrganizationId}
                    onChange={(event) => setSelectedOrganizationId(event.target.value)}
                  >
                    {workspace?.organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    )) ?? <option value="stockholm-stad">Stockholms stad</option>}
                  </select>
                </label>
                <button className="submit-button" type="submit">
                  Öppna arbetsyta
                </button>
              </form>
            )}
            {currentBenchmark ? (
              <section className="inline-panel">
                <strong>{currentBenchmark.name}</strong>
                <span>Normalvärde per m2: {formatNumber(currentBenchmark.normalPerM2KgCo2e)}</span>
                <span>Målvärde per m2: {formatNumber(currentBenchmark.targetPerM2KgCo2e)}</span>
                <span>{currentBenchmark.sourceLabel} • v{currentBenchmark.version}</span>
              </section>
            ) : null}
          </section>

          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Projekt</p>
              <h3>Välj eller skapa projekt</h3>
            </div>
            <form className="stacked-form" onSubmit={handleCreateProject}>
              <label>
                Nytt projekt
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="Exempel: Ny stadsdel 2040"
                  minLength={2}
                  required
                />
              </label>
              <button className="ghost-button" type="submit" disabled={newProjectName.trim().length < 2}>
                Skapa projekt
              </button>
            </form>
            <div className="project-list">
              {projects.map((project) => (
                <div key={project.id} className="list-entry-row">
                  <button
                    type="button"
                    className={`list-button ${
                      currentProject?.id === project.id ? "list-button-active" : ""
                    }`}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setComparison(null);
                    }}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.scenarios.length} scenarier</span>
                  </button>
                  <button
                    type="button"
                    className="ghost-button ghost-button-small danger-button"
                    onClick={() => handleDeleteProject(project.id)}
                  >
                    Ta bort projekt
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Scenarier</p>
              <h3>Välj scenario och jämförelsemått</h3>
            </div>
            {currentProject ? (
              <>
                <form className="stacked-form" onSubmit={handleCreateScenario}>
                  <label>
                    Nytt scenario i {currentProject.name}
                    <input
                      value={newScenarioName}
                      onChange={(event) => setNewScenarioName(event.target.value)}
                      placeholder="Exempel: Tät struktur A"
                      minLength={2}
                      required
                    />
                  </label>
                  <button className="ghost-button" type="submit" disabled={newScenarioName.trim().length < 2}>
                    Skapa scenario
                  </button>
                </form>
                <div className="project-list">
                  {currentProject.scenarios.map((scenario) => (
                    <div key={scenario.id} className="list-entry-row">
                      <button
                        type="button"
                        className={`list-button ${
                          currentScenario?.id === scenario.id ? "list-button-active" : ""
                        }`}
                        onClick={() => {
                          setSelectedScenarioId(scenario.id);
                          setComparison(null);
                        }}
                      >
                        <strong>{scenario.name}</strong>
                        <span>{scenario.runs?.length ?? 0} körningar</span>
                      </button>
                      <button
                        type="button"
                        className="ghost-button ghost-button-small danger-button"
                        onClick={() => handleDeleteScenario(scenario.id)}
                      >
                        Ta bort scenario
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segmented-control" role="tablist" aria-label="Jämförelsemått">
                  {COMPARISON_METRICS.map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      className={`pill-button ${selectedComparisonMetric === metric ? "pill-button-active" : ""}`}
                      onClick={() => setSelectedComparisonMetric(metric)}
                    >
                      {getMetricLabel(metric)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="microcopy">Skapa ett projekt för att börja bygga scenarier.</p>
            )}
          </section>
        </div>

        <ScenarioTable project={currentProject} />

        <DecisionWorkbench
          id="decision-workbench"
          project={currentProject}
          selectedMetric={selectedComparisonMetric}
          activeScenarioId={currentScenario?.id}
          onSelectScenario={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setComparison(null);
          }}
          onDuplicateScenario={duplicateScenarioById}
          onOpenAnalysis={openAnalysis}
        />

        <>
            <section className="support-grid">
              <section className="report-card" id="import-panel">
                <div className="section-heading">
                  <p className="eyebrow">Import</p>
                  <h3>GeoJSON eller CSV</h3>
                </div>
                <p className="microcopy">
                  GeoJSON kräver geometri och egenskaper som `name`, `buildingType`,
                  `grossFloorAreaM2`, `buildYear`, `frameMaterial`, `energyStandard`, `heatingType`
                  samt kan även ta platsdata, formfaktor och lägesdata som `buildingForm`,
                  `urbanContext`, `siteAreaM2`, `parkingSpaces`, `landType`, `foundationType`,
                  `interventionType`, `existingGrossFloorAreaM2`, `retainedStructureSharePct`,
                  `addedGrossFloorAreaM2` och `retrofitDepth`.
                </p>
                <input
                  type="file"
                  accept=".json,.geojson,.csv"
                  onChange={handleImportFile}
                  disabled={!currentScenario}
                />
                {currentScenario ? (
                  <p className="microcopy">
                    CSV-import visas utan polygoner men kan fortfarande räknas och jämföras.
                  </p>
                ) : (
                  <div className="empty-state-workbench">
                    <span>Importen låses upp när ett scenario är valt eller skapat.</span>
                    <span>Här kan du sedan läsa in GeoJSON eller CSV och direkt få nytt resultat.</span>
                  </div>
                )}
              </section>

              <section className="report-card">
                <div className="section-heading">
                  <p className="eyebrow">Benchmarkurval</p>
                  <h3>Profiler för rapporten</h3>
                </div>
                <div className="benchmark-pills" aria-label="Benchmarkprofiler">
                  {allBenchmarkProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      className={`pill-button ${selectedBenchmarkIds.includes(profile.id) ? "pill-button-active" : ""}`}
                      onClick={() => toggleBenchmarkSelection(profile.id)}
                    >
                      {profile.name}
                    </button>
                  ))}
                </div>
                <div className="benchmark-pills" aria-label="Standardprofiler">
                  {(dataSources?.standardProfiles ?? []).map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      className={`pill-button ${selectedStandardIds.includes(profile.id) ? "pill-button-active" : ""}`}
                      onClick={() => toggleStandardSelection(profile.id)}
                    >
                      {profile.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="report-card">
                <div className="section-heading">
                  <p className="eyebrow">Jämför</p>
                  <h3>Scenario mot scenario</h3>
                </div>
                {currentProject && currentProject.scenarios.length >= 2 ? (
                  <div className="stacked-form">
                    <label>
                      Bas
                      <select
                        value={compareBaseId}
                        onChange={(event) => setCompareBaseId(event.target.value)}
                      >
                        {currentProject.scenarios.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Kandidat
                      <select
                        value={compareCandidateId}
                        onChange={(event) => setCompareCandidateId(event.target.value)}
                      >
                        {currentProject.scenarios.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="ghost-button" onClick={handleCompareScenarios}>
                      Jämför scenarier
                    </button>
                  </div>
                ) : (
                  <div className="empty-state-workbench">
                    <span>Skapa minst två scenarier i projektet för att jämföra.</span>
                    <span>När det finns två beräknade alternativ visas jämförelsen här utan att du behöver lämna sidan.</span>
                  </div>
                )}
              </section>
            </section>

            <section className="panel panel-form">
              <div className="section-heading">
                <p className="eyebrow">Scenarioeditor</p>
                <h2>{currentScenario?.name ?? "Välj scenario för att redigera"}</h2>
              </div>
              <div className="toolbar-row">
                <span className="badge">
                  {currentScenario ? (currentScenario.mode === "plan" ? "Planobjektläge" : "Snabbt scenario") : "Scenario låst"}
                </span>
                <div className="segmented-control segmented-control-compact" role="tablist" aria-label="Scenarioeditorläge">
                  <button
                    type="button"
                    className={`pill-button ${scenarioEditorMode === "single" ? "pill-button-active" : ""}`}
                    onClick={() => setScenarioEditorMode("single")}
                    disabled={!currentScenario}
                  >
                    En byggnad
                  </button>
                  <button
                    type="button"
                    className={`pill-button ${scenarioEditorMode === "multi" ? "pill-button-active" : ""}`}
                    onClick={() => setScenarioEditorMode("multi")}
                    disabled={!currentScenario}
                  >
                    Flera byggnader
                  </button>
                </div>
                <button type="button" className="ghost-button" onClick={handleDuplicateScenario} disabled={!currentScenario}>
                  Duplicera scenario
                </button>
                {scenarioResult && currentScenario ? (
                  <>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => exportResultToCsv(`${currentScenario.name}.csv`, scenarioResult)}
                    >
                      Exportera CSV
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        exportResultToPng(`${currentScenario.name}.png`, scenarioResult, currentScenario.name)
                      }
                    >
                      Exportera PNG
                    </button>
                    </>
                  ) : null}
              </div>
              {scenarioEditorMode === "multi" ? (
                <>
                  <p className="microcopy">
                    Tabellen används när scenariot ska innehålla flera byggnader eller flera alternativa
                    kolumner. Varje rad blir då ett planobjekt i scenariot.
                  </p>
                  <ScenarioMatrixEditor
                    scenario={currentScenario}
                    onImportRows={handleMatrixImportRows}
                    disabled={isScenarioSubmitting || !currentScenario}
                  />
                </>
              ) : (
                <>
                  <p className="microcopy">
                    Enkel byggnadsvy. Här redigerar du ett koncept i taget utan tabellinmatningens extra
                    kolumner.
                  </p>
                  {currentScenario ? (
                    renderCalculationForm(
                      scenarioForm,
                      updateScenarioForm,
                      handleScenarioCalculate,
                      isScenarioSubmitting ? "Beräknar scenario..." : "Beräkna scenario",
                      isScenarioSubmitting
                    )
                  ) : (
                    <div className="empty-state-workbench">
                      <strong>Välj eller skapa ett scenario för att låsa upp kalkylformuläret.</strong>
                      <span>Byggnadsdata, import och 3D-vy finns redan här men blir redigerbara först när ett scenario är aktivt.</span>
                    </div>
                  )}
                </>
              )}
              <Building3DViewer
                id="building3d-panel"
                scenario={currentScenario}
                result={scenarioResult}
                onExplain={(traceKey) =>
                  openExplanation(currentScenario?.latestResult ?? scenarioResult, traceKey)
                }
                onScenarioRefresh={() => refreshWorkspace(currentProject?.organizationId ?? selectedOrganizationId)}
              />
            </section>

            {currentScenario?.planObjects.length ? (
              <section className="panel panel-soft">
                <div className="section-heading">
                  <p className="eyebrow">Planobjekt</p>
                  <h3>Importerade objekt</h3>
                </div>
                <div className="scenario-table">
                  {currentScenario.planObjects.map((planObject) => (
                    <article key={planObject.id} className="scenario-row">
                      <strong>{planObject.name}</strong>
                      <span>{planObject.objectType}</span>
                      <span>{formatNumber(planObject.grossFloorAreaM2)} m2</span>
                      <span>{LABELS.buildingForm[planObject.quickInput.buildingForm ?? "normal"]}</span>
                      <span>{LABELS.urbanContext[planObject.quickInput.urbanContext ?? "urban"]}</span>
                      <span>{planObject.quickInput.interventionType ?? "nybyggnad"}</span>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="panel panel-soft">
                <div className="section-heading">
                  <p className="eyebrow">Planobjekt</p>
                  <h3>Importerade objekt</h3>
                </div>
                <div className="empty-state-workbench">
                  <strong>Inga planobjekt är importerade ännu.</strong>
                  <span>Så snart du laddar in GeoJSON eller tabellrader visas byggnaderna här och följer med i resultatet.</span>
                </div>
              </section>
            )}

            <ResultMatrix
              id="scenario-results"
              title="Kommunalt scenarioresultat"
              scenario={currentScenario}
              result={scenarioResult}
              comparison={comparison}
              dataSources={dataSources}
              benchmarkProfiles={allBenchmarkProfiles}
              standardProfiles={dataSources?.standardProfiles ?? []}
              selectedBenchmarkIds={selectedBenchmarkIds}
              selectedStandardIds={selectedStandardIds}
              selectedMetric={selectedComparisonMetric}
              baseRunId={selectedBaseRunId}
              candidateRunId={selectedCandidateRunId}
              onBaseRunChange={setSelectedBaseRunId}
              onCandidateRunChange={setSelectedCandidateRunId}
              onOpenAnalysis={openAnalysis}
              onExplain={(traceKey) => openExplanation(currentScenario.latestResult ?? scenarioResult, traceKey)}
            />

            <ScenarioComparisonBoard
              id="comparison-board"
              project={currentProject}
              benchmarkProfiles={allBenchmarkProfiles}
              standardProfiles={dataSources?.standardProfiles ?? []}
              selectedBenchmarkIds={selectedBenchmarkIds}
              selectedStandardIds={selectedStandardIds}
              selectedMetric={selectedComparisonMetric}
              focusScenarioId={currentScenario?.id}
              onToggleBenchmark={toggleBenchmarkSelection}
              onToggleStandard={toggleStandardSelection}
              onMetricChange={setSelectedComparisonMetric}
            />
          </>
      </section>

      <section className="support-grid">
        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Källor</p>
            <h2>Versionsstyrda data och öppna källor</h2>
          </div>
          {dataSources ? (
            <>
              <ul className="dataset-list">
                {dataSources.datasets.map((dataset) => (
                  <li key={dataset.dataset}>
                    <strong>{dataset.dataset}</strong>
                    <span>
                      Version {dataset.version} • uppdaterad {dataset.updatedAt}
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="source-list">
                {dataSources.sources.map((source) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                    <span>
                      {source.publisher} • {source.license}
                    </span>
                    {source.note ? <p className="microcopy">{source.note}</p> : null}
                  </li>
                ))}
              </ul>
              <div className="inline-panel">
                <strong>{dataSources.methodCatalog.length} metodregler i katalogen</strong>
                <span>
                  Resultatpanelerna använder dessa regler för att visa standardstöd, statistik,
                  forskning och schabloner per värde.
                </span>
              </div>
            </>
          ) : (
            <p className="microcopy">Källkatalogen kunde inte laddas just nu.</p>
          )}
        </section>

        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Status</p>
            <h2>Vad den här versionen kan nu</h2>
          </div>
          <ul className="insight-list">
            <li>
              <strong>Projekt och scenarier</strong>
              <span>Du kan skapa flera alternativ per projekt och jämföra dem mot varandra.</span>
            </li>
            <li>
              <strong>Benchmark och målgap</strong>
              <span>Resultat visas mot normalvärden och målvärden med tydlig diff i procent och absoluta tal.</span>
            </li>
            <li>
              <strong>Import och kartvy</strong>
              <span>GeoJSON och CSV kan importeras för scenarioanalys, och GeoJSON visas i en enkel kartvy.</span>
            </li>
          </ul>
        </section>
      </section>

      {workspaceError ? (
        <p className="floating-error" role="alert">
          {workspaceError}
        </p>
      ) : null}

      <ExplanationDrawer explanation={activeExplanation} onClose={() => setActiveExplanation(null)} />
    </div>
  );
}
