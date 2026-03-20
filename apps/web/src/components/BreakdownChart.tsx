import { formatNumber, type BreakdownItem } from "../../../../packages/shared/src";
import { ExplainButton } from "./ExplainButton";

interface BreakdownChartProps {
  title: string;
  items: BreakdownItem[];
  scopeLabel?: string;
  scopeNote?: string;
  onExplain?: (traceKey: string) => void;
}

export function BreakdownChart({ title, items, scopeLabel, scopeNote, onExplain }: BreakdownChartProps) {
  const max = Math.max(...items.map((item) => item.valueKgCo2e), 1);

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Uppdelning</p>
        <h3>{title}</h3>
      </div>
      {scopeLabel || scopeNote ? (
        <div className="benchmark-scope-copy">
          {scopeLabel ? <span className="scope-badge">{scopeLabel}</span> : null}
          {scopeNote ? <p className="microcopy">{scopeNote}</p> : null}
        </div>
      ) : null}
      <div className="bars" role="img" aria-label={title}>
        {items.map((item) => (
          <div className="bar-row" key={item.key}>
            <div className="bar-copy">
              <span className="inline-with-action">
                <span>{item.label}</span>
                {onExplain && item.traceKey ? (
                  <ExplainButton label={item.label} onClick={() => onExplain(item.traceKey!)} />
                ) : null}
              </span>
              <strong>{formatNumber(item.valueKgCo2e)} kg CO2e</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <div
                className="bar-fill"
                style={{ width: `${Math.max(8, (item.valueKgCo2e / max) * 100)}%` }}
              />
            </div>
            {item.note ? <p className="microcopy">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
