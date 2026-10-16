import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { SeriesPoint } from '@niubu/core-typings';
import { ChartContainer } from './chart';
export default function MetricChart({
  series,
  title,
  unit,
}: {
  series: readonly SeriesPoint[];
  title: string;
  unit: string;
}) {
  const rows = series.map(p => ({
    date: p.date,
    value:
      p.measure.quality === 'known' && p.measure.value !== null && Number.isFinite(p.measure.value)
        ? p.measure.value
        : null,
  }));
  return (
    <figure className="metric-chart" aria-label={`${title}；单位 ${unit}`}>
      <figcaption>
        {title} <span>({unit})</span>
      </figcaption>
      <ChartContainer config={{ value: { label: title, color: 'var(--primary)' } }}>
        <LineChart data={rows} accessibilityLayer margin={{ top: 12, right: 20, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            tick={{ fill: 'var(--foreground)', fontSize: 11 }}
          />
          <YAxis width={46} tickLine={false} axisLine={false} tick={{ fill: 'var(--foreground)', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            formatter={value => [`${value} ${unit}`, title]}
          />
          <Line
            type="linear"
            dataKey="value"
            name={title}
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}
