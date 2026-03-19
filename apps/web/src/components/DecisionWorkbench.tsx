import { useMemo, useState } from "react";

import { formatNumber, type ComparisonMetric, type Project, type Scenario } from "../../../../packages/shared/src";
import {
  buildDecisionSummaries,
  DECISION_OBJECTIVE_LABELS,
  type DecisionObjective
} from "../lib/decisionSupport";

interface DecisionWorkbenchProps {
  project: Project | null;
  selectedMetric: ComparisonMetric;
  activeScenarioId?: string;
  onSelectScenario: (scenarioId: string) => void;
  onDuplicateScenario: (scenarioId: string) => Promise<void> | void;
  onOpenAnalysis?: (scenarioId: string, runId?: string) => void;
}

function objectiveDescription(objective: DecisionObjective) {
  if (objective === "lowestClimate") {
    return "Rangordnar efter lägst klimat i vald måttbild och visar var alternativen vinner eller tappar.";
  }

  if (objective === "mobility") {
    return "Rangordnar efter läges- och mobilitetsstyrka, med klimat och robusthet som stödjande kriterier.";
  }

  if (objective === "robustness") {
    return "Rangordnar efter lägst osäkerhet och minst proxyberoende i modellen.";
  }

  if (objective === "futureProof") {
    return "Rangordnar efter omställningsförmåga, återbruk och en mer framtidssäker systembild.";
  }

  return "Rangordnar efter en transparent mix av klimat, läge, form, konstruktion och robusthet.";
}

function scoreLabel(value: number) {
  if (value >= 85) {
    return "Starkt";
  }

  if (value >= 70) {
    return "Bra";
  }

  if (value >= 50) {
    return "Mellan";
  }

  return "Svagt";
}

function scenarioRows(scenarios: Scenario[]) {
  return scenarios
    .map((scenario) => scenario.latestResult ? scenario : null)
    .filter((scenario): scenario is Scenario => Boolean(scenario));
}

