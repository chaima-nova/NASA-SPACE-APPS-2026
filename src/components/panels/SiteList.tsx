import type { Prediction } from '../../data-contracts/types';
import type { SiteClassification } from '../../lib/classification';
import { formatCoords, foundByTerraNexus, terrainLabel } from '../../lib/site';
import {
  FIT_BAND_LABELS,
  fitBandFor,
  type FitType,
} from '../../lib/similarity';

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
  /** What the sort menu is reading, so each name can carry its band. */
  fit: FitType;
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
export function SiteList({ items, selectedId, target, total, fit, onSelect }: SiteListProps) {
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
        // One band per row, under whichever fit the menu is reading. Null means
        // that fit carries no ratio for this site, so the name keeps its own colour.
        const band = fitBandFor(fit, classification, target);
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
                {/* The colour states the band; the hidden word states it again for
                    anyone who cannot see the colour. */}
                <span className={band ? `site-name is-${band}` : 'site-name'}>
                  {prediction.siteName}
                  {band ? <span className="sr-only"> — {FIT_BAND_LABELS[band]} fit</span> : null}
                </span>
                {/* A row the screening pass found says so: candidate ground measured
                    out of the committed SRTM grid is a different kind of claim from a
                    site somebody catalogued from the literature. */}
                {foundByTerraNexus(prediction) ? (
                  <span className="site-found">Found by TerraNexus</span>
                ) : null}
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
