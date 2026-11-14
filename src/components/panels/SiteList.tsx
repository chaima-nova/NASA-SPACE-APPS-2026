import type { Prediction } from '../../data-contracts/types';
import { scoreColor } from '../../lib/colors';
import { formatScore, terrainLabel, type Target } from '../../lib/site';

export interface RankedItem {
  prediction: Prediction;
  fit: number;
}

interface SiteListProps {
  items: RankedItem[];
  selectedId: string | null;
  target: Target;
  total: number;
  onSelect: (id: string) => void;
}

/**
 * The discovery queue: candidate analog sites, ranked against the active
 * target. Rows are buttons so keyboard users get selection for free; the
 * global arrow-key handler in App.tsx moves between them.
 */
export function SiteList({ items, selectedId, target, total, onSelect }: SiteListProps) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <p>No sites match these filters.</p>
        <p className="empty-sub">Clear a terrain chip or widen the search to see all {total}.</p>
      </div>
    );
  }

  return (
    <ol className="ranked-list" aria-label={`Sites ranked by ${target} analog fit`}>
      {items.map(({ prediction, fit }, index) => {
        const selected = prediction.id === selectedId;
        return (
          <li key={prediction.id}>
            <button
              type="button"
              className={selected ? 'site-row is-selected' : 'site-row'}
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(prediction.id)}
              data-site-id={prediction.id}
            >
              <span className="site-rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="site-main">
                <span className="site-name">{prediction.siteName.split(',')[0]}</span>
                <span className="site-meta">
                  {terrainLabel(prediction)} · {prediction.label}
                </span>
                <span className="site-bar" aria-hidden="true">
                  <span
                    className="site-bar-fill"
                    style={{ width: `${Math.round(fit * 100)}%`, background: scoreColor(fit) }}
                  />
                </span>
              </span>
              <span className="site-score" style={{ color: scoreColor(fit) }}>
                {formatScore(fit)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
