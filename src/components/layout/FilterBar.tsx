import type { TerrainType } from '../../data-contracts/types';
import { RADIUS_OPTIONS, type Origin } from '../../lib/geo';
import { formatScore, TERRAIN_LABELS, TERRAIN_ORDER, type Target } from '../../lib/site';

interface FilterBarProps {
  target: Target;
  onTarget: (target: Target) => void;
  terrain: TerrainType | 'all';
  onTerrain: (terrain: TerrainType | 'all') => void;
  counts: Partial<Record<TerrainType, number>>;
  shown: number;
  total: number;
  meanFit: number;
  strong: number;
  datasetCount: number;
  /** Where distances are measured from, or null while the facet is off. */
  origin: Origin | null;
  radiusKm: number;
  onRadius: (radiusKm: number) => void;
  onOpenDistance: () => void;
}

/**
 * Facet row. The brief names the terrain families explicitly (desert, polar,
 * volcanic, arid, cave), so they are chips here rather than tags buried in a
 * tooltip — filtering, not guessing at keywords.
 */
export function FilterBar({
  target,
  onTarget,
  terrain,
  onTerrain,
  counts,
  shown,
  total,
  meanFit,
  strong,
  datasetCount,
  origin,
  radiusKm,
  onRadius,
  onOpenDistance,
}: FilterBarProps) {
  // The full display name is a paragraph; the chip only needs the head of it.
  const originLabel = origin
    ? origin.label.split(',')[0].slice(0, 22) +
      (origin.label.split(',')[0].length > 22 ? '…' : '')
    : null;
  return (
    <div className="filterbar">
      <div className="facet-group">
        <span className="facet-label">Target</span>
        <div className="segmented" role="group" aria-label="Comparison target">
          <button
            type="button"
            aria-pressed={target === 'moon'}
            className="segmented-btn"
            onClick={() => onTarget('moon')}
          >
            Moon
          </button>
          <button
            type="button"
            aria-pressed={target === 'mars'}
            className="segmented-btn"
            onClick={() => onTarget('mars')}
          >
            Mars
          </button>
        </div>
      </div>

      <div className="facet-group facet-group-wide">
        <span className="facet-label">Terrain</span>
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={terrain === 'all'}
            onClick={() => onTerrain('all')}
          >
            All
          </button>
          {TERRAIN_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              className="chip"
              aria-pressed={terrain === type}
              onClick={() => onTerrain(terrain === type ? 'all' : type)}
            >
              {TERRAIN_LABELS[type]}
              <span className="chip-count">{counts[type] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="facet-group">
        <span className="facet-label">Distance</span>
        <div className="distance-control">
          <button
            type="button"
            className="chip"
            aria-pressed={origin !== null}
            onClick={onOpenDistance}
          >
            {originLabel ? 'From ' + originLabel : 'Distance from me'}
          </button>
          {origin ? (
            <select
              className="distance-range"
              value={radiusKm}
              aria-label="Maximum distance from the chosen origin"
              onChange={(event) => onRadius(Number(event.target.value))}
            >
              {RADIUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  within {option.toLocaleString('en-US')} km
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <dl className="kpis">
        <div>
          <dt>Sites</dt>
          <dd>
            {shown}
            <span className="kpi-sub">/{total}</span>
          </dd>
        </div>
        <div>
          <dt>Mean fit</dt>
          <dd>{formatScore(meanFit)}</dd>
        </div>
        <div>
          <dt>Strong</dt>
          <dd>{strong}</dd>
        </div>
        <div>
          <dt>Datasets</dt>
          <dd>{datasetCount}</dd>
        </div>
      </dl>
    </div>
  );
}
