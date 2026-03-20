import {
  LABELS,
  formatNumber,
  labelUrbanContext,
  type CalculateRequest,
  type CalculationResult,
  type ComparisonMetric,
  type Scenario,
  type ScenarioRun
} from "../../../../packages/shared/src";

export type DecisionObjective = "lowestClimate" | "balance" | "mobility" | "robustness" | "futureProof";

export interface BuildingTypePreset {
  buildingForm: NonNullable<CalculateRequest["buildingForm"]>;
  urbanContext: NonNullable<CalculateRequest["urbanContext"]>;
  floorsAboveGround: number;
  parkingStructureType: NonNullable<CalculateRequest["parkingStructureType"]>;
  parkingGarageFloors: number;
  note: string;
}

export interface DecisionSignal {
  category: "location" | "form" | "typology" | "construction" | "robustness";
  title: string;
  score: number;
  note: string;
  details: string[];
}

export interface ScenarioDecisionSummary {
  scenarioId: string;
  scenarioName: string;
  runId?: string;
  run?: ScenarioRun;
  objective: DecisionObjective;
  objectiveLabel: string;
  objectiveScore: number;
  climateScore: number;
  locationScore: number;
  formScore: number;
  constructionScore: number;
  robustnessScore: number;
  futureProofScore: number;
  climateMetric: ComparisonMetric;
  climateValue: number;
  climateUnit: string;
  benchmarkGap?: string;
  uncertaintyLevel: "low" | "medium" | "high";
  uncertaintyLabel: string;
  signals: DecisionSignal[];
  labels: {
    buildingType: string;
    buildingForm: string;
    urbanContext: string;
    frameMaterial: string;
    foundationType: string;
    parkingStructureType: string;
  };
  typology: {
    label: string;
    note: string;
    defaults: string[];
  };
  recommendation: string;
  rationale: string[];
}

export const DECISION_OBJECTIVE_LABELS: Record<DecisionObjective, string> = {
  lowestClimate: "Lägsta klimat",
  balance: "Bästa balans",
  mobility: "Bästa mobilitet",
  robustness: "Mest robust",
  futureProof: "Mest framtidssäkert"
};

export const BUILDING_TYPE_PRESETS: Record<NonNullable<CalculateRequest["buildingType"]>, BuildingTypePreset> = {
  smahus: {
    buildingForm: "kompakt",
    urbanContext: "suburban",
    floorsAboveGround: 2,
    parkingStructureType: "none",
    parkingGarageFloors: 0,
    note: "Småhus gynnas ofta av låg komplexitet men är normalt mer bilkänsliga per person."
  },
  flerbostadshus: {
    buildingForm: "normal",
    urbanContext: "urban",
    floorsAboveGround: 5,
    parkingStructureType: "garage_ovan_mark",
    parkingGarageFloors: 1,
    note: "Flerbostadshus får ofta bäst klimatnytta när de kombineras med tät struktur och bra läge."
  },
  kontor: {
    buildingForm: "kompakt",
    urbanContext: "central_storstad",
    floorsAboveGround: 6,
    parkingStructureType: "garage_under_mark",
    parkingGarageFloors: 1,
    note: "Kontor är känsliga för läge, energiprestanda och ombyggbarhet över tid."
  },
  skola: {
    buildingForm: "normal",
    urbanContext: "urban",
    floorsAboveGround: 3,
    parkingStructureType: "none",
    parkingGarageFloors: 0,
    note: "Skolor drivs ofta av dagtidsanvändning, drift och god serviceaccess."
  },
  handel: {
    buildingForm: "fragmenterad",
    urbanContext: "suburban",
    floorsAboveGround: 1,
    parkingStructureType: "garage_ovan_mark",
    parkingGarageFloors: 1,
    note: "Handel är ofta starkt läges- och parkeringskänslig med stora flöden."
  }
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getUncertaintyLevelLabel(rangePct: number) {
  if (rangePct <= 14) {
    return { level: "low" as const, label: "Säker" };
  }

  if (rangePct <= 24) {
    return { level: "medium" as const, label: "Medel" };
  }

  return { level: "high" as const, label: "Hög" };
}

function uniqueLabels(values: Array<string | undefined>, formatter: (value: string) => string) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)).map(formatter)));
}

