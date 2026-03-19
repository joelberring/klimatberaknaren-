import { formatNumber } from "../../../../packages/shared/src";

interface TrendPoint {
  id: string;
  label: string;
  value: number;
  meta?: string;
}

interface RunTrendChartProps {
  title: string;
  unit: string;
  points: TrendPoint[];
}

export function RunTrendChart({ title, unit, points }: RunTrendChartProps) {
  if (points.length === 0) {
    return null;
  }

  const width = 320;
  const height = 132;
  const padding = 18;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const valueRange = Math.max(maxValue - minValue, 1);

  const chartPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((point.value - minValue) / valueRange) * (height - padding * 2);
    return {
      ...point,
      x,
      y
    };
  });

  const path = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="report-card">
      <div className="section-heading">
        <p className="eyebrow">Trenddiagram</p>
        <h3>{title}</h3>
      </div>
      <svg
        className="trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          className="trend-axis-line"
        />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="trend-axis-line" />
        <polyline points={path} className="trend-line" />
        {chartPoints.map((point) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r={4} className="trend-dot" />
          </g>
        ))}
      </svg>
      <div className="report-table compact-table">
        {points.map((point) => (
          <div key={`${point.id}-legend`} className="report-table-row">
            <strong>{point.label}</strong>
            <span>
              {formatNumber(point.value)} {unit}
            </span>
            <span>{point.meta ?? "Sparad körning"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
