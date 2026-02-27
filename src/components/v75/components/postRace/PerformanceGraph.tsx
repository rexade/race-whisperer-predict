import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { KmtidPerStartAnalytics } from '../../types/postRaceAnalysisTypes';

interface PerformanceGraphProps {
  /** Graph data from kmtid (x/y or distance/value) */
  performanceGraphData?: KmtidPerStartAnalytics['performanceGraphData'];
  className?: string;
}

/**
 * Small line chart for per-start performance (e.g. speed over race).
 * Matches kmtid.atgx.se style (pink/magenta line).
 */
const PerformanceGraph: React.FC<PerformanceGraphProps> = ({
  performanceGraphData,
  className,
}) => {
  if (!performanceGraphData || performanceGraphData.length === 0) {
    return null;
  }

  const data = performanceGraphData.map((point) => {
    if ('x' in point && 'y' in point) {
      return { x: point.x, value: point.y };
    }
    if ('distance' in point && 'value' in point) {
      return { x: point.distance, value: point.value };
    }
    return { x: 0, value: 0 };
  });

  if (data.length === 0) return null;

  return (
    <div className={className} style={{ width: '100%', height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              color: 'hsl(var(--popover-foreground))',
            }}
            formatter={(value: number) => [value, 'Value']}
            labelFormatter={(label) => `${label}m`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgb(219, 39, 119)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceGraph;
