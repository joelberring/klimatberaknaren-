import { formatNumber } from "../../../../packages/shared/src";
import { ExplainButton } from "./ExplainButton";

interface MetricCardProps {
  label: string;
  value: number;
  uncertaintyPct: number;
  unit?: string;
  subtitle?: string;
  accent?: "sun" | "forest";
  onExplain?: () => void;
}

export function MetricCard({
  label,
  value,
  uncertaintyPct,
  unit = "kg CO2e",
  subtitle,
  accent = "sun",
  onExplain
}: MetricCardProps) {
  const uncertainty = value * (uncertaintyPct / 100);

  return (
    <article className={`metric-card metric-card-${accent}`}>
      <div className="metric-card-header">
        <p>{label}</p>
        {onExplain ? <ExplainButton label={label} onClick={onExplain} /> : null}
      </div>
      <strong>
        {formatNumber(value)} {unit}
      </strong>
      <span>
        Spann: {formatNumber(Math.round(value - uncertainty))} till{" "}
        {formatNumber(Math.round(value + uncertainty))} {unit}
      </span>
      {subtitle ? <span>{subtitle}</span> : null}
    </article>
  );
}