function getLatestScenarioRun(scenario: Scenario): ScenarioRun | null {
  const runs = scenario.runs ?? [];
  if (runs.length > 0) {
    return runs[runs.length - 1] ?? null;
  }

  if (!scenario.latestResult) {
    return null;
  }

  return {
    id: `${scenario.id}-latest`,
    scenarioId: scenario.id,
    createdAt: scenario.lastCalculatedAt ?? scenario.updatedAt ?? scenario.createdAt,
    result: scenario.latestResult,
    inputSnapshot: scenario.quickInput
  };
}

function getScenarioInputSnapshot(scenario: Scenario): CalculateRequest | undefined {
  const run = getLatestScenarioRun(scenario);
  return run?.inputSnapshot ?? scenario.quickInput ?? scenario.planObjects[0]?.quickInput;
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

  return result.perHa?.value ?? result.perM2.value;
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

  return result.perHa?.unit ?? result.perM2.unit;
}

function getObjectiveWeights(objective: DecisionObjective) {
  if (objective === "lowestClimate") {
    return {
      climate: 0.55,
      location: 0.05,
      form: 0.15,
      construction: 0.2,
      robustness: 0.05
    };
  }

  if (objective === "mobility") {
    return {
      climate: 0.2,
      location: 0.45,
      form: 0.1,
      construction: 0.1,
      robustness: 0.15
    };
  }

  if (objective === "robustness") {
    return {
      climate: 0.1,
      location: 0.1,
      form: 0.1,
      construction: 0.2,
      robustness: 0.5
    };
  }

  if (objective === "futureProof") {
    return {
      climate: 0.15,
      location: 0.2,
      form: 0.2,
      construction: 0.25,
      robustness: 0.2
    };
  }

  return {
    climate: 0.25,
    location: 0.2,
    form: 0.2,
    construction: 0.2,
    robustness: 0.15
  };
}

function scoreLocation(input: CalculateRequest | undefined, result: CalculationResult) {
  const context = input?.urbanContext ?? result.mobility.inputs.urbanContext;
  const accessibility = result.mobility.inputs.accessibilityBand;
  const parkingSpaces = input?.parkingSpaces ?? 0;
  const people = Math.max(result.population.totalPeople, 1);
  const parkingIntensity = parkingSpaces / people;

  const base =
    context === "stockholm_innerstad"
      ? 94
      : context === "central_storstad"
        ? 80
        : context === "urban"
          ? 68
          : 50;
  const accessBonus = accessibility === "high" ? 12 : accessibility === "medium" ? 4 : -10;
  const parkingPenalty = Math.min(16, parkingIntensity * 22);
  const garagePenalty = (input?.parkingStructureType ?? "none") === "garage_under_mark" ? 4 : (input?.parkingStructureType ?? "none") === "garage_ovan_mark" ? 2 : 0;
  const missingTransitPenalty = input?.siteLocation || input?.transitOverrides ? 0 : 4;
  return clampScore(base + accessBonus - parkingPenalty - garagePenalty - missingTransitPenalty);
}

function scoreForm(input: CalculateRequest | undefined, result: CalculationResult) {
  const buildingForm = input?.buildingForm ?? "normal";
  const floorsAboveGround = input?.floorsAboveGround;
  const buildingFootprintM2 = input?.buildingFootprintM2;
  const grossFloorAreaM2 = input?.grossFloorAreaM2 ?? result.totals.value / Math.max(result.perM2.value, 1);

  const base =
    buildingForm === "kompakt"
      ? 84
      : buildingForm === "normal"
        ? 70
        : 52;

  const geometryBonus =
    floorsAboveGround && buildingFootprintM2
      ? clampScore(
          50 +
            Math.max(
              0,
              45 -
                Math.abs(
                  grossFloorAreaM2 / Math.max(buildingFootprintM2 * floorsAboveGround, 1) - 1
                ) *
                  90
            )
        )
      : 50;

  return clampScore(base * 0.7 + geometryBonus * 0.3);
}

