import type { Prediction } from '../../data-contracts/types';
import type { SiteClassification } from '../../lib/classification';
import { formatCoords, terrainLabel } from '../../lib/site';

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
 * A row identifies a site and says where it is; the three dimension verdicts and
 * their percentages live in the dossier. Printing them here as well made every
 * row four lines tall and repeated the dossier in a column too narrow to carry
 * it — three coloured pills per site, all of which had to be read twice.
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
      {items.map(({ prediction, distanceKm }, index) => {
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
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
