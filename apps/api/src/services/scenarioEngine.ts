import {
  type BenchmarkComparison,
  type BenchmarkProfile,
  type BreakdownItem,
  type CalculationExplanation,
  type CalculationResult,
  type DriverInsight,
  type EvidenceReference,
  type PlanObject,
  type PlanObjectResult,
  type Project,
  type Scenario,
  type ScenarioComparison,
  type SourceReference,
  type TargetProfile
} from "../../../../packages/shared/src";

import { calculateClimateImpact } from "./calculator";

function round(value: number) {
  return Math.round(value);
}

function mergeBreakdowns(items: BreakdownItem[][]) {
  const map = new Map<string, BreakdownItem>();

  for (const list of items) {
    for (const item of list) {
      const existing = map.get(item.key);

      if (existing) {
        existing.valueKgCo2e += item.valueKgCo2e;
      } else {
        map.set(item.key, { ...item });
      }
    }
  }

  return Array.from(map.values()).map((item) => ({
    ...item,
    shareOfTotalPct: undefined
  }));
}

function dedupeSources(items: SourceReference[]) {
  const map = new Map<string, SourceReference>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function dedupeEvidence(items: EvidenceReference[]) {
  const map = new Map<string, EvidenceReference>();
  for (const item of items) {
    map.set(item.methodId, item);
  }
  return Array.from(map.values());
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

function toPlanObjectResult(planObject: PlanObject, result: CalculationResult): PlanObjectResult {
  const dominant = result.topDrivers[0]?.label ?? "Ingen dominant driver";
  return {
    planObjectId: planObject.id,
    name: planObject.name,
    objectType: planObject.objectType,
    totalKgCo2e: result.totals.value,
    perM2KgCo2e: result.perM2.value,
    dominantDriver: dominant,
    geometry: planObject.geometry
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

function buildScenarioComparisons(
  totalKgCo2e: number,
  perM2KgCo2e: number,
  perPersonKgCo2e: number,
  perHaKgCo2e: number | undefined,
  totalArea: number,
  totalPeople: number,
  benchmarkProfile?: BenchmarkProfile,
  targetProfile?: TargetProfile
) {
  if (!benchmarkProfile) {
    return {
      vsBenchmark: [] as BenchmarkComparison[],
      vsTarget: [] as BenchmarkComparison[]
    };
  }

  const actual = {
    total: totalKgCo2e,
    perM2: perM2KgCo2e,
    perPerson: totalPeople > 0 ? perPersonKgCo2e : 0,
    perHa: perHaKgCo2e
  };

  function comparison(
    metric: "total" | "perM2" | "perPerson" | "perHa",
    referenceValue: number,
    referenceLabel: string
  ): BenchmarkComparison {
    const actualValue = actual[metric] ?? 0;
    const delta = round(actualValue - referenceValue);
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
      deltaPct: referenceValue > 0 ? Math.round((delta / referenceValue) * 100) : 0,
      status: delta === 0 ? "equal" : delta < 0 ? "below" : "above",
      unit: metric === "perHa" ? "kg CO2e/ha" : "kg CO2e",
      traceKey: `benchmark.${metric}.${referenceLabel === "Normalvärde" ? "normal" : "target"}`
    };
  }

  const vsBenchmark = [
    comparison("total", benchmarkProfile.normalPerM2KgCo2e * totalArea, "Normalvärde"),
    comparison("perM2", benchmarkProfile.normalPerM2KgCo2e, "Normalvärde"),
    comparison("perPerson", benchmarkProfile.normalPerPersonKgCo2e, "Normalvärde")
  ];

  const vsTarget = [
    comparison(
      "total",
      (targetProfile?.targetPerM2KgCo2e ?? benchmarkProfile.targetPerM2KgCo2e) * totalArea,
      "Målvärde"
    ),
    comparison(
      "perM2",
      targetProfile?.targetPerM2KgCo2e ?? benchmarkProfile.targetPerM2KgCo2e,
      "Målvärde"
    ),
    comparison(
      "perPerson",
      targetProfile?.targetPerPersonKgCo2e ?? benchmarkProfile.targetPerPersonKgCo2e,
      "Målvärde"
    )
  ];

  if (perHaKgCo2e !== undefined && benchmarkProfile.normalPerHaKgCo2e !== undefined) {
    vsBenchmark.push(comparison("perHa", benchmarkProfile.normalPerHaKgCo2e, "Normalvärde"));
  }

  if (
    perHaKgCo2e !== undefined &&
    (targetProfile?.targetPerHaKgCo2e ?? benchmarkProfile.targetPerHaKgCo2e) !== undefined
  ) {
    vsTarget.push(
      comparison(
        "perHa",
        targetProfile?.targetPerHaKgCo2e ?? benchmarkProfile.targetPerHaKgCo2e ?? 0,
        "Målvärde"
      )
    );
  }

  return {
    vsBenchmark,
    vsTarget
  };
}

function deriveScenarioActions(planObjects: PlanObject[], topDrivers: DriverInsight[]) {
  const actions = [];

  if (planObjects.some((item) => item.quickInput.frameMaterial === "betong")) {
    actions.push({
      id: "scenario-frame",
      title: "Prioritera scenarier med lägre stomutsläpp",
      description:
        "Minst ett planobjekt använder betongstomme. Duplicera scenariot och testa hybrid eller trä i de objekt som driver mest utsläpp.",
      expectedImpact: "high" as const,
      lever: "planobjektens stomval",
      traceKey: "action.scenario-frame"
    });
  }

  if (planObjects.some((item) => item.quickInput.energyStandard === "normal")) {
    actions.push({
      id: "scenario-energy",
      title: "Använd scenariojämförelse för energistandard",
      description:
        "Det finns planobjekt med normal energistandard. Testa modern standard eller passivhus för att sänka driftutsläppen och målgapet.",
      expectedImpact: "medium" as const,
      lever: "energistandard",
      traceKey: "action.scenario-energy"
    });
  }

  if (topDrivers.some((driver) => driver.category === "operational")) {
    actions.push({
      id: "scenario-heating",
      title: "Testa lägre driftprofil",
      description:
        "Drift är en stor del av totalen. Undersök om lägre energibehov eller annat uppvärmningssystem ger bättre resultat i nästa scenario.",
      expectedImpact: "medium" as const,
      lever: "drift",
      traceKey: "action.scenario-heating"
    });
  }

  if (topDrivers.some((driver) => driver.category === "mobility")) {
    actions.push({
      id: "scenario-mobility",
      title: "Jämför läge och kollektivtrafiknärhet",
      description:
        "Mobiliteten driver en stor del av totalen. Testa bättre kollektivtrafikläge, lägre parkeringstal eller annan tillgänglighetsprofil i nästa scenario.",
      expectedImpact: "medium" as const,
      lever: "läge och mobilitet",
      traceKey: "action.scenario-mobility"
    });
  }

  if (planObjects.some((item) => (item.quickInput.parkingSpaces ?? 0) > 0)) {
    actions.push({
      id: "scenario-parking",
      title: "Pröva lägre parkeringstal",
      description:
        "Minst ett planobjekt innehåller parkering. Testa färre parkeringsplatser för att se påverkan på total och per hektar.",
      expectedImpact: "medium" as const,
      lever: "parkering",
      traceKey: "action.scenario-parking"
    });
  }

  return actions.slice(0, 4);
}

function aggregateEvidenceForTrace(objectResults: CalculationResult[], traceKey: string) {
  return dedupeEvidence(
    objectResults.flatMap((result) =>
      result.explanations
        .filter((entry) => entry.traceKey === traceKey)
        .flatMap((entry) => entry.evidence)
    )
  );
}

export function calculateScenarioResult(
  scenario: Scenario,
  benchmarkProfile?: BenchmarkProfile,
  targetProfile?: TargetProfile
): CalculationResult {
  if (scenario.planObjects.length === 0 && scenario.quickInput) {
    return calculateClimateImpact(scenario.quickInput, {
      benchmarkProfile,
      targetProfile
    });
  }

  if (scenario.planObjects.length === 0) {
    throw new Error("Scenariot saknar både snabbkalkyl och planobjekt");
  }

  const objectResults = scenario.planObjects.map((planObject) =>
    calculateClimateImpact(
      {
        ...planObject.quickInput,
        estimatedResidents: planObject.residents,
        estimatedWorkers: planObject.workers
      },
      {
        benchmarkProfile,
        targetProfile
      }
    )
  );

  const byPlanObject = scenario.planObjects.map((planObject, index) =>
    toPlanObjectResult(planObject, objectResults[index])
  );

  const totalArea = scenario.planObjects.reduce(
    (sum, planObject) => sum + planObject.quickInput.grossFloorAreaM2,
    0
  );
  const totalSiteArea = scenario.planObjects.reduce((sum, planObject) => {
    return sum + (planObject.quickInput.siteAreaM2 ?? (planObject.areaHa ?? 0) * 10_000);
  }, 0);
  const totalResidents = objectResults.reduce(
    (sum, result) => sum + result.population.residents,
    0
  );
  const totalWorkers = objectResults.reduce((sum, result) => sum + result.population.workers, 0);
  const totalPeople = totalResidents + totalWorkers;
  const embodiedBreakdown = mergeBreakdowns(objectResults.map((result) => result.embodied.breakdown));
  const operationalBreakdown = mergeBreakdowns(
    objectResults.map((result) => result.operational.breakdown)
  );
  const mobilityBreakdown = mergeBreakdowns(objectResults.map((result) => result.mobility.breakdown));
  const embodiedTotal = objectResults.reduce(
    (sum, result) => sum + result.embodied.totalKgCo2e,
    0
  );
  const annualOperationalTotal = objectResults.reduce(
    (sum, result) => sum + result.operational.annualKgCo2e,
    0
  );
  const lifetimeOperationalTotal = objectResults.reduce(
    (sum, result) => sum + result.operational.lifetimeKgCo2e,
    0
  );
  const annualMobilityTotal = objectResults.reduce((sum, result) => sum + result.mobility.annualKgCo2e, 0);
  const lifetimeMobilityTotal = objectResults.reduce(
    (sum, result) => sum + result.mobility.lifetimeKgCo2e,
    0
  );
  const totalKgCo2e = embodiedTotal + lifetimeOperationalTotal + lifetimeMobilityTotal;
  const perM2KgCo2e = totalArea > 0 ? totalKgCo2e / totalArea : 0;
  const perPersonKgCo2e = totalPeople > 0 ? totalKgCo2e / totalPeople : 0;
  const perHaKgCo2e = totalSiteArea > 0 ? totalKgCo2e / (totalSiteArea / 10_000) : undefined;
  const topDrivers = [
    ...embodiedBreakdown.map((item) => ({ item, comparableImpact: item.valueKgCo2e })),
    ...operationalBreakdown.map((item) => ({
      item,
      comparableImpact: item.valueKgCo2e * 50
    })),
    ...mobilityBreakdown.map((item) => ({
      item,
      comparableImpact: item.valueKgCo2e * 50
    }))
  ]
    .map(({ item, comparableImpact }) => ({
      key: item.key,
      label: item.label,
      category: getCategory(item.traceKey),
      impactKgCo2e: comparableImpact,
      sharePct: totalKgCo2e > 0 ? Math.round((comparableImpact / totalKgCo2e) * 100) : 0,
      explanation: item.note ?? "Sammanvägd effekt från flera planobjekt.",
      traceKey: item.traceKey
    }))
    .sort((left, right) => right.impactKgCo2e - left.impactKgCo2e)
    .slice(0, 5);
  const recommendedActions = deriveScenarioActions(scenario.planObjects, topDrivers);
  const comparisons = buildScenarioComparisons(
    totalKgCo2e,
    perM2KgCo2e,
    perPersonKgCo2e,
    perHaKgCo2e,
    totalArea,
    totalPeople,
    benchmarkProfile,
    targetProfile
  );

  const explanations: CalculationExplanation[] = [
    {
      id: "scenario-totals",
      traceKey: "totals",
      title: "Total för scenario",
      summary: "Scenarioets total är summan av varje planobjekts totalresultat.",
      formulaText: "summa av planobjektens totaler",
      formula: {
        expression: "sum(total_i)"
      },
      calculationSteps: scenario.planObjects.map(
        (planObject, index) => `${planObject.name}: ${objectResults[index].totals.value} kg CO2e`
      ),
      inputs: [
        {
          key: "planObjects",
          label: "Planobjekt",
          value: String(scenario.planObjects.length),
          source: "user"
        }
      ],
      defaultsApplied: [],
      evidence: dedupeEvidence(
        objectResults.flatMap((result) =>
          result.explanations
            .filter((entry) => entry.traceKey === "totals")
            .flatMap((entry) => entry.evidence)
        )
      ),
      limitations: ["Summerar planobjektens screeningresultat och ersätter inte objektspecifik projekterings-LCA."]
    },
    {
      id: "scenario-per-m2",
      traceKey: "perM2",
      title: "Scenario per m2",
      summary: "Per m2 räknas som scenarioets total dividerad med sammanlagd bruttoarea.",
      formulaText: "scenarioets total / total bruttoarea",
      formula: {
        expression: "total / totalArea"
      },
      calculationSteps: [`${totalKgCo2e} kg CO2e / ${totalArea} m2 = ${round(perM2KgCo2e)} kg CO2e/m2`],
      inputs: [
        {
          key: "totalArea",
          label: "Sammanlagd bruttoarea",
          value: `${totalArea} m2`,
          source: "derived"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(objectResults, "perM2"),
      limitations: ["Per m2 ska läsas tillsammans med täthet, funktion och personunderlag."]
    },
    {
      id: "scenario-per-person",
      traceKey: "perPerson",
      title: "Scenario per person",
      summary: "Per person räknas från scenarioets total och sammanlagt personunderlag.",
      formulaText: "scenarioets total / totalt antal personer",
      formula: {
        expression: "total / totalPeople"
      },
      calculationSteps: [
        `${totalKgCo2e} kg CO2e / ${totalPeople || 1} personer = ${round(perPersonKgCo2e)} kg CO2e/person`
      ],
      inputs: [
        {
          key: "totalPeople",
          label: "Totalt personunderlag",
          value: String(totalPeople),
          source: "derived"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(objectResults, "perPerson"),
      limitations: ["Personunderlaget kan vara en uppskattning om planobjekten saknar explicit inmatning."]
    }
  ];

  explanations.push({
    id: "scenario-mobility-total",
    traceKey: "mobility.total",
    title: "Scenarioets mobilitet",
    summary: "Mobiliteten summerar användarresor och platsberoende mobilitetsprofil över alla planobjekt.",
    formulaText: "summa av planobjektens mobilitet",
    formula: {
      expression: "sum(mobility_i)"
    },
    calculationSteps: scenario.planObjects.map(
      (planObject, index) => `${planObject.name}: ${objectResults[index].mobility.lifetimeKgCo2e} kg CO2e`
    ),
    inputs: [
      {
        key: "planObjects",
        label: "Planobjekt",
        value: String(scenario.planObjects.length),
        source: "derived"
      }
    ],
    defaultsApplied: [],
    evidence: aggregateEvidenceForTrace(objectResults, "mobility.total"),
    limitations: ["Scenarioets mobilitetsprofil är en screening och bygger på varje planobjekts plats- eller override-data."]
  });

  if (perHaKgCo2e !== undefined) {
    explanations.push({
      id: "scenario-per-ha",
      traceKey: "perHa",
      title: "Scenario per hektar",
      summary: "Per hektar räknas från scenarioets total och sammanlagd platsyta.",
      formulaText: "scenarioets total / platsyta i hektar",
      formula: {
        expression: "total / siteAreaHa"
      },
      calculationSteps: [
        `${totalKgCo2e} kg CO2e / ${(totalSiteArea / 10_000).toFixed(2)} ha = ${round(perHaKgCo2e)} kg CO2e/ha`
      ],
      inputs: [
        {
          key: "totalSiteArea",
          label: "Sammanlagd platsyta",
          value: `${round(totalSiteArea)} m2`,
          source: "derived"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(objectResults, "perHa"),
      limitations: ["Per hektar visas bara när platsyta finns för minst ett planobjekt."]
    });
  }

  for (const item of [...embodiedBreakdown, ...operationalBreakdown]) {
    if (!item.traceKey) {
      continue;
    }

    explanations.push({
      id: `scenario-${item.traceKey}`,
      traceKey: item.traceKey,
      title: item.label,
      summary: "Posten summerar samma delpost över alla planobjekt i scenariot.",
      formulaText: "summa av motsvarande delpost i varje planobjekt",
      formula: {
        expression: `sum(${item.traceKey}_i)`
      },
      calculationSteps: scenario.planObjects.map((planObject, index) => {
        const match = [...objectResults[index].embodied.breakdown, ...objectResults[index].operational.breakdown]
          .find((entry) => entry.traceKey === item.traceKey);
        return `${planObject.name}: ${match?.valueKgCo2e ?? 0} kg CO2e`;
      }),
      inputs: [
        {
          key: "planObjects",
          label: "Planobjekt",
          value: String(scenario.planObjects.length),
          source: "derived"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(objectResults, item.traceKey),
      limitations: ["Scenarioförklaringen beskriver den sammanlagda posten, inte ett enskilt delobjekt."]
    });
  }

  for (const item of mobilityBreakdown) {
    if (!item.traceKey) {
      continue;
    }

    explanations.push({
      id: `scenario-${item.traceKey}`,
      traceKey: item.traceKey,
      title: item.label,
      summary: "Posten summerar samma delpost över alla planobjekt i scenariot.",
      formulaText: "summa av motsvarande delpost i varje planobjekt",
      formula: {
        expression: `sum(${item.traceKey}_i)`
      },
      calculationSteps: scenario.planObjects.map((planObject, index) => {
        const match = objectResults[index].mobility.breakdown
          .find((entry) => entry.traceKey === item.traceKey);
        return `${planObject.name}: ${match?.valueKgCo2e ?? 0} kg CO2e`;
      }),
      inputs: [
        {
          key: "planObjects",
          label: "Planobjekt",
          value: String(scenario.planObjects.length),
          source: "derived"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(objectResults, item.traceKey),
      limitations: ["Scenarioförklaringen beskriver den sammanlagda posten, inte ett enskilt delobjekt."]
    });
  }

  for (const comparison of [...comparisons.vsBenchmark, ...comparisons.vsTarget]) {
    explanations.push({
      id: `scenario-${comparison.traceKey}`,
      traceKey: comparison.traceKey ?? `benchmark.${comparison.metric}`,
      title: `${comparison.referenceLabel} för ${comparison.label.toLowerCase()}`,
      summary: "Jämförelsen visar skillnaden mellan scenarioresultat och organisationsprofilens referensvärde.",
      formulaText: "utfall - referens",
      formula: {
        expression: "actual - reference"
      },
      calculationSteps: [
        `${comparison.actualValue} - ${comparison.referenceValue} = ${comparison.delta} ${comparison.unit}`
      ],
      inputs: [
        {
          key: "actual",
          label: "Utfall",
          value: `${comparison.actualValue} ${comparison.unit}`,
          source: "derived"
        },
        {
          key: "reference",
          label: "Referens",
          value: `${comparison.referenceValue} ${comparison.unit}`,
          source: "reference"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(objectResults, "perM2"),
      limitations: ["Benchmarken är ett beslutsstöd och ska inte läsas som ett juridiskt gränsvärde."]
    });
  }

  for (const action of recommendedActions) {
    explanations.push({
      id: `scenario-${action.traceKey}`,
      traceKey: action.traceKey ?? `action.${action.id}`,
      title: action.title,
      summary: "Åtgärden föreslås utifrån scenarioets största drivare och valda parametrar.",
      formulaText: "regelbaserat åtgärdsstöd",
      formula: {
        expression: "derived from top drivers and parameter mix"
      },
      calculationSteps: [action.description],
      inputs: [
        {
          key: "lever",
          label: "Påverkbar parameter",
          value: action.lever,
          source: "derived"
        }
      ],
      defaultsApplied: [],
      evidence: aggregateEvidenceForTrace(
        objectResults,
        action.id.includes("parking")
          ? "site.parking"
          : action.id.includes("mobility")
            ? "mobility.total"
          : action.id.includes("heating")
            ? "operational.heating"
            : action.id.includes("energy")
              ? "perM2"
              : "embodied.frame"
      ),
      limitations: ["Åtgärden är en prioriteringssignal för scenariolaboration, inte en full projekteringsrekommendation."]
    });
  }

  const explanationIndex = buildExplanationIndex(explanations);
  const sources = dedupeSources(objectResults.flatMap((result) => result.sources));

  return {
    embodied: {
      totalKgCo2e: Math.round(embodiedTotal),
      breakdown: embodiedBreakdown.map((item) => ({
        ...item,
        shareOfTotalPct: embodiedTotal > 0 ? Math.round((item.valueKgCo2e / embodiedTotal) * 100) : 0
      }))
    },
    operational: {
      annualKgCo2e: Math.round(annualOperationalTotal),
      lifetimeKgCo2e: Math.round(lifetimeOperationalTotal),
      breakdown: operationalBreakdown.map((item) => ({
        ...item,
        shareOfTotalPct:
          annualOperationalTotal > 0 ? Math.round((item.valueKgCo2e / annualOperationalTotal) * 100) : 0
      }))
    },
    mobility: {
      annualKgCo2e: Math.round(annualMobilityTotal),
      lifetimeKgCo2e: Math.round(lifetimeMobilityTotal),
      breakdown: mobilityBreakdown.map((item) => ({
        ...item,
        shareOfTotalPct:
          annualMobilityTotal > 0 ? Math.round((item.valueKgCo2e / annualMobilityTotal) * 100) : 0
      })),
      inputs: {
        accessibilityBand: "medium",
        urbanContext: "urban",
        source: "default"
      }
    },
    totals: {
      label: "Totalt klimatutsläpp",
      value: Math.round(totalKgCo2e),
      unit: "kg CO2e",
      traceKey: "totals"
    },
    perM2: {
      label: "Klimatutsläpp per m2",
      value: Math.round(perM2KgCo2e),
      unit: "kg CO2e/m2",
      traceKey: "perM2"
    },
    perPerson: {
      label: "Klimatutsläpp per person",
      value: Math.round(perPersonKgCo2e),
      unit: "kg CO2e/person",
      traceKey: "perPerson"
    },
    perHa:
      perHaKgCo2e !== undefined
        ? {
            label: "Klimatutsläpp per hektar",
            value: Math.round(perHaKgCo2e),
            unit: "kg CO2e/ha",
            traceKey: "perHa"
          }
        : undefined,
    population: {
      residents: totalResidents,
      workers: totalWorkers,
      totalPeople,
      source: "estimated"
    },
    assumptions: [
      {
        label: "Scenariotyp",
        value: scenario.mode === "plan" ? "Planobjekt och scenariojämförelse" : "Snabbkalkyl"
      },
      {
        label: "Antal planobjekt",
        value: String(scenario.planObjects.length)
      }
    ],
    sources,
    uncertaintyRangePct: objectResults[0]?.uncertaintyRangePct ?? 20,
    vsBenchmark: comparisons.vsBenchmark,
    vsTarget: comparisons.vsTarget,
    topDrivers,
    recommendedActions,
    explanations,
    explanationIndex,
    baselineExisting: undefined,
    baselineComparison: undefined,
    byPlanObject
  };
}

export function compareScenarios(
  project: Project,
  baseScenarioId: string,
  candidateScenarioId: string
): ScenarioComparison {
  const baseScenario = project.scenarios.find((scenario) => scenario.id === baseScenarioId);
  const candidateScenario = project.scenarios.find(
    (scenario) => scenario.id === candidateScenarioId
  );

  if (!baseScenario?.latestResult || !candidateScenario?.latestResult) {
    throw new Error("Båda scenarier måste vara beräknade innan de kan jämföras");
  }

  const metricInputs: Array<{
    metric: ScenarioComparison["metrics"][number]["metric"];
    baseValue: number;
    candidateValue: number;
    unit: string;
  }> = [
    {
      metric: "total" as const,
      baseValue: baseScenario.latestResult.totals.value,
      candidateValue: candidateScenario.latestResult.totals.value,
      unit: baseScenario.latestResult.totals.unit
    },
    {
      metric: "perM2" as const,
      baseValue: baseScenario.latestResult.perM2.value,
      candidateValue: candidateScenario.latestResult.perM2.value,
      unit: baseScenario.latestResult.perM2.unit
    },
    {
      metric: "perPerson" as const,
      baseValue: baseScenario.latestResult.perPerson.value,
      candidateValue: candidateScenario.latestResult.perPerson.value,
      unit: baseScenario.latestResult.perPerson.unit
    }
  ];

  if (baseScenario.latestResult.perHa && candidateScenario.latestResult.perHa) {
    metricInputs.push({
      metric: "perHa" as const,
      baseValue: baseScenario.latestResult.perHa.value,
      candidateValue: candidateScenario.latestResult.perHa.value,
      unit: baseScenario.latestResult.perHa.unit
    });
  }

  return {
    projectId: project.id,
    baseScenarioId,
    candidateScenarioId,
    metrics: metricInputs.map((metric) => {
      const delta = round(metric.candidateValue - metric.baseValue);
      return {
        ...metric,
        delta,
        deltaPct:
          metric.baseValue > 0 ? Math.round((delta / metric.baseValue) * 100) : 0
      };
    }),
    changedDrivers: candidateScenario.latestResult.topDrivers.filter((driver) => {
      const baseDriver = baseScenario.latestResult?.topDrivers.find(
        (entry) => entry.key === driver.key
      );
      return Math.abs((baseDriver?.impactKgCo2e ?? 0) - driver.impactKgCo2e) > 1000;
    })
  };
}