function scoreConstruction(input: CalculateRequest | undefined) {
  const frameMaterial = input?.frameMaterial ?? "betong";
  const foundationType = input?.foundationType ?? "platta_pa_mark";
  const parkingStructureType = input?.parkingStructureType ?? "none";
  const groundCondition = input?.groundCondition ?? "normal_mark";

  const frameScore =
    frameMaterial === "tra"
      ? 92
      : frameMaterial === "hybrid"
        ? 76
        : frameMaterial === "stal"
          ? 62
          : 56;
  const foundationScore =
    foundationType === "platta_pa_mark"
      ? 88
      : foundationType === "kantbalk"
        ? 82
        : foundationType === "kallare"
          ? 64
          : 46;
  const parkingScore =
    parkingStructureType === "none"
      ? 90
      : parkingStructureType === "garage_ovan_mark"
        ? 58
        : 36;
  const groundScore =
    groundCondition === "berg_fastmark"
      ? 92
      : groundCondition === "sand_grus"
        ? 82
        : groundCondition === "normal_mark"
          ? 74
          : groundCondition === "fyllning_osaker"
            ? 52
            : groundCondition === "lera_mjuk"
              ? 46
              : 42;

  return clampScore(frameScore * 0.42 + foundationScore * 0.26 + parkingScore * 0.2 + groundScore * 0.12);
}

function scoreRobustness(result: CalculationResult) {
  const proxyEvidenceCount = result.explanations.flatMap((entry) => entry.evidence).filter((entry) => entry.evidenceType === "internal-assumption").length;
  const defaultedInputs = Array.from(
    new Set(
      result.explanations.flatMap((entry) =>
        entry.inputs.filter((input) => input.source !== "user").map((input) => input.key)
      )
    )
  ).length;
  const uncertaintyPenalty = result.uncertaintyRangePct * 1.7;
  const proxyPenalty = Math.min(18, proxyEvidenceCount * 2.5);
  const defaultPenalty = Math.min(18, defaultedInputs * 0.8);

  return clampScore(100 - uncertaintyPenalty - proxyPenalty - defaultPenalty);
}

function scoreFutureProof(
  input: CalculateRequest | undefined,
  result: CalculationResult,
  locationScore: number,
  constructionScore: number,
  formScore: number,
  robustnessScore: number
) {
  const interventionBonus =
    input?.interventionType === "ombyggnad"
      ? 12
      : input?.interventionType === "pabyggnad"
        ? 8
        : 0;
  const structureBonus =
    input?.retainedStructureSharePct !== undefined
      ? Math.min(15, input.retainedStructureSharePct / 6)
      : 0;
  const parkingBonus =
    (input?.parkingStructureType ?? "none") === "none"
      ? 8
      : input?.parkingStructureType === "garage_ovan_mark"
        ? -2
        : -8;
  const frameBonus =
    input?.frameMaterial === "tra"
      ? 8
      : input?.frameMaterial === "hybrid"
        ? 4
        : 0;
  const climateProxy = Math.max(0, Math.min(100, 100 - Math.min(100, result.perM2.value / 10)));
  const base =
    locationScore * 0.22 +
    constructionScore * 0.28 +
    formScore * 0.16 +
    robustnessScore * 0.18 +
    climateProxy * 0.16;

  return clampScore(base + interventionBonus + structureBonus + parkingBonus + frameBonus);
}

function getBenchmarkGap(result: CalculationResult, metric: ComparisonMetric) {
  const comparison =
    result.vsBenchmark.find((entry) => entry.metric === metric) ??
    result.vsTarget.find((entry) => entry.metric === metric);

  if (!comparison) {
    return undefined;
  }

  const direction = comparison.delta > 0 ? "+" : "";
  return `${comparison.referenceLabel} ${direction}${formatNumber(comparison.delta)} ${comparison.unit}`;
}

