import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Prediction } from '../../data-contracts/types';

interface FeatureImportanceProps {
  predictions: Prediction[];
}

/**
 * Mean absolute feature contribution across predictions — a quick, model-side
 * view of what is driving the analog-fit scores Harshil produces.
 */
export function FeatureImportance({ predictions }: FeatureImportanceProps) {
  const totals = new Map<string, number>();
  for (const p of predictions) {
    for (const [feature, value] of Object.entries(p.featureContributions)) {
      totals.set(feature, (totals.get(feature) ?? 0) + Math.abs(value));
    }
  }

  const divisor = Math.max(1, predictions.length);
  const data = [...totals.entries()]
    .map(([feature, value]) => ({
      feature,
      value: Math.round((value / divisor) * 1000) / 1000,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 0, left: 24 }}
      >
        <CartesianGrid stroke="#1a2230" horizontal={false} />
        <XAxis type="number" stroke="#6f7c92" fontSize={10} tickLine={false} />
        <YAxis
          type="category"
          dataKey="feature"
          stroke="#6f7c92"
          fontSize={10}
          width={120}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(34, 211, 238, 0.07)' }}
          contentStyle={{
            background: '#0c1118',
            border: '1px solid #253041',
            borderRadius: 6,
            color: '#e7edf7',
            fontSize: 12,
          }}
          formatter={(value) => [Number(value).toFixed(3), 'mean |contribution|']}
        />
        <Bar dataKey="value" fill="#22d3ee" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
