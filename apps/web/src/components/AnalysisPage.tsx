import {
  COMPARISON_METRICS,
  formatNumber,
  type BenchmarkProfile,
  type CalculationExplanation,
  type ComparisonMetric,
  type DataSourcesResponse,
  type Project,
  type Scenario,
  type StandardProfile
} from "../../../../packages/shared/src";

import { BenchmarkPositionChart } from "./BenchmarkPositionChart";
import { BreakdownChart } from "./BreakdownChart";
import { GeoJsonMap } from "./GeoJsonMap";
import { ExplainButton } from "./ExplainButton";
import { RunTrendChart } from "./RunTrendChart";
import {
  buildBenchmarkComparisons,
  buildBenchmarkRows,
  buildBranchRows,
  buildInputTraceRows,
  buildRunComparisonRows,
  buildSnapshotHighlights,
  buildTraceEntries,
  buildTrendPoints,
  findExplanationByTraceKey,
  getActiveScenarioRun,
  getComparisonScenarioRun,
  resolveSourceTitles
} from "../lib/analysis";

interface AnalysisPageProps {
  project: Project | null;
  scenario: Scenario | null;
  dataSources: DataSourcesResponse | null;
  benchmarkProfiles: BenchmarkProfile[];
  standardProfiles: StandardProfile[];
  selectedBenchmarkIds: string[];
  selectedStandardIds: string[];
  selectedMetric: ComparisonMetric;
  selectedRunId?: string;
  onRunChange: (runId: string) => void;
  onMetricChange: (metric: ComparisonMetric) => void;
  onToggleBenchmark: (benchmarkId: string) => void;
  onToggleStandard: (standardId: string) => void;
  onExplain: (traceKey: string) => void;
  onBack: () => void;
  onPrint: () => void;
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

function getMetricUnit(result: Scenario["latestResult"], metric: ComparisonMetric) {
  if (metric === "total") {
    return result?.totals.unit ?? "kg CO2e";
  }

  if (metric === "perM2") {
    return result?.perM2.unit ?? "kg CO2e/m2";
  }

  if (metric === "perPerson") {
    return result?.perPerson.unit ?? "kg CO2e/person";
  }

  return result?.perHa?.unit ?? "kg CO2e/ha";
}

export function AnalysisPage({
  project,
  scenario,
  dataSources,
  benchmarkProfiles,
  standardProfiles,
  selectedBenchmarkIds,
  selectedStandardIds,
  selectedMetric,
  selectedRunId,
  onRunChange,
  onMetricChange,
  onToggleBenchmark,
  onToggleStandard,
  onExplain,
  onBack,
  onPrint
}: AnalysisPageProps) {
  const selectedRun = getActiveScenarioRun(scenario, selectedRunId);
  const comparisonRun = getComparisonScenarioRun(scenario, selectedRun);

  if (!scenario || !selectedRun) {
    return (
      <section className="panel analysis-page">
        <div className="analysis-header">
          <div className="section-heading">
            <p className="eyebrow">Separat analysvy</p>
            <h1>Beräkningen gick inte att öppna</h1>
          </div>
          <button type="button" className="ghost-button" onClick={onBack}>
            Tillbaka till arbetsytan
          </button>
        </div>
        <p className="lede">
          Scenariot saknas eller har ännu inga sparade körningar att analysera.
        </p>
      </section>
    );
  }

  const result = selectedRun.result;
  const inputSnapshot = selectedRun.inputSnapshot ?? scenario.quickInput;
  const snapshotHighlights = buildSnapshotHighlights(inputSnapshot);
  const traceRows = buildInputTraceRows(result);
  const branchRows = buildBranchRows(result);
  const traceEntries = buildTraceEntries(result);
  const benchmarkRows = buildBenchmarkRows(
    result,
    selectedMetric,
    benchmarkProfiles,
    selectedBenchmarkIds,
    standardProfiles,
    selectedStandardIds,
    inputSnapshot,
    dataSources
  );
  const benchmarkComparisons = buildBenchmarkComparisons(result, selectedMetric);
  const trendPoints = buildTrendPoints(scenario.runs ?? [], selectedMetric);
  const comparisonRows = buildRunComparisonRows(selectedRun, comparisonRun);
  const explanationEntries = traceEntries;

  const scenarioRunOptions = scenario.runs.length
    ? [...scenario.runs].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      )
    : [selectedRun];