function getTypologySummary(scenario: Scenario, input: CalculateRequest | undefined) {
  const buildingTypes = uniqueLabels(
    [
      input?.buildingType,
      ...scenario.planObjects.map((planObject) => planObject.quickInput.buildingType)
    ],
    (value) => LABELS.buildingType[value as keyof typeof LABELS.buildingType] ?? value
  );

  const presetType = input?.buildingType ?? scenario.planObjects[0]?.quickInput.buildingType ?? "flerbostadshus";
  const preset = BUILDING_TYPE_PRESETS[presetType];

  return {
    label: buildingTypes.length === 1 ? buildingTypes[0] : "Flera byggnadstyper",
    note: preset.note,
    defaults: [
      `Form: ${LABELS.buildingForm[preset.buildingForm]}`,
      `Våningar: ${preset.floorsAboveGround}`,
      `Läge: ${LABELS.urbanContext[preset.urbanContext]}`,
      `Parkering: ${LABELS.parkingStructureType[preset.parkingStructureType]}`
    ]
  };
}

function getDimensionLabel(
  values: Array<string | undefined>,
  labels: Record<string, string>,
  fallback: string
) {
  const unique = Array.from(new Set(values.filter((value): value is string => Boolean(value))));
  if (unique.length === 0) {
    return fallback;
  }

  if (unique.length === 1) {
    return labels[unique[0]] ?? unique[0];
  }

  return `Flera (${unique.length})`;
}

function getScenarioLabels(scenario: Scenario, input: CalculateRequest | undefined) {
  const buildingForms = uniqueLabels(
    [input?.buildingForm, ...scenario.planObjects.map((planObject) => planObject.quickInput.buildingForm)],
    (value) => LABELS.buildingForm[value as keyof typeof LABELS.buildingForm] ?? value
  );
  const urbanContexts = uniqueLabels(
    [input?.urbanContext, ...scenario.planObjects.map((planObject) => planObject.quickInput.urbanContext)],
    (value) => LABELS.urbanContext[value as keyof typeof LABELS.urbanContext] ?? value
  );
  const frameMaterials = uniqueLabels(
    [input?.frameMaterial, ...scenario.planObjects.map((planObject) => planObject.quickInput.frameMaterial)],
    (value) => LABELS.frameMaterial[value as keyof typeof LABELS.frameMaterial] ?? value
  );
  const foundationTypes = uniqueLabels(
    [input?.foundationType, ...scenario.planObjects.map((planObject) => planObject.quickInput.foundationType)],
    (value) => LABELS.foundationType[value as keyof typeof LABELS.foundationType] ?? value
  );
  const parkingTypes = uniqueLabels(
    [input?.parkingStructureType, ...scenario.planObjects.map((planObject) => planObject.quickInput.parkingStructureType)],
    (value) => LABELS.parkingStructureType[value as keyof typeof LABELS.parkingStructureType] ?? value
  );

  return {
    buildingType: getDimensionLabel(
      [input?.buildingType, ...scenario.planObjects.map((planObject) => planObject.quickInput.buildingType)],
      LABELS.buildingType,
      "Ej angiven byggnadstyp"
    ),
    buildingForm:
      buildingForms.length === 0 ? "Ej angiven" : buildingForms.length === 1 ? buildingForms[0] : "Flera byggnadsformer",
    urbanContext:
      urbanContexts.length === 0 ? "Ej angiven" : urbanContexts.length === 1 ? urbanContexts[0] : "Flera lägen",
    frameMaterial:
      frameMaterials.length === 0 ? "Ej angivet" : frameMaterials.length === 1 ? frameMaterials[0] : "Flera stommaterial",
    foundationType:
      foundationTypes.length === 0 ? "Ej angiven" : foundationTypes.length === 1 ? foundationTypes[0] : "Flera grundtyper",
    parkingStructureType:
      parkingTypes.length === 0 ? "Ej angiven" : parkingTypes.length === 1 ? parkingTypes[0] : "Flera parkeringslösningar"
  };
}

function getObjectiveRecommendationPhrase(objective: DecisionObjective) {
  if (objective === "lowestClimate") {
    return "lägsta klimat";
  }

  if (objective === "mobility") {
    return "bästa mobilitet";
  }

  if (objective === "robustness") {
    return "mest robusta lösning";
  }

  if (objective === "futureProof") {
    return "mest framtidssäkra lösning";
  }

  return "bästa balans";
}

