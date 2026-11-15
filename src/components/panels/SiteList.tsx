import type { Prediction } from '../../data-contracts/types';
import { bandOf } from '../../lib/colors';
import { formatScore, terrainLabel, type Target } from '../../lib/site';
import type { EvidenceState } from '../../data-contracts/types';

/** The state in three words, because a four-word taxonomy breaks the row. */
const STATE_LABELS: Record<EvidenceState, string> = {
  similar: 'terrain similar',
  different: 'terrain differs',
  insufficient_evidence: 'terrain only',
  not_comparable: 'not comparable',
};

export interface RankedItem {
  prediction: Prediction;
  fit: number;
  /** Kilometres from the reader's chosen origin, when that facet is on. */
  distanceKm?: number;
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
      {items.map(({ prediction, fit, distanceKm }, index) => {
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
                  {distanceKm === undefined
                    ? null
                    : ' · ' + Math.round(distanceKm).toLocaleString('en-US') + ' km away'}
                  {prediction.evidence ? (
                    <>
                      {' · '}
                      <span className={`site-state is-${prediction.evidence}`}>
                        {STATE_LABELS[prediction.evidence]}
                      </span>
                    </>
                  ) : null}
                </span>
                <span className="site-bar" aria-hidden="true">
                  <span
                    className="site-bar-fill"
                    style={{
                      width: `${Math.round(fit * 100)}%`,
                      background: bandOf(fit).color,
                    }}
                  />
                </span>
              </span>
              <span className="site-score" style={{ color: bandOf(fit).color }}>
                {formatScore(fit)}
              </span>
              {/* The band in words, for a reader who is listening or cannot tell
                  the four colours apart: colour is never the only carrier. */}
              <span className="sr-only">{bandOf(fit).band}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
