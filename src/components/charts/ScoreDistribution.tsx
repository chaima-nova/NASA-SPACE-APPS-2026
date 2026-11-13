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
        <CartesianGrid stroke="#1a2230" vertical={false} />
        <XAxis dataKey="label" stroke="#6f7c92" fontSize={10} tickLine={false} />
        <YAxis stroke="#6f7c92" fontSize={10} allowDecimals={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(34, 211, 238, 0.07)' }}
          contentStyle={{
            background: '#0c1118',
            border: '1px solid #253041',
            borderRadius: 6,
            color: '#e7edf7',
            fontSize: 12,
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
