import { formatNumber } from "../../../../packages/shared/src";

interface LifecycleShareItem {
  key: string;
  label: string;
  value: number;
}

interface LifecycleShareChartProps {
  title: string;
  items: LifecycleShareItem[];
}

export function LifecycleShareChart({ title, items }: LifecycleShareChartProps) {
  const total = Math.max(items.reduce((sum, item) => sum + item.value, 0), 1);

  return (
    <section className="report-card">
      <div className="section-heading">
        <p className="eyebrow">Fördelningsdiagram</p>
        <h3>{title}</h3>
      </div>
      <div className="lifecycle-bar" role="img" aria-label={title}>
        {items.map((item) => (
          <div
            key={item.key}
            className={`lifecycle-segment lifecycle-segment-${item.key}`}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="report-table compact-table">
        {items.map((item) => (
          <div key={`${item.key}-row`} className="report-table-row">
            <strong>{item.label}</strong>
            <span>{formatNumber(item.value)} kg CO2e</span>
            <span>{formatNumber((item.value / total) * 100, 1)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
