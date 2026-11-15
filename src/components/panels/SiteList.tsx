import type { Prediction } from '../../data-contracts/types';
import type { SiteClassification } from '../../lib/classification';
import { STATE_LABELS } from '../../lib/classification';
import { formatCoords, terrainLabel } from '../../lib/site';

/**
 * What a chip says: the dimension's own word, then its state's word.
 *
 * The row used to print one letter and one mark per dimension — "T ✕", "TH ?" —
 * and nothing on the screen said which dimension the letter stood for or what
 * the mark meant. Two words fit; the chips wrap to a second line when the panel
 * is narrow rather than shrinking back into initials.
 */
const DIMENSION_WORDS = { terrain: 'Terrain', geology: 'Geology', thermal: 'Thermal' } as const;

export interface RankedItem {
  prediction: Prediction;
  /** The guide's three verdicts for this site against the active target. */
  classification: SiteClassification;
  /** Kilometres from the reader's chosen origin, when that facet is on. */
  distanceKm?: number;
}

interface SiteListProps {
  items: RankedItem[];
  selectedId: string | null;
  target: 'moon' | 'mars';
  total: number;
  onSelect: (id: string) => void;
}

/**
 * The discovery queue: candidate analog sites, ordered by how settled their
 * classification is against the active target.
 *
 * Each row carries its three dimension states rather than one number, because
 * there is no number: a site can be similar on terrain, different on geology and
 * unmeasured on thermal at the same time, and a single percentage would have to
 * hide two of those three facts to exist.
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
    <ol className="ranked-list" aria-label={`Sites classified against ${target}`}>
      {items.map(({ prediction, classification, distanceKm }, index) => {
        const selected = prediction.id === selectedId;
        const spoken = classification.dimensions
          .map((dimension) => `${dimension.label}: ${STATE_LABELS[dimension.state].toLowerCase()}`)
          .join(', ');
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
                {/* The whole name, country included: the row used to drop
                    everything after the first comma and then ellipsise what was
                    left, so it identified the site twice over badly. */}
                <span className="site-name">{prediction.siteName}</span>
                <span className="site-meta">
                  {terrainLabel(prediction)} · {formatCoords(prediction.lat, prediction.lon)}
                  {distanceKm === undefined
                    ? null
                    : ' · ' + Math.round(distanceKm).toLocaleString('en-US') + ' km away'}
                </span>
                <span className="site-states">
                  {classification.dimensions.map((dimension) => (
                    <span
                      key={dimension.id}
                      className={`state-chip is-${dimension.state}`}
                      title={`${dimension.label}: ${STATE_LABELS[dimension.state]}`}
                    >
                      <span className="state-chip-dim" aria-hidden="true">
                        {DIMENSION_WORDS[dimension.id]}
                      </span>
                      <span className="state-chip-state" aria-hidden="true">
                        {STATE_LABELS[dimension.state]}
                      </span>
                    </span>
                  ))}
                </span>
              </span>
              {/* The three states as a sentence, for a reader who is listening or
                  cannot separate the glyphs: the chips never carry it alone. */}
              <span className="sr-only">{spoken}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
