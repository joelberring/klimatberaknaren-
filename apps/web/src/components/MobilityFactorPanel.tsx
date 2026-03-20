import { type MobilityFactorRow } from "../lib/analysis";

interface MobilityFactorPanelProps {
  title: string;
  summary: string;
  rows: MobilityFactorRow[];
}

function directionLabel(direction: MobilityFactorRow["direction"]) {
  if (direction === "transit") {
    return "Styr mot kollektivtrafik";
  }

  if (direction === "car") {
    return "Styr mot bil";
  }

  return "Blandad påverkan";
}

export function MobilityFactorPanel({ title, summary, rows }: MobilityFactorPanelProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="report-card mobility-factor-panel">
      <div className="section-heading">
        <p className="eyebrow">Lägespåverkan</p>
        <h3>{title}</h3>
      </div>
      <p className="microcopy">{summary}</p>
      <div className="mobility-factor-grid">
        {rows.map((row) => (
          <article key={row.id} className={`mobility-factor-card mobility-factor-card-${row.direction}`}>
            <div className="mobility-factor-head">
              <div>
                <span className={`mobility-factor-tag mobility-factor-tag-${row.direction}`}>
                  {directionLabel(row.direction)}
                </span>
                <strong>{row.label}</strong>
              </div>
              <span className="mobility-factor-value">{row.value}</span>
            </div>
            <div className="mobility-factor-track" aria-hidden="true">
              <span
                className={`mobility-factor-fill mobility-factor-fill-${row.direction}`}
                style={{ width: `${Math.max(10, Math.min(100, row.score))}%` }}
              />
            </div>
            <p className="microcopy">{row.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
