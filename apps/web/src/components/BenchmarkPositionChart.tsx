import { formatNumber } from "../../../../packages/shared/src";

interface BenchmarkPositionRow {
  id: string;
  label: string;
  value: number;
  kind: "actual" | "benchmark" | "target" | "standard";
  meta?: string;
}

interface BenchmarkPositionChartProps {
  title: string;
  unit: string;
  rows: BenchmarkPositionRow[];
}

function getMarkerClass(kind: BenchmarkPositionRow["kind"]) {
  if (kind === "actual") {
    return "benchmark-row-kind benchmark-row-kind-actual";
  }

  if (kind === "target") {
    return "benchmark-row-kind benchmark-row-kind-target";
  }

  if (kind === "standard") {
    return "benchmark-row-kind benchmark-row-kind-standard";
  }

  return "benchmark-row-kind benchmark-row-kind-benchmark";
}

function getKindLabel(kind: BenchmarkPositionRow["kind"]) {
  if (kind === "actual") {
    return "Aktuellt resultat";
  }

  if (kind === "target") {
    return "Mål";
  }

  if (kind === "standard") {
    return "Standardprofil";
  }

  return "Benchmark";
}

export function BenchmarkPositionChart({
  title,
  unit,
  rows
}: BenchmarkPositionChartProps) {
  if (rows.length === 0) {
    return (
      <section className="report-card">
        <div className="section-heading">
          <p className="eyebrow">Benchmarkdiagram</p>
          <h3>{title}</h3>
        </div>
        <div className="empty-state-workbench">
          <p className="microcopy">
            Inga benchmarkvärden är valda ännu. Välj minst en benchmark- eller standardprofil för att visa diagrammet.
          </p>
        </div>
      </section>
    );
  }

  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="report-card">
      <div className="section-heading">
        <p className="eyebrow">Benchmarkdiagram</p>
        <h3>{title}</h3>
      </div>
      <p className="microcopy">
        Varje rad visar ett referensvärde på samma skala. Den svarta markeringen är aktuellt resultat.
      </p>
      <div className="benchmark-list" role="img" aria-label={title}>
        {rows.map((row) => (
          <article key={row.id} className={`benchmark-row-card benchmark-row-card-${row.kind}`}>
            <div className="benchmark-row-head">
              <div className="benchmark-row-labels">
                <span className={getMarkerClass(row.kind)} aria-hidden="true">
                  {getKindLabel(row.kind)}
                </span>
                <strong>{row.label}</strong>
                {row.meta ? <span className="microcopy">{row.meta}</span> : null}
              </div>
              <div className="benchmark-row-value">
                {formatNumber(row.value)} {unit}
              </div>
            </div>
            <div className="benchmark-row-meter" aria-hidden="true">
              <div className="benchmark-row-track">
                <div
                  className={`benchmark-row-fill benchmark-row-fill-${row.kind}`}
                  style={{ width: `${Math.max((row.value / maxValue) * 100, 8)}%` }}
                />
              </div>
              <div className="benchmark-row-scale">
                <span>0</span>
                <span>
                  {formatNumber(maxValue)} {unit}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
