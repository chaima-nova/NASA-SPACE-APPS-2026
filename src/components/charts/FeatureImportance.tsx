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
 * view of what is driving the risk scores Harshil produces.
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
        <CartesianGrid stroke="rgba(255, 255, 255, 0.12)" horizontal={false} />
        <XAxis type="number" stroke="rgba(226, 236, 255, 0.6)" fontSize={10} tickLine={false} />
        <YAxis
          type="category"
          dataKey="feature"
          stroke="rgba(226, 236, 255, 0.6)"
          fontSize={10}
          width={120}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(76, 201, 240, 0.08)' }}
          contentStyle={{
            background: 'rgba(14, 20, 44, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: 12,
            color: '#f2f6ff',
            backdropFilter: 'blur(12px)',
          }}
          formatter={(value) => [Number(value).toFixed(3), 'mean |contribution|']}
        />
        <Bar dataKey="value" fill="#4cc9f0" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
