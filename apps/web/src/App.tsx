import {
  BUILDING_TYPES,
  COMPARISON_METRICS,
  ENERGY_STANDARDS,
  FOUNDATION_TYPES,
  FRAME_MATERIALS,
  HEATING_TYPES,
  INTERVENTION_TYPES,
  LAND_TYPES,
  LABELS,
  RETROFIT_DEPTHS,
  formatNumber,
  type BenchmarkProfile,
  type BenchmarkComparison,
  type CalculateRequest,
  type CalculationExplanation,
  type CalculationResult,
  type ComparisonMetric,
  type DataSourcesResponse,
  type Project,
  type ScenarioComparison,
  type StandardProfile,
  type UserSession,
  type WorkspaceResponse
} from "../../../packages/shared/src";
import { startTransition, useEffect, useMemo, useState } from "react";

import {
  calculateClimateImpact,
  calculateScenarioApi,
  compareScenariosApi,
  createProjectApi,
  createScenarioApi,
  duplicateScenarioApi,
  fetchDataSources,
  fetchWorkspace,
  importGeoJsonApi,
  importTabularApi,
  loginSession
} from "./lib/api";
import { BreakdownChart } from "./components/BreakdownChart";
import { ExplanationDrawer } from "./components/ExplanationDrawer";
import { GeoJsonMap } from "./components/GeoJsonMap";
import { MetricCard } from "./components/MetricCard";
import { ExplainButton } from "./components/ExplainButton";

