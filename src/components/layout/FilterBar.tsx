import { useState } from 'react';
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
  /** True when the list is cut to sites that commercial travel can reach. */
  travelOnly: boolean;
  onOpenTravel: () => void;
}

/**
 * The workbench's constraint row.
 *
 * Terrain and logistics used to sit here as two rows of chips, which pushed the
 * KPIs off the right edge and buried "can I even get there?" among the rock
 * types. Both now live behind one button — Mission constraints — that opens a
 * popout on the left: terrain first, because it is about the ground, then
 * logistics, because it is about the journey. The bar itself keeps only what a
 * reader needs at a glance: the target and the four numbers.
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
  travelOnly,
  onOpenTravel,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);

  // The full display name is a paragraph; the row only needs the head of it.
  const originLabel = origin
    ? origin.label.split(',')[0].slice(0, 22) +
      (origin.label.split(',')[0].length > 22 ? '…' : '')
    : null;

  const active =
    (terrain === 'all' ? 0 : 1) + (origin ? 1 : 0) + (travelOnly ? 1 : 0);

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

      <div className="constraints">
        <button
          type="button"
          className="chip chip-constraints"
          aria-expanded={open}
          aria-controls="mission-constraints"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          Mission constraints
          {active > 0 ? <span className="chip-count">{active}</span> : null}
          <span className={open ? 'caret is-open' : 'caret'} aria-hidden="true" />
        </button>

        {open ? (
          <>
            {/* A transparent sheet over the page, so clicking anywhere outside
                the popout closes it without stealing the click. */}
            <button
              type="button"
              className="constraints-scrim"
              aria-label="Close mission constraints"
              tabIndex={-1}
              onClick={() => setOpen(false)}
            />
            <div className="constraints-panel" id="mission-constraints">
              <p className="constraints-title">Terrain</p>
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

              <p className="constraints-title">Logistics</p>
              <div className="logistics">
                <button
                  type="button"
                  className="logistics-row"
                  aria-pressed={origin !== null}
                  onClick={() => {
                    setOpen(false);
                    onOpenDistance();
                  }}
                >
                  <span className="logistics-name">Distance from me</span>
                  <span className="logistics-value">{originLabel ?? 'Not set'}</span>
                </button>

                {origin ? (
                  <label className="logistics-range">
                    <span className="logistics-name">Within</span>
                    <select
                      className="distance-range"
                      value={radiusKm}
                      aria-label="Maximum distance from the chosen origin"
                      onChange={(event) => onRadius(Number(event.target.value))}
                    >
                      {RADIUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toLocaleString('en-US')} km
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <button
                  type="button"
                  className="logistics-row"
                  aria-pressed={travelOnly}
                  onClick={() => {
                    setOpen(false);
                    onOpenTravel();
                  }}
                >
                  <span className="logistics-name">Commercial travel available</span>
                  <span className="logistics-value">{travelOnly ? 'Filtering' : 'Check routes'}</span>
                </button>
              </div>
            </div>
          </>
        ) : null}
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