  const metricSummary = [
    result.totals,
    result.perM2,
    result.perPerson,
    result.perHa
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const siteDrivers = result.topDrivers.filter(
    (driver) => driver.category === "site" || driver.traceKey?.startsWith("site.")
  );

  return (
    <section className="panel analysis-page">
      <header className="analysis-header">
        <div className="analysis-title">
          <p className="eyebrow">Separat analysvy</p>
          <h1>{scenario.name}</h1>
          <p className="lede">
            Steg-för-steg-vy för indata, vikter, delbidrag och körningshistorik. Varje rad kan
            kopplas tillbaka till metodspår, referenser och förklaringar.
          </p>
          <div className="analysis-context">
            <span>{project?.name ?? "Projekt"}</span>
            <span>{scenario.mode === "plan" ? "Planobjektläge" : "Snabbscenario"}</span>
            <span>{scenario.runs.length} sparade körningar</span>
          </div>
        </div>

        <div className="analysis-actions">
          <button type="button" className="ghost-button" onClick={onBack}>
            Tillbaka till resultat
          </button>
          <button type="button" className="ghost-button" onClick={onPrint}>
            Skriv ut
          </button>
        </div>

        <div className="report-controls analysis-controls">
          <label>
            Visad körning
            <select
              value={selectedRun.id}
              onChange={(event) => onRunChange(event.target.value)}
            >
              {scenarioRunOptions.map((run) => (
                <option key={run.id} value={run.id}>
                  {new Intl.DateTimeFormat("sv-SE", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(run.createdAt))}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-control" role="tablist" aria-label="Mått">
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
        </div>
      </header>

      <section className="analysis-kpi-grid">
        {metricSummary.map((metric) => (
          <article key={metric.label} className="report-kpi">
            <div className="inline-with-action">
              <span>{metric.label}</span>
              {metric.traceKey ? <ExplainButton label={metric.label} onClick={() => onExplain(metric.traceKey ?? "totals")} /> : null}
            </div>
            <strong>
              {formatNumber(metric.value)} {metric.unit}
            </strong>
            <span>
              {metric.label === result.perHa?.label
                ? "Visar platsrelaterad intensitet när yta finns i underlaget"
                : metric.label === result.perPerson.label
                  ? `${result.population.totalPeople} personer i underlaget`
                  : metric.label === result.perM2.label
                    ? "Huvudmått för benchmark och systemval"
                    : "Summa av livscykelposter i körningen"}
            </span>
          </article>
        ))}
      </section>

      <section className="report-dual-grid">
        <section className="report-card">
          <div className="section-heading">
            <p className="eyebrow">Indata</p>
            <h2>Valda värden i scenario-snapshot</h2>
          </div>
          <div className="analysis-highlight-grid">
            {snapshotHighlights.map((item) => (
              <article key={item.label} className="analysis-highlight">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                {item.note ? <p className="microcopy">{item.note}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="report-card">
          <div className="section-heading">
            <p className="eyebrow">Körningshistorik</p>
            <h2>Utveckling mellan sparade körningar</h2>
          </div>
          <RunTrendChart
            title={`Trend för ${getMetricLabel(selectedMetric).toLowerCase()}`}
            unit={getMetricUnit(result, selectedMetric)}
            points={trendPoints}
          />
          {comparisonRows.length ? (
            <div className="report-table">
              {comparisonRows.map((row) => (
                <div key={row.metric} className="report-table-row">
                  <strong>{row.label}</strong>
                  <span>
                    {formatNumber(row.comparisonValue ?? 0)} → {formatNumber(row.selectedValue)}{" "}
                    {row.unit}
                  </span>
                  <span>{row.delta && row.delta > 0 ? "+" : ""}
                    {formatNumber(row.delta ?? 0)} ({formatNumber(row.deltaPct ?? 0, 1)}%)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Minst två körningar behövs för att visa jämförelse.</strong>
              <p>Varje ny beräkning sparas automatiskt i körningshistoriken.</p>
            </div>
          )}
        </section>
      </section>

      <section className="report-card">
        <div className="section-heading">
          <p className="eyebrow">Benchmark</p>
          <h2>Jämförelse mot referenser och standardprofiler</h2>
        </div>
        <p className="microcopy">
          Vald visning: {getMetricLabel(selectedMetric)}. Resultatet jämförs mot kommunprofil och
          valda standardprofiler.
        </p>
        <div className="report-dual-grid">
          <BenchmarkPositionChart
            title={`Position för ${getMetricLabel(selectedMetric).toLowerCase()}`}
            unit={getMetricUnit(result, selectedMetric)}
            rows={benchmarkRows}
          />
          <section className="report-card">
            <div className="section-heading">
              <p className="eyebrow">Gap</p>
              <h3>Jämförelseutfall</h3>
            </div>
            <div className="comparison-list">
              {benchmarkComparisons.map((item) => (
                <article key={`${item.referenceLabel}-${item.metric}`} className="comparison-card">
                  <strong>{item.referenceLabel} • {item.label}</strong>
                  <span>
                    Utfall {formatNumber(item.actualValue)} mot referens {formatNumber(item.referenceValue)}
                  </span>
                  <span className={item.status === "below" ? "comparison-status comparison-status-good" : item.status === "above" ? "comparison-status comparison-status-warn" : "comparison-status comparison-status-neutral"}>
                    {item.delta > 0 ? "+" : ""}
                    {formatNumber(item.delta)} ({formatNumber(item.deltaPct, 1)}%)
                  </span>
                </article>
              ))}
            </div>
            <div className="report-table">
              {benchmarkProfiles
                .filter((profile) => selectedBenchmarkIds.includes(profile.id))
                .map((profile) => (
                  <div key={profile.id} className="report-table-row">
                    <strong>{profile.name}</strong>
                    <span>{profile.applicability}</span>
                    <span>
                      {profile.sourceLabel} • v{profile.version} • {profile.updatedAt}
                    </span>
                  </div>
                ))}
              {standardProfiles
                .filter((profile) => selectedStandardIds.includes(profile.id))
                .map((profile) => (
                  <div key={profile.id} className="report-table-row">
                    <strong>{profile.label}</strong>
                    <span>{profile.summary}</span>
                    <span>
                      {resolveSourceTitles(profile.sourceIds, dataSources).join(", ") ||
                        "Bundlad referenskälla"}
                    </span>
                  </div>
                ))}
            </div>
            <div className="benchmark-pills">
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
            <div className="benchmark-pills">
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
          </section>
        </div>
      </section>

      <section className="report-card">
        <div className="section-heading">
          <p className="eyebrow">Viktkedjor</p>
          <h2>Huvudgrenar och delbidrag</h2>
        </div>
        <div className="analysis-branch-grid">
          {branchRows.map((branch) => (
            <article key={branch.id} className="analysis-branch-card">
              <div className="inline-with-action">
                <strong>{branch.label}</strong>
                {branch.traceKey ? (
                  <ExplainButton label={branch.label} onClick={() => onExplain(branch.traceKey ?? "totals")} />
                ) : null}
              </div>
              <strong className="analysis-branch-value">
                {formatNumber(branch.value)} {branch.unit}
              </strong>
              <span>{formatNumber(branch.sharePct, 1)}% av totalen</span>
              <p className="microcopy">{branch.note}</p>
              {branch.breakdown.length ? (
                <div className="analysis-mini-breakdown">
                  {branch.breakdown.map((item) => (
                    <div key={item.key} className="analysis-mini-breakdown-row">
                      <span>{item.label}</span>
                      <strong>
                        {formatNumber(item.value)} {branch.unit}
                      </strong>
                      {item.traceKey ? (
                        <ExplainButton label={item.label} onClick={() => onExplain(item.traceKey ?? "totals")} />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="report-card">
        <div className="section-heading">
          <p className="eyebrow">Detaljerade värden</p>
          <h2>Indata, metodspår och förklaringar</h2>
        </div>
        <div className="analysis-trace-table">
          <div className="analysis-trace-head">
            <strong>Indata</strong>
            <strong>Värde</strong>
            <strong>Källa</strong>
            <strong>Spår</strong>
          </div>
          {traceRows.map((row) => (
            <div key={row.id} className="analysis-trace-row">
              <div className="analysis-trace-label">
                <strong>{row.label}</strong>
                <span>{row.explanationTitle}</span>
              </div>
              <div>{row.value}</div>
              <div>
                <span className={`input-origin input-origin-${row.source}`}>{row.sourceLabel}</span>
              </div>
              <div className="analysis-trace-action">
                <span>{row.usedIn.join(", ")}</span>
                <ExplainButton label={row.label} onClick={() => onExplain(row.traceKey)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="report-card">
        <div className="section-heading">
          <p className="eyebrow">Metodspår</p>
          <h2>Beräkningsförklaringar</h2>
        </div>
        <div className="analysis-explanation-grid">
          {explanationEntries.map((entry) => {
            const explanation = findExplanationByTraceKey(result, entry.traceKey);
            if (!explanation) {
              return null;
            }

            return (
              <article key={entry.id} className="analysis-explanation-card">
                <div className="inline-with-action">
                  <strong>{explanation.title}</strong>
                  <ExplainButton label={explanation.title} onClick={() => onExplain(explanation.traceKey)} />
                </div>
                <p className="microcopy">{explanation.summary}</p>
                <div className="analysis-explanation-meta">
                  <span>{explanation.traceKey}</span>
                  <span>{explanation.formulaText}</span>
                </div>
                <ul className="drawer-list">
                  {explanation.calculationSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <div className="analysis-explanation-inputs">
                  {explanation.inputs.map((input) => (
                    <div key={`${explanation.id}-${input.key}`} className="analysis-explanation-input">
                      <strong>{input.label}</strong>
                      <span>{input.value}</span>
                      <span>{sourceLabel(input.source)}</span>
                    </div>
                  ))}
                </div>
                {explanation.defaultsApplied.length ? (
                  <p className="microcopy">
                    Defaults: {explanation.defaultsApplied.join(", ")}
                  </p>
                ) : null}
                {explanation.evidence.length ? (
                  <div className="analysis-evidence">
                    {explanation.evidence.map((evidence) => (
                      <div key={`${explanation.id}-${evidence.methodId}`} className="analysis-evidence-row">
                        <a href={evidence.url} target="_blank" rel="noreferrer">
                          {evidence.title}
                        </a>
                        <span>
                          {evidence.publisher} • {evidence.versionOrYear}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="report-dual-grid">
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
      </section>

      <section className="report-dual-grid">
        <BreakdownChart
          title="Mobilitet per år"
          items={result.mobility.breakdown}
          onExplain={onExplain}
        />
        <section className="report-card">
          <div className="section-heading">
            <p className="eyebrow">Site</p>
            <h3>Platsbundna drivare</h3>
          </div>
          {siteDrivers.length ? (
            <div className="comparison-list">
              {siteDrivers.map((driver) => (
                <article key={driver.key} className="comparison-card">
                  <strong className="inline-with-action">
                    <span>{driver.label}</span>
                    {driver.traceKey ? (
                      <ExplainButton label={driver.label} onClick={() => onExplain(driver.traceKey ?? "totals")} />
                    ) : null}
                  </strong>
                  <span>{driver.explanation}</span>
                  <span>
                    {formatNumber(driver.impactKgCo2e)} kg CO2e • {formatNumber(driver.sharePct, 1)}%
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Ingen explicit site-post med numeriskt värde i denna körning.</strong>
              <p>Grund, mark och läge återfinns i indata- och metodspåren ovan.</p>
            </div>
          )}
        </section>
      </section>

      <section className="report-dual-grid">
        <section className="report-card">
          <div className="section-heading">
            <p className="eyebrow">Antaganden</p>
            <h3>Metod och källor</h3>
          </div>
          <dl className="assumption-list">
            {result.assumptions.map((assumption: { label: string; value: string }) => (
              <div key={assumption.label}>
                <dt>{assumption.label}</dt>
                <dd>{assumption.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="report-card">
          <div className="section-heading">
            <p className="eyebrow">Källor</p>
            <h3>Källspår i körningen</h3>
          </div>
          <ul className="source-list">
            {result.sources.map(
              (source: {
                id: string;
                title: string;
                publisher: string;
                license: string;
                url: string;
                note?: string;
                updatedAt?: string;
              }) => (
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
              )
            )}
          </ul>
        </section>
      </section>

      {result.byPlanObject?.length ? <GeoJsonMap planObjects={result.byPlanObject} /> : null}
    </section>
  );
}