export function applyBuildingTypePreset(form: CalculateRequest, buildingType: CalculateRequest["buildingType"]) {
  const preset = BUILDING_TYPE_PRESETS[buildingType];
  const next = { ...form, buildingType };

  if (next.buildingForm === undefined || next.buildingForm === "normal") {
    next.buildingForm = preset.buildingForm;
  }

  if (next.urbanContext === undefined || next.urbanContext === "urban") {
    next.urbanContext = preset.urbanContext;
  }

  if (next.floorsAboveGround === undefined || next.floorsAboveGround === 0) {
    next.floorsAboveGround = preset.floorsAboveGround;
  }

  if (next.parkingStructureType === undefined || next.parkingStructureType === "none") {
    next.parkingStructureType = preset.parkingStructureType;
  }

  if (next.parkingStructureType === "none") {
    next.parkingGarageFloors = undefined;
  } else if (next.parkingGarageFloors === undefined || next.parkingGarageFloors <= 0) {
    next.parkingGarageFloors = preset.parkingGarageFloors;
  }

  return next;
}

export function buildDecisionSummaries(
  scenarios: Scenario[],
  selectedMetric: ComparisonMetric,
  objective: DecisionObjective
) {
  type DecisionCandidate = {
    scenario: Scenario;
    run: ScenarioRun | null;
    input: CalculateRequest | undefined;
  };

  const eligible = scenarios
    .map((scenario) => ({
      scenario,
      run: getLatestScenarioRun(scenario),
      input: getScenarioInputSnapshot(scenario)
    })) satisfies DecisionCandidate[];
  const activeEligible = eligible.filter((entry): entry is { scenario: Scenario; run: ScenarioRun; input: CalculateRequest | undefined } => Boolean(entry.run));

  const metricValues = activeEligible.map((entry) => getScenarioMetricValue(entry.run.result, selectedMetric));
  const minMetric = Math.min(...metricValues, 0);
  const maxMetric = Math.max(...metricValues, 1);
  const range = Math.max(maxMetric - minMetric, 1);
  const weights = getObjectiveWeights(objective);

  const summaries = activeEligible.map((entry) => {
    const result = entry.run.result;
    const climateValue = getScenarioMetricValue(result, selectedMetric);
    const climateScore = maxMetric === minMetric ? 100 : clampScore(((maxMetric - climateValue) / range) * 100);
    const locationScore = scoreLocation(entry.input, result);
    const formScore = scoreForm(entry.input, result);
    const constructionScore = scoreConstruction(entry.input);
    const robustnessScore = scoreRobustness(result);
    const futureProofScore = scoreFutureProof(
      entry.input,
      result,
      locationScore,
      constructionScore,
      formScore,
      robustnessScore
    );

    const objectiveScore = clampScore(
      objective === "futureProof"
        ? futureProofScore
        : climateScore * weights.climate +
            locationScore * weights.location +
            formScore * weights.form +
            constructionScore * weights.construction +
            robustnessScore * weights.robustness
    );

    const bestDimension = [
      { key: "climate", label: "Klimat", score: climateScore },
      { key: "location", label: "Läge", score: locationScore },
      { key: "form", label: "Form", score: formScore },
      { key: "construction", label: "Konstruktion", score: constructionScore },
      { key: "robustness", label: "Robusthet", score: robustnessScore }
    ].sort((left, right) => right.score - left.score)[0];
    const weakestDimension = [
      { key: "climate", label: "Klimat", score: climateScore },
      { key: "location", label: "Läge", score: locationScore },
      { key: "form", label: "Form", score: formScore },
      { key: "construction", label: "Konstruktion", score: constructionScore },
      { key: "robustness", label: "Robusthet", score: robustnessScore }
    ].sort((left, right) => left.score - right.score)[0];

    const labels = getScenarioLabels(entry.scenario, entry.input);
    const typology = getTypologySummary(entry.scenario, entry.input);
    const benchmarkGap = getBenchmarkGap(result, selectedMetric);
    const uncertainty = getUncertaintyLevelLabel(result.uncertaintyRangePct);
    const recommendation =
      objective === "lowestClimate"
        ? "Välj det alternativ som ger lägst klimat per vald måttbild."
        : objective === "mobility"
          ? "Välj det alternativ som ger starkast läges- och mobilitetsprofil."
          : objective === "robustness"
            ? "Välj det alternativ som står starkast mot proxyer och osäkerhet."
            : objective === "futureProof"
              ? "Välj det alternativ som bäst kombinerar omställning, läge och återbruk."
              : "Välj det alternativ som balanserar klimat, läge, form och konstruktion bäst.";

    return {
      scenarioId: entry.scenario.id,
      scenarioName: entry.scenario.name,
      runId: entry.run.id,
      run: entry.run,
      objective,
      objectiveLabel: DECISION_OBJECTIVE_LABELS[objective],
      objectiveScore,
      climateScore,
      locationScore,
      formScore,
      constructionScore,
      robustnessScore,
      futureProofScore,
      climateMetric: selectedMetric,
      climateValue,
      climateUnit: getScenarioMetricUnit(result, selectedMetric),
      benchmarkGap,
      uncertaintyLevel: uncertainty.level,
      uncertaintyLabel: uncertainty.label,
      signals: [
        {
          category: "location",
          title: "Läge",
          score: locationScore,
          note: `${labels.urbanContext} • tillgänglighet ${LABELS.urbanContext[entry.run.result.mobility.inputs.urbanContext]}`,
          details: [
            `Mobilitet: ${formatNumber(entry.run.result.mobility.annualKgCo2e)} kg CO2e/år`,
            `Parkeringsnivå: ${entry.input?.parkingSpaces ?? 0} platser`
          ]
        },
        {
          category: "form",
          title: "Form",
          score: formScore,
          note: `${labels.buildingForm} • kompaktare former får lägre skalsyta`,
          details: [
            `Våningar: ${entry.input?.floorsAboveGround ?? "default"}`,
            `Fotavtryck: ${entry.input?.buildingFootprintM2 ? `${formatNumber(entry.input.buildingFootprintM2)} m2` : "Härledd"}`
          ]
        },
        {
          category: "construction",
          title: "Konstruktion",
          score: constructionScore,
          note: `${labels.frameMaterial} / ${labels.foundationType} / ${labels.parkingStructureType}`,
          details: [
            `Stomme: ${labels.frameMaterial}`,
            `Grund: ${labels.foundationType}`,
            `Parkering: ${labels.parkingStructureType}`
          ]
        },
        {
          category: "robustness",
          title: "Robusthet",
          score: robustnessScore,
          note: `Osäkerhet ${uncertainty.label} • ±${formatNumber(entry.run.result.uncertaintyRangePct)} %`,
          details: [
            `${entry.run.result.explanations.flatMap((explanation) => explanation.defaultsApplied).length} defaultantaganden`,
            `${entry.run.result.explanations.flatMap((explanation) => explanation.evidence).filter((evidence) => evidence.evidenceType === "internal-assumption").length} proxykällor`
          ]
        }
      ],
      labels,
      typology,
      recommendation,
      rationale: [
        `${bestDimension.label} är starkast i detta alternativ.`,
        `${weakestDimension.label} är den tydligaste svagheten.`,
        benchmarkGap ? `Benchmarkgap: ${benchmarkGap}` : "Ingen benchmark jämförelse tillgänglig."
      ]
    } satisfies ScenarioDecisionSummary;
  });

  const sorted = summaries.sort((left, right) => {
    if (right.objectiveScore !== left.objectiveScore) {
      return right.objectiveScore - left.objectiveScore;
    }

    return getScenarioMetricValue(left.run.result, selectedMetric) - getScenarioMetricValue(right.run.result, selectedMetric);
  });

  return sorted.map((summary, index) => ({
    ...summary,
    recommendation:
      index === 0
        ? `Bäst för ${getObjectiveRecommendationPhrase(objective)}`
        : summary.recommendation,
    rationale: [
      `Rang ${index + 1} av ${sorted.length}`,
      ...summary.rationale
    ]
  })) as ScenarioDecisionSummary[];
}

export function getDecisionObjectiveLabel(objective: DecisionObjective) {
  return DECISION_OBJECTIVE_LABELS[objective];
}

export function getScenarioDecisionSummary(
  scenario: Scenario,
  selectedMetric: ComparisonMetric,
  objective: DecisionObjective,
  ranking: ScenarioDecisionSummary[]
) {
  return ranking.find((entry) => entry.scenarioId === scenario.id && entry.climateMetric === selectedMetric && entry.objective === objective);
}
