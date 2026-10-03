import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Prediction } from '../../data-contracts/types';
import { scoreColor } from '../../lib/colors';

interface ScoreDistributionProps {
  predictions: Prediction[];
}

/** Histogram of analog-fit scores across all candidate sites, in 10 buckets. */
export function ScoreDistribution({ predictions }: ScoreDistributionProps) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${i * 10 + 10}`,
    mid: (i + 0.5) / 10,
    count: 0,
  }));

  for (const p of predictions) {
    const idx = Math.min(9, Math.max(0, Math.floor(p.analogScore * 10)));
    buckets[idx].count += 1;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="rgba(255, 255, 255, 0.12)" vertical={false} />
        <XAxis dataKey="label" stroke="rgba(226, 236, 255, 0.6)" fontSize={10} tickLine={false} />
        <YAxis stroke="rgba(226, 236, 255, 0.6)" fontSize={10} allowDecimals={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(76, 201, 240, 0.08)' }}
          contentStyle={{
            background: 'rgba(14, 20, 44, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: 12,
            color: '#f2f6ff',
            backdropFilter: 'blur(12px)',
          }}
          labelFormatter={(value) => `Analog fit ${value}%`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {buckets.map((b) => (
            <Cell key={b.label} fill={scoreColor(b.mid)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
