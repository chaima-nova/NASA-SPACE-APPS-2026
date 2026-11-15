import { useState } from 'react';
import type { TerrainType } from '../../data-contracts/types';
import type { Origin } from '../../lib/geo';
import { TERRAIN_LABELS, TERRAIN_ORDER, type Target } from '../../lib/site';
import {
  MISSION_PURPOSE_LABELS,
  MISSION_PURPOSE_ORDER,
  type MissionPurpose,
} from '../../lib/travel';

interface FilterBarProps {
  target: Target;
  onTarget: (target: Target) => void;
  terrain: TerrainType | 'all';
  onTerrain: (terrain: TerrainType | 'all') => void;
  counts: Partial<Record<TerrainType, number>>;
  shown: number;
  total: number;
  terrainSimilar: number;
  unmeasured: number;
  datasetCount: number;
  /** Where distances are measured from, or null while the facet is off. */
  origin: Origin | null;
  radiusKm: number;
  onRadius: (radiusKm: number) => void;
  onOpenDistance: () => void;
  /** True when the list is cut to sites that commercial travel can reach. */
  travelOnly: boolean;
  onTravelOnly: (travelOnly: boolean) => void;
  /** What the reader is planning: any number of the six purposes the brief names. */
  purposes: MissionPurpose[];
  onPurposes: (purposes: MissionPurpose[]) => void;
  /** How many sites each purpose would leave, so no chip is a dead end. */
  purposeCounts: Record<MissionPurpose, number>;
}

/**
 * The workbench's constraint row.
 *
 * Terrain and logistics used to sit here as two rows of chips, which pushed the
 * KPIs off the right edge and buried "can I even get there?" among the rock
 * types. Both now live behind one button — Mission constraints — that opens a
 * popout on the left: terrain first, because it is about the ground; mission
 * purpose next, because it says what the reader is planning; then logistics,
 * because it is about the journey. The bar itself keeps only what a
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
  terrainSimilar,
  unmeasured,
  datasetCount,
  origin,
  radiusKm,
  onRadius,
  onOpenDistance,
  travelOnly,
  onTravelOnly,
  purposes,
  onPurposes,
  purposeCounts,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);

  // What the radius box shows while it is being typed in. It is held as text
  // so a half-typed "1" or a just-emptied box does not become a filter.
  const [radiusDraft, setRadiusDraft] = useState(() => String(radiusKm));

  // The full display name is a paragraph; the row only needs the head of it.
  const originLabel = origin
    ? origin.label.split(',')[0].slice(0, 22) +
      (origin.label.split(',')[0].length > 22 ? '…' : '')
    : null;

  const active =
    (terrain === 'all' ? 0 : 1) +
    (origin ? 1 : 0) +
    (travelOnly ? 1 : 0) +
    // One constraint, however many purposes are chosen inside it: the badge counts
    // what narrows the list, not how many chips are lit.
    (purposes.length === 0 ? 0 : 1);

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
          Mission Constraints
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

              {/* A multi-select: a mission can need landing *and* mobility, and a
                  site that answers either one belongs on the shortlist. "All
                  Purposes" is the empty selection, so it clears the others rather
                  than being a seventh thing that can be chosen beside them. */}
              <p className="constraints-title">Mission Purpose</p>
              <div className="chips" role="group" aria-label="Mission purpose, choose any number">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={purposes.length === 0}
                  onClick={() => onPurposes([])}
                >
                  {MISSION_PURPOSE_LABELS.any}
                  <span className="chip-count">{purposeCounts.any}</span>
                </button>
                {MISSION_PURPOSE_ORDER.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={purposes.includes(value)}
                    onClick={() =>
                      onPurposes(
                        purposes.includes(value)
                          ? purposes.filter((entry) => entry !== value)
                          : [...purposes, value],
                      )
                    }
                  >
                    {MISSION_PURPOSE_LABELS[value]}
                    <span className="chip-count">{purposeCounts[value]}</span>
                  </button>
                ))}
              </div>
              {/* Says what each purpose reads, so a chip that removes a site cannot
                  be mistaken for a safety, trafficability or habitability verdict. */}
              <p className="constraints-hint">
                Choose as many as the mission needs; a site stays if it fits at least one of
                them. Each purpose reads a signal this build already holds. Landing — a measured
                slope window with scheduled service into the gate. Mobility — a measured slope
                window, however the site is reached. Navigation — a named target-site crosswalk.
                Robotic Operations — charter or expedition logistics, with no scheduled service.
                Human Exploration — scheduled service into the gate. Construction — a geology
                class shared with the target’s own crosswalk. None of them is a hazard,
                trafficability or habitability assessment.
              </p>

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
                  <span className="logistics-name">Distance From Me</span>
                  <span className="logistics-value">{originLabel ?? 'Not set'}</span>
                </button>

                {origin ? (
                  <label className="logistics-range">
                    <span className="logistics-name">Within</span>
                    <span className="logistics-field">
                      <input
                        type="number"
                        className="distance-range"
                        min={1}
                        max={40000}
                        inputMode="numeric"
                        value={radiusDraft}
                        aria-label="Maximum distance from the chosen origin, in kilometres"
                        onChange={(event) => {
                          // Commit as soon as the box holds a distance; an empty box mid-retype
                          // is left alone rather than read as zero, which would filter the whole
                          // catalogue out between two keystrokes.
                          setRadiusDraft(event.target.value);
                          const next = Number(event.target.value);
                          if (Number.isFinite(next) && next > 0) onRadius(next);
                        }}
                        onBlur={() => {
                          // "0", a minus sign or an empty box must not narrow the list to
                          // nothing, so the field snaps back to the radius actually in force.
                          const next = Number(radiusDraft);
                          const settled =
                            Number.isFinite(next) && next > 0
                              ? Math.min(40000, Math.round(next))
                              : radiusKm;
                          setRadiusDraft(String(settled));
                          if (settled !== radiusKm) onRadius(settled);
                        }}
                      />
                      <span className="logistics-unit">km</span>
                    </span>
                  </label>
                ) : null}

                {/* A checkbox, not a dialog: this row filters the list rather
                    than inspecting one site's route. */}
                <label
                  className={
                    travelOnly
                      ? 'logistics-row logistics-check is-on'
                      : 'logistics-row logistics-check'
                  }
                >
                  <input
                    type="checkbox"
                    checked={travelOnly}
                    onChange={(event) => onTravelOnly(event.target.checked)}
                  />
                  <span className="logistics-name">Commercial Travel Available</span>
                </label>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <dl className="kpis">
        <div>
          <dt>Sites</dt>
          {/* The count alone: the catalogue is small enough that "13/13" reads as
              a fraction nobody asked for, and the denominator only moves when a
              filter is on. The full sentence is kept for the tooltip. */}
          <dd title={`${shown} of ${total} sites shown`}>{shown}</dd>
        </div>
        <div>
          <dt>Terrain similar</dt>
          <dd>{terrainSimilar}</dd>
        </div>
        <div>
          <dt>Unmeasured</dt>
          <dd>{unmeasured}</dd>
        </div>
        <div>
          <dt>Datasets</dt>
          <dd>{datasetCount}</dd>
        </div>
      </dl>
    </div>
  );
}