export function DecisionWorkbench({
  project,
  selectedMetric,
  activeScenarioId,
  onSelectScenario,
  onDuplicateScenario,
  onOpenAnalysis
}: DecisionWorkbenchProps) {
  const [objective, setObjective] = useState<DecisionObjective>("balance");

  const eligibleScenarios = useMemo(() => scenarioRows(project?.scenarios ?? []), [project?.scenarios]);
  const summaries = useMemo(
    () => buildDecisionSummaries(eligibleScenarios, selectedMetric, objective),
    [eligibleScenarios, selectedMetric, objective]
  );

  if (!project || summaries.length === 0) {
    return null;
  }

  const topSummary = summaries[0];

  return (
    <section className="panel decision-workbench">
      <div className="section-heading">
        <p className="eyebrow">Tidigt skede</p>
        <h2>Alternativrum för läge, form, typ och konstruktion</h2>
        <p className="lede">
          Vi rangordnar koncepten öppet och visar samtidigt hur klimat, läge, form, konstruktion och
          osäkerhet vägs samman. Duplicera scenarier för att prova fler alternativ utan att tappa historik.
        </p>
      </div>

      <div className="objective-toolbar" role="tablist" aria-label="Beslutsmål">
        {(Object.keys(DECISION_OBJECTIVE_LABELS) as DecisionObjective[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`pill-button ${objective === value ? "pill-button-active" : ""}`}
            onClick={() => setObjective(value)}
          >
            {DECISION_OBJECTIVE_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="decision-summary-strip">
        <article className="inline-panel">
          <strong>Bäst för {DECISION_OBJECTIVE_LABELS[objective].toLowerCase()}</strong>
          <span>{topSummary.scenarioName}</span>
          <span>
            Poäng {formatNumber(topSummary.objectiveScore)} • {scoreLabel(topSummary.objectiveScore)}
          </span>
        </article>
        <article className="inline-panel">
          <strong>Aktivt scenario</strong>
          <span>
            {topSummary.scenarioId === activeScenarioId ? topSummary.scenarioName : "Välj ett alternativ i listan"}
          </span>
          <span>{objectiveDescription(objective)}</span>
        </article>
        <article className="inline-panel">
          <strong>Riktningssignal</strong>
          <span>{topSummary.recommendation}</span>
          <span>{topSummary.rationale[1] ?? topSummary.rationale[0]}</span>
        </article>
      </div>

      <div className="decision-grid">
        {summaries.slice(0, 10).map((summary, index) => (
          <article
            key={summary.scenarioId}
            className={`decision-card ${
              summary.scenarioId === activeScenarioId ? "decision-card-active" : ""
            } ${index === 0 ? "decision-card-winner" : ""}`}
          >
            <div className="decision-card-head">
              <div>
                <p className="eyebrow">Rang {index + 1}</p>
                <h3>{summary.scenarioName}</h3>
              </div>
              <div className="decision-score">
                <strong>{formatNumber(summary.objectiveScore)}</strong>
                <span>{summary.objectiveLabel}</span>
              </div>
            </div>

            <div className="decision-chip-row">
              <span className="decision-chip">{summary.labels.buildingType}</span>
              <span className="decision-chip">{summary.labels.buildingForm}</span>
              <span className="decision-chip">{summary.labels.urbanContext}</span>
              <span className="decision-chip">{summary.labels.frameMaterial}</span>
            </div>

            <div className="decision-signal-grid">
              {summary.signals.map((signal) => (
                <div key={`${summary.scenarioId}-${signal.category}`} className="decision-signal">
                  <div className="decision-signal-head">
                    <strong>{signal.title}</strong>
                    <span>{formatNumber(signal.score)}</span>
                  </div>
                  <div className="decision-progress" aria-hidden="true">
                    <span style={{ width: `${signal.score}%` }} />
                  </div>
                  <span className="microcopy">{signal.note}</span>
                  <ul className="decision-detail-list">
                    {signal.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="decision-summary-meta">
              <strong>
                {formatNumber(summary.climateValue)} {summary.climateUnit}
              </strong>
              <span>{summary.benchmarkGap ?? "Ingen benchmark tillgänglig"}</span>
            </div>

            <div className="decision-typology">
              <strong>Typologipreset</strong>
              <span>{summary.typology.label}</span>
              <span className="microcopy">{summary.typology.note}</span>
              <ul className="decision-detail-list">
                {summary.typology.defaults.map((item) => (
                  <li key={`${summary.scenarioId}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="decision-actions">
              <button type="button" className="ghost-button" onClick={() => onSelectScenario(summary.scenarioId)}>
                Välj
              </button>
              {onOpenAnalysis ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onOpenAnalysis(summary.scenarioId, summary.runId)}
                >
                  Visa alternativanalys
                </button>
              ) : null}
              <button type="button" className="submit-button" onClick={() => void onDuplicateScenario(summary.scenarioId)}>
                Duplicera
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="decision-matrix">
        <div className="decision-matrix-row decision-matrix-head">
          <span>Scenario</span>
          <span>Klimat</span>
          <span>Läge</span>
          <span>Form</span>
          <span>Konstruktion</span>
          <span>Robusthet</span>
          <span>Benchmark</span>
        </div>
        {summaries.map((summary) => (
          <button
            type="button"
            key={`${summary.scenarioId}-matrix`}
            className={`decision-matrix-row ${
              summary.scenarioId === activeScenarioId ? "decision-matrix-row-active" : ""
            }`}
            onClick={() => onSelectScenario(summary.scenarioId)}
          >
            <strong>{summary.scenarioName}</strong>
            <span>{formatNumber(summary.climateScore)}</span>
            <span>{formatNumber(summary.locationScore)}</span>
            <span>{formatNumber(summary.formScore)}</span>
            <span>{formatNumber(summary.constructionScore)}</span>
            <span>{formatNumber(summary.robustnessScore)}</span>
            <span>{summary.benchmarkGap ?? "—"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
