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
    return "benchmark-point benchmark-point-actual";
  }

  if (kind === "target") {
    return "benchmark-point benchmark-point-target";
  }

  if (kind === "standard") {
    return "benchmark-point benchmark-point-standard";
  }

  return "benchmark-point benchmark-point-benchmark";
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
      <div className="benchmark-axis" role="img" aria-label={title}>
        <div className="benchmark-axis-line" aria-hidden="true" />
        {rows.map((row) => (
          <div
            key={row.id}
            className="benchmark-axis-point"
            style={{ left: `${(row.value / maxValue) * 100}%` }}
          >
            <span className={getMarkerClass(row.kind)} aria-hidden="true" />
            <strong>{row.label}</strong>
            <span>
              {formatNumber(row.value)} {unit}
            </span>
            {row.meta ? <span className="microcopy">{row.meta}</span> : null}
          </div>
        ))}
      </div>
      <div className="report-table compact-table">
        {rows.map((row) => (
          <div key={`${row.id}-table`} className="report-table-row">
            <strong>{row.label}</strong>
            <span>
              {formatNumber(row.value)} {unit}
            </span>
            <span>{row.meta ?? "Referenslinje"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