interface FormState {
  buildingType: CalculateRequest["buildingType"];
  grossFloorAreaM2: string;
  buildYear: string;
  frameMaterial: CalculateRequest["frameMaterial"];
  energyStandard: CalculateRequest["energyStandard"];
  heatingType: CalculateRequest["heatingType"];
  specificEnergyUseKwhM2Year: string;
  wallUValue: string;
  roofUValue: string;
  windowUValue: string;
  estimatedResidents: string;
  estimatedWorkers: string;
  siteAreaM2: string;
  floorsAboveGround: string;
  buildingFootprintM2: string;
  glazingRatioPct: string;
  parkingSpaces: string;
  siteLat: string;
  siteLon: string;
  distanceToTransitStopM: string;
  distanceToRailStationM: string;
  departuresPerHour: string;
  landType: NonNullable<CalculateRequest["landType"]>;
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

const initialForm: FormState = {
  buildingType: "flerbostadshus",
  grossFloorAreaM2: "",
  buildYear: "",
  frameMaterial: "betong",
  energyStandard: "normal",
  heatingType: "fjarrvarme",
  specificEnergyUseKwhM2Year: "",
  wallUValue: "",
  roofUValue: "",
  windowUValue: "",
  estimatedResidents: "",
  estimatedWorkers: "",
  siteAreaM2: "",
  floorsAboveGround: "",
  buildingFootprintM2: "",
  glazingRatioPct: "",
  parkingSpaces: "",
  siteLat: "",
  siteLon: "",
  distanceToTransitStopM: "",
  distanceToRailStationM: "",
  departuresPerHour: "",
  landType: "tidigare_bebyggd",
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
    glazingRatioPct: payload.glazingRatioPct ? String(payload.glazingRatioPct) : "",
    parkingSpaces: payload.parkingSpaces ? String(payload.parkingSpaces) : "",
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

  const glazingRatioPct = toNumber(form.glazingRatioPct);
  if (glazingRatioPct !== undefined) {
    payload.glazingRatioPct = glazingRatioPct;
  }

  const parkingSpaces = toNumber(form.parkingSpaces);
  if (parkingSpaces !== undefined) {
    payload.parkingSpaces = parkingSpaces;
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

function ScenarioComparisonBoard({
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

  if (scenarios.length < 2) {
    return null;
  }

  const focusScenario =
    scenarios.find((scenario) => scenario.id === focusScenarioId) ?? scenarios[0];
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
    const baseResult = focusScenario.latestResult;

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
      const result = focusScenario.latestResult as CalculationResult | undefined;
      if (!result) {
        return false;
      }

      const buildingType = focusScenario.quickInput?.buildingType;
      const interventionType = focusScenario.quickInput?.interventionType ?? "nybyggnad";

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
      unit: getScenarioMetricUnit(focusScenario.latestResult as CalculationResult, selectedMetric),
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

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Jämförelsevy</p>
        <h3>Flera varianter mot flera benchmarkprofiler</h3>
      </div>

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
          const baseValue = getScenarioMetricValue(
            focusScenario.latestResult as CalculationResult,
            selectedMetric
          );
          const delta = value - baseValue;

          return (
            <div
              key={scenario.id}
              className={`bar-row comparison-visual-row ${
                scenario.id === focusScenario.id ? "comparison-visual-row-active" : ""
              }`}
            >
              <div className="bar-copy">
                <strong>{scenario.name}</strong>
                <span>
                  {formatNumber(value)} {getScenarioMetricUnit(result, selectedMetric)}
                  {scenario.id !== focusScenario.id ? ` • ${delta > 0 ? "+" : ""}${formatNumber(delta)}` : " • Bas"}
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
  title,
  result,
  comparison,
  onExplain
}: {
  title: string;
  result: CalculationResult | null;
  comparison?: ScenarioComparison | null;
  onExplain?: (traceKey: string) => void;
}) {
  if (!result) {
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

  const methodStatus = getMethodStatus(result);

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Resultat</p>
          <h2>{title}</h2>
        </div>
        <div className="metrics-grid">
          <MetricCard
            label={result.totals.label}
            value={result.totals.value}
            unit={result.totals.unit}
            uncertaintyPct={result.uncertaintyRangePct}
            accent="sun"
            subtitle="Embodied + drift över livslängd"
            onExplain={
              result.totals.traceKey && onExplain
                ? () => onExplain(result.totals.traceKey ?? "totals")
                : undefined
            }
          />
          <MetricCard
            label={result.perM2.label}
            value={result.perM2.value}
            unit={result.perM2.unit}
            uncertaintyPct={result.uncertaintyRangePct}
            accent="forest"
            subtitle="Används för benchmark mellan alternativ"
            onExplain={
              result.perM2.traceKey && onExplain
                ? () => onExplain(result.perM2.traceKey ?? "perM2")
                : undefined
            }
          />
          <MetricCard
            label={result.perPerson.label}
            value={result.perPerson.value}
            unit={result.perPerson.unit}
            uncertaintyPct={result.uncertaintyRangePct}
            accent="forest"
            subtitle={`${result.population.totalPeople} personer i underlaget`}
            onExplain={
              result.perPerson.traceKey && onExplain
                ? () => onExplain(result.perPerson.traceKey ?? "perPerson")
                : undefined
            }
          />
          {result.perHa ? (
            <MetricCard
              label={result.perHa.label}
              value={result.perHa.value}
              unit={result.perHa.unit}
              uncertaintyPct={result.uncertaintyRangePct}
              accent="forest"
              subtitle="Visas när platsyta finns i underlaget"
              onExplain={
                result.perHa.traceKey && onExplain
                  ? () => onExplain(result.perHa?.traceKey ?? "perHa")
                  : undefined
              }
            />
          ) : null}
        </div>
      </section>

      <section className="details-grid">
        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Mobilitet</p>
            <h3>Livscykel för användarresor</h3>
          </div>
          <div className="metrics-grid">
            <MetricCard
              label="Mobilitet per år"
              value={result.mobility.annualKgCo2e}
              unit="kg CO2e/år"
              uncertaintyPct={result.uncertaintyRangePct}
              accent="forest"
              subtitle={`Profil ${result.mobility.inputs.accessibilityBand}`}
              onExplain={onExplain ? () => onExplain("mobility.total") : undefined}
            />
            <MetricCard
              label="Mobilitet över livslängd"
              value={result.mobility.lifetimeKgCo2e}
              unit="kg CO2e"
              uncertaintyPct={result.uncertaintyRangePct}
              accent="sun"
              subtitle="Ingår i huvudtotalen"
              onExplain={onExplain ? () => onExplain("mobility.total") : undefined}
            />
          </div>
        </section>

        {result.baselineExisting && result.baselineComparison ? (
          <section className="panel panel-soft">
            <div className="section-heading">
              <p className="eyebrow">Före och efter</p>
              <h3>Basfall mot intervention</h3>
            </div>
            <div className="comparison-list">
              <article className="comparison-card">
                <strong className="inline-with-action">
                  <span>Befintligt basfall</span>
                  {onExplain ? (
                    <ExplainButton label="Befintligt basfall" onClick={() => onExplain("baseline.existing")} />
                  ) : null}
                </strong>
                <span>
                  Total {formatNumber(result.baselineExisting.totalKgCo2e)} kg CO2e
                </span>
                <span>
                  {formatNumber(result.baselineExisting.annualOperationalKgCo2e)} kg CO2e/år drift
                </span>
              </article>
              <article className="comparison-card">
                <strong className="inline-with-action">
                  <span>Delta mot basfall</span>
                  {onExplain ? (
                    <ExplainButton label="Delta mot basfall" onClick={() => onExplain("baseline.delta")} />
                  ) : null}
                </strong>
                <span>
                  {result.baselineComparison.totalDeltaKgCo2e > 0 ? "+" : ""}
                  {formatNumber(result.baselineComparison.totalDeltaKgCo2e)} kg CO2e totalt
                </span>
                <span>
                  {result.baselineComparison.annualOperationalDeltaKgCo2e > 0 ? "+" : ""}
                  {formatNumber(result.baselineComparison.annualOperationalDeltaKgCo2e)} kg CO2e/år drift
                </span>
                <span>
                  {result.baselineComparison.lifetimeMobilityDeltaKgCo2e > 0 ? "+" : ""}
                  {formatNumber(result.baselineComparison.lifetimeMobilityDeltaKgCo2e)} kg CO2e mobilitet
                </span>
                {result.baselineComparison.avoidedNewbuildKgCo2e !== undefined ? (
                  <span>
                    Undviken nybyggnadsekvivalent {formatNumber(result.baselineComparison.avoidedNewbuildKgCo2e)} kg CO2e
                  </span>
                ) : null}
              </article>
            </div>
          </section>
        ) : null}
      </section>

      <section className="details-grid">
        <section className="panel panel-soft">
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

        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Benchmark</p>
            <h3>Normalvärden och målvärden</h3>
          </div>
          <div className="comparison-list">
            {[...result.vsBenchmark, ...result.vsTarget].map((item) => (
              <article key={`${item.referenceLabel}-${item.metric}`} className="comparison-card">
                <strong className="inline-with-action">
                  <span>
                    {item.referenceLabel} • {item.label}
                  </span>
                  {item.traceKey && onExplain ? (
                    <ExplainButton label={`${item.referenceLabel} ${item.label}`} onClick={() => onExplain(item.traceKey ?? "perM2")} />
                  ) : null}
                </strong>
                <span>
                  Utfall {formatNumber(item.actualValue)} mot referens {formatNumber(item.referenceValue)}
                </span>
                <span
                  className={`comparison-status comparison-status-${
                    item.status === "below" ? "good" : item.status === "above" ? "warn" : "neutral"
                  }`}
                >
                  {item.delta > 0 ? "+" : ""}
                  {formatNumber(item.delta)} ({item.deltaPct}%)
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Beslutsstöd</p>
            <h3>Största utsläppsdrivare</h3>
          </div>
          <ul className="insight-list">
            {result.topDrivers.map((driver) => (
              <li key={driver.key}>
                <strong className="inline-with-action">
                  <span>
                    {driver.label} • {formatNumber(driver.impactKgCo2e)} kg CO2e
                  </span>
                  {driver.traceKey && onExplain ? (
                    <ExplainButton label={driver.label} onClick={() => onExplain(driver.traceKey ?? "totals")} />
                  ) : null}
                </strong>
                <span>{driver.explanation}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Åtgärder</p>
            <h3>Rekommenderade nästa steg</h3>
          </div>
          <ul className="insight-list">
            {result.recommendedActions.map((action) => (
              <li key={action.id}>
                <strong className="inline-with-action">
                  <span>
                    {action.title} • {action.expectedImpact}
                  </span>
                  {action.traceKey && onExplain ? (
                    <ExplainButton label={action.title} onClick={() => onExplain(action.traceKey ?? "totals")} />
                  ) : null}
                </strong>
                <span>{action.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Antaganden</p>
            <h3>Metod och källor</h3>
          </div>
          <dl className="assumption-list">
            {result.assumptions.map((assumption) => (
              <div key={assumption.label}>
                <dt>{assumption.label}</dt>
                <dd>{assumption.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </section>

      <InputCatalog result={result} />

      {comparison ? (
        <section className="panel panel-soft">
          <div className="section-heading">
            <p className="eyebrow">Scenariojämförelse</p>
            <h3>Delta mellan alternativ</h3>
          </div>
          <div className="comparison-list">
            {comparison.metrics.map((metric) => (
              <article key={metric.metric} className="comparison-card">
                <strong>{metric.metric}</strong>
                <span>
                  Bas {formatNumber(metric.baseValue)} → Kandidat {formatNumber(metric.candidateValue)}
                </span>
                <span>{metric.delta > 0 ? "+" : ""}{formatNumber(metric.delta)} ({metric.deltaPct}%)</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="details-grid">
        <BreakdownChart
          title="Embodied klimatpåverkan"
          items={result.embodied.breakdown}
          onExplain={onExplain}
        />
        <BreakdownChart
          title="Driftutsläpp per år"
          items={result.operational.breakdown}
          onExplain={onExplain}
        />
        <BreakdownChart
          title="Mobilitet per år"
          items={result.mobility.breakdown}
          onExplain={onExplain}
        />
      </section>

      {result.byPlanObject?.length ? <GeoJsonMap planObjects={result.byPlanObject} /> : null}
    </>
  );
}

function ScenarioTable({ project }: { project: Project | null }) {
  if (!project || project.scenarios.length === 0) {
    return null;
  }

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Scenarioöversikt</p>
        <h3>{project.name}</h3>
      </div>
      <div className="scenario-table">
        {project.scenarios.map((scenario) => (
          <article key={scenario.id} className="scenario-row">
            <strong>{scenario.name}</strong>
            <span>{scenario.mode === "plan" ? "Planobjekt" : "Snabbkalkyl"}</span>
            <span>
              {scenario.latestResult
                ? `${formatNumber(scenario.latestResult.totals.value)} kg CO2e`
                : "Ej beräknad"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [dataSources, setDataSources] = useState<DataSourcesResponse | null>(null);
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

  useEffect(() => {
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

  function updateQuickForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setQuickForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateScenarioForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setScenarioForm((current) => ({
      ...current,
      [key]: value
    }));
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
      if (!newProjectName.trim()) {
        throw new Error("Ange ett projektnamn.");
      }

      const project = await createProjectApi({
        organizationId: workspace?.session?.organizationId ?? selectedOrganizationId,
        name: newProjectName
      });

      setNewProjectName("");
      await refreshWorkspace(project.organizationId);
      setSelectedProjectId(project.id);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Projektet kunde inte skapas.");
    }
  }

  async function handleCreateScenario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);

    try {
      if (!currentProject) {
        throw new Error("Skapa eller välj ett projekt först.");
      }

      if (!newScenarioName.trim()) {
        throw new Error("Ange ett scenarionamn.");
      }

      let quickInput: CalculateRequest | undefined;
      try {
        quickInput = buildPayload(scenarioForm);
      } catch {
        quickInput = undefined;
      }

      const scenario = await createScenarioApi(currentProject.id, {
        name: newScenarioName,
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

  async function handleDuplicateScenario() {
    setWorkspaceError(null);

    try {
      if (!currentProject || !currentScenario) {
        throw new Error("Välj ett scenario att duplicera.");
      }

      const duplicate = await duplicateScenarioApi(
        currentProject.id,
        currentScenario.id,
        `${currentScenario.name} alternativ`
      );
      await refreshWorkspace(currentProject.organizationId);
      setSelectedScenarioId(duplicate.id);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Scenariot kunde inte dupliceras."
      );
    }
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

  function renderCalculationForm(
    form: FormState,
    update: <K extends keyof FormState>(key: K, value: FormState[K]) => void,
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void,
    submitLabel: string,
    disabled = false
  ) {
    return (
      <form onSubmit={onSubmit} className="form-grid">
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

  return (
    <div className="app-shell">
      <section className="city-ribbon" aria-label="Pilotidentitet">
        <span>Stockholm-först pilot</span>
        <span>Kommunal arbetsyta för tidiga klimatjämförelser</span>
        <span>Öppna källor och verifierbara antaganden</span>
      </section>

      <header className="hero panel">
        <div>
          <div className="hero-meta">
            <span>Planering</span>
            <span>Bygg och mobilitet</span>
            <span>Scenariojämförelse</span>
          </div>
          <p className="eyebrow">Kommunversion prototyp</p>
          <h1>Klimatberäknare för scenarier och planalternativ</h1>
          <p className="lede">
            Bygg vidare från snabbkalkyl till kommunal arbetsyta med projekt, scenarier, benchmark,
            målvärden, GeoJSON-import och scenariojämförelse.
          </p>
          <p className="microcopy">
            Pilot för utvalda testanvändare. Resultaten är screeningnivå för tidiga beslut och ska
            inte tolkas som full LCA, certifiering eller myndighetsbedömning.
          </p>
        </div>
        <div className="hero-badge">
          <span>Tidigt beslutsstöd</span>
          <strong>Snabbkalkyl och kommunarbetsyta i samma vy</strong>
          <p>Profil: {dataSources?.stockholmProfile ?? "Stockholm MVP 2026"}</p>
          <ul className="hero-badge-list">
            <li>Projekt och scenarier</li>
            <li>Benchmark och standardprofiler</li>
            <li>Källspår per beräkning</li>
          </ul>
        </div>
      </header>

      <section className="panel panel-soft">
        <div className="section-heading">
          <p className="eyebrow">Pilotstatus</p>
          <h2>Begränsad pilot med versionsstyrda källor</h2>
        </div>
        <p className="microcopy">
          Piloten är avsedd för kommuner, planerare och projektteam som vill jämföra alternativ i
          tidiga skeden. Källspår, antaganden och standardprofiler visas direkt i gränssnittet.
        </p>
      </section>

      <div className="workspace-layout">
        <aside className="panel workspace-sidebar">
          <div className="section-heading">
            <p className="eyebrow">Organisation</p>
            <h2>Kommunarbetsyta</h2>
          </div>

          {workspace?.session ? (
            <div className="session-card">
              <strong>{workspace.session.organizationName}</strong>
              <span>{workspace.session.email}</span>
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
              <span>{allBenchmarkProfiles.length} benchmarkprofiler tillgängliga i jämförelsevyn</span>
              <span>{dataSources?.standardProfiles.length ?? 0} standardprofiler tillgängliga i jämförelsevyn</span>
            </section>
          ) : null}

          <form className="stacked-form" onSubmit={handleCreateProject}>
            <label>
              Nytt projekt
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Exempel: Ny stadsdel 2040"
              />
            </label>
            <button className="ghost-button" type="submit">
              Skapa projekt
            </button>
          </form>

          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
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
            ))}
          </div>

          {currentProject ? (
            <form className="stacked-form" onSubmit={handleCreateScenario}>
              <label>
                Nytt scenario i {currentProject.name}
                <input
                  value={newScenarioName}
                  onChange={(event) => setNewScenarioName(event.target.value)}
                  placeholder="Exempel: Tät struktur A"
                />
              </label>
              <button className="ghost-button" type="submit">
                Skapa scenario
              </button>
            </form>
          ) : null}
        </aside>

        <section className="workspace-main">
          <ScenarioTable project={currentProject} />

          <section className="panel">
            <div className="section-heading">
              <p className="eyebrow">Scenarioeditor</p>
              <h2>{currentScenario?.name ?? "Välj eller skapa ett scenario"}</h2>
            </div>
            {currentScenario ? (
              <>
                <div className="toolbar-row">
                  <span className="badge">
                    {currentScenario.mode === "plan" ? "Planobjektläge" : "Snabbt scenario"}
                  </span>
                  <button type="button" className="ghost-button" onClick={handleDuplicateScenario}>
                    Duplicera scenario
                  </button>
                  {scenarioResult ? (
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
                {renderCalculationForm(
                  scenarioForm,
                  updateScenarioForm,
                  handleScenarioCalculate,
                  isScenarioSubmitting ? "Beräknar scenario..." : "Beräkna scenario",
                  isScenarioSubmitting
                )}
              </>
            ) : (
              <div className="empty-state">
                <strong>Skapa ett projekt och ett scenario för att börja.</strong>
                <p>Scenarioflödet låter dig spara alternativ, importera planobjekt och jämföra mot målvärden.</p>
              </div>
            )}
          </section>

          {currentScenario ? (
            <section className="details-grid">
              <section className="panel panel-soft">
                <div className="section-heading">
                  <p className="eyebrow">Import</p>
                  <h3>GeoJSON eller CSV</h3>
                </div>
                <p className="microcopy">
                  GeoJSON kräver geometri och egenskaper som `name`, `buildingType`,
                  `grossFloorAreaM2`, `buildYear`, `frameMaterial`, `energyStandard`, `heatingType`
                  samt kan även ta platsdata, transitdata och ingreppsfält som `siteAreaM2`,
                  `parkingSpaces`, `landType`, `foundationType`, `interventionType`,
                  `existingGrossFloorAreaM2`, `retainedStructureSharePct`,
                  `addedGrossFloorAreaM2` och `retrofitDepth`.
                </p>
                <input type="file" accept=".json,.geojson,.csv" onChange={handleImportFile} />
                <p className="microcopy">
                  CSV-import visas utan polygoner men kan fortfarande räknas och jämföras.
                </p>
              </section>

              <section className="panel panel-soft">
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
                  <p className="microcopy">Skapa minst två scenarier i projektet för att jämföra.</p>
                )}
              </section>
            </section>
          ) : null}

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
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <ScenarioComparisonBoard
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

          <ResultMatrix
            title="Kommunalt scenarioresultat"
            result={scenarioResult}
            comparison={comparison}
            onExplain={(traceKey) => openExplanation(scenarioResult, traceKey)}
          />
        </section>
      </div>

      <section className="quick-layout">
        <section className="panel panel-form">
          <div className="section-heading">
            <p className="eyebrow">Snabb byggnadskalkyl</p>
            <h2>Direktläge för enskild byggnad</h2>
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

        <section className="results-column">
          <ResultMatrix
            title="Resultat för snabbkalkyl"
            result={quickResult}
            onExplain={(traceKey) => openExplanation(quickResult, traceKey)}
          />
        </section>
      </section>

      <section className="details-grid">
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
