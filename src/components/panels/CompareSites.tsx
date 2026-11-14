import { useState } from 'react';
import { Modal } from '../layout/Modal';
import { AnalogueRadar } from '../charts/AnalogueRadar';
import type { Prediction } from '../../data-contracts/types';
import {
  FACTOR_LABELS,
  FACTOR_ORDER,
  factorsOf,
  fitFor,
  formatCoords,
  formatElevation,
  formatScore,
  TARGET_LABELS,
  targetSiteOf,
  terrainLabel,
  verdictOf,
  type Target,
} from '../../lib/site';

interface CompareSitesProps {
  /** The site open in the dossier — the left-hand side, fixed. */
  current: Prediction;
  /** Every ranked site; the comparison picks from these. */
  options: Prediction[];
  target: Target;
  onClose: () => void;
}

/** A plain row: same metric, two sites. */
function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="cmp-row">
      <span className="cmp-label">{label}</span>
      <span className="cmp-value">{a}</span>
      <span className="cmp-value">{b}</span>
      <span className="cmp-delta" aria-hidden="true" />
    </div>
  );
}

/** The scored axes, in radar order: the four pillars first, then the fits. */
const RADAR_AXES = [
  ...FACTOR_ORDER.map((key) => ({ id: key as string, label: FACTOR_LABELS[key] })),
  { id: 'moon', label: 'Moon fit' },
  { id: 'mars', label: 'Mars fit' },
  { id: 'confidence', label: 'Confidence' },
];

/** One site's values, in the same axis order as RADAR_AXES. */
function radarValues(prediction: Prediction): number[] {
  const factors = factorsOf(prediction);
  return [
    factors.geomorphology,
    factors.mineralogy,
    factors.environment,
    factors.logistics,
    fitFor(prediction, 'moon'),
    fitFor(prediction, 'mars'),
    prediction.confidence,
  ];
}

/**
 * Two analogue sites, side by side.
 *
 * The dossier answers "why this site"; this answers "why this one rather than
 * that one", which is the question a selection panel actually asks. The left
 * column is fixed to the site already open, so the comparison is always against
 * what the reader is looking at; the right column is any other scored site.
 *
 * The scored axes are drawn as a radar, because "better on what" is a shape
 * question; the rows below carry only the facts that have no shape — terrain,
 * region, elevation, and the ground each site stands in for.
 */
export function CompareSites({ current, options, target, onClose }: CompareSitesProps) {
  const others = options.filter((option) => option.id !== current.id);
  const [otherId, setOtherId] = useState<string>(
    () =>
      [...others].sort(
        (a, b) => Math.abs(fitFor(b, target) - fitFor(current, target)) - Math.abs(fitFor(a, target) - fitFor(current, target)),
      )[0]?.id ?? current.id,
  );
  const other = others.find((option) => option.id === otherId) ?? current;

  const bodyA = targetSiteOf(current, target);
  const bodyB = targetSiteOf(other, target);

  return (
    <Modal
      kicker="Compare"
      title="Compare Analogue Sites"
      subtitle={`Both sites scored against ${TARGET_LABELS[target]} on the four pillars, both fits and model confidence — with the facts behind the shape underneath.`}
      onClose={onClose}
      size="lg"
      className="compare-sites-modal"
    >
      <div className="cmp-head">
        <div className="cmp-site">
          <span className="kicker">Current analogue</span>
          <h3>{current.siteName}</h3>
          <span className="cmp-meta">
            {terrainLabel(current)} · {formatCoords(current.lat, current.lon)}
          </span>
        </div>

        <label className="cmp-pick">
          <span className="sr-only">Compare with</span>
          <select value={otherId} onChange={(event) => setOtherId(event.target.value)}>
            {others.length === 0 ? <option value={current.id}>No other scored site</option> : null}
            {others.map((option) => (
              <option key={option.id} value={option.id}>
                {option.siteName.split(',')[0]} · {formatScore(fitFor(option, target))}
              </option>
            ))}
          </select>
        </label>

        <div className="cmp-site cmp-site-right">
          <span className="kicker">Compared with</span>
          <h3>{other.siteName}</h3>
          <span className="cmp-meta">
            {terrainLabel(other)} · {formatCoords(other.lat, other.lon)}
          </span>
        </div>
      </div>

      {/* The shape first: the scored axes as one silhouette per site, which is
          what a comparison is actually read for. The facts follow underneath. */}
      <AnalogueRadar
        axes={RADAR_AXES}
        current={{
          label: 'Current analogue',
          color: '#22d3ee',
          values: radarValues(current),
        }}
        other={{
          label: 'Compared with',
          color: '#fbbf24',
          values: radarValues(other),
        }}
      />

      <div className="cmp-table">
        <div className="cmp-row cmp-head-row">
          <span className="cmp-label">Fact</span>
          <span className="cmp-value">Current</span>
          <span className="cmp-value">Comparison</span>
          <span className="cmp-delta" aria-hidden="true" />
        </div>

        <Row label="Terrain" a={terrainLabel(current)} b={terrainLabel(other)} />
        <Row label="Region" a={current.region ?? '—'} b={other.region ?? '—'} />
        <Row
          label="Elevation"
          a={formatElevation(current.elevationM)}
          b={formatElevation(other.elevationM)}
        />
        <Row
          label={`${TARGET_LABELS[target]} ground`}
          a={bodyA ? bodyA.name : 'not crosswalked'}
          b={bodyB ? bodyB.name : 'not crosswalked'}
        />
        <Row
          label="Target coordinates"
          a={bodyA ? formatCoords(bodyA.lat, bodyA.lon) : '—'}
          b={bodyB ? formatCoords(bodyB.lat, bodyB.lon) : '—'}
        />
      </div>

      <div className="cmp-verdicts">
        <div>
          <span className="kicker">Current</span>
          <p>{verdictOf(current, target)}</p>
        </div>
        <div>
          <span className="kicker">Comparison</span>
          <p>{verdictOf(other, target)}</p>
        </div>
      </div>
    </Modal>
  );
}
