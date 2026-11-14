import { useState } from 'react';
import { Modal } from '../layout/Modal';
import type { Prediction } from '../../data-contracts/types';
import { scoreColor } from '../../lib/colors';
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

/** A scored row: same metric, two bars, and the gap between them. */
function BarRow({ label, a, b }: { label: string; a: number; b: number }) {
  const delta = a - b;
  return (
    <div className="cmp-row cmp-row-bar">
      <span className="cmp-label">{label}</span>
      <span className="cmp-cell">
        <span className="cmp-bar">
          <span style={{ width: `${Math.max(2, a * 100)}%`, background: scoreColor(a) }} />
        </span>
        <b>{formatScore(a)}</b>
      </span>
      <span className="cmp-cell">
        <span className="cmp-bar">
          <span style={{ width: `${Math.max(2, b * 100)}%`, background: scoreColor(b) }} />
        </span>
        <b>{formatScore(b)}</b>
      </span>
      <span className={delta >= 0 ? 'cmp-delta is-up' : 'cmp-delta is-down'}>
        {delta >= 0 ? '+' : '−'}
        {Math.abs(delta).toFixed(2)}
      </span>
    </div>
  );
}

/**
 * Two analogue sites, side by side.
 *
 * The dossier answers "why this site"; this answers "why this one rather than
 * that one", which is the question a selection panel actually asks. The left
 * column is fixed to the site already open, so the comparison is always against
 * what the reader is looking at; the right column is any other scored site.
 *
 * Every row is the same metric on both sides, with the gap spelled out — a
 * difference you have to work out in your head is not a comparison.
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

  const a = factorsOf(current);
  const b = factorsOf(other);
  const bodyA = targetSiteOf(current, target);
  const bodyB = targetSiteOf(other, target);

  return (
    <Modal
      kicker="Compare"
      title="Compare analogue sites"
      subtitle={`Both sites scored against ${TARGET_LABELS[target]}. The gap is the left site minus the right.`}
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

      <div className="cmp-table">
        <div className="cmp-row cmp-head-row">
          <span className="cmp-label">Metric</span>
          <span className="cmp-value">Current</span>
          <span className="cmp-value">Comparison</span>
          <span className="cmp-delta">Δ</span>
        </div>

        <BarRow
          label={`${TARGET_LABELS[target]} analog fit`}
          a={fitFor(current, target)}
          b={fitFor(other, target)}
        />
        <BarRow label="Moon fit" a={fitFor(current, 'moon')} b={fitFor(other, 'moon')} />
        <BarRow label="Mars fit" a={fitFor(current, 'mars')} b={fitFor(other, 'mars')} />
        <BarRow label="Model confidence" a={current.confidence} b={other.confidence} />

        {FACTOR_ORDER.map((key) => (
          <BarRow key={key} label={FACTOR_LABELS[key]} a={a[key]} b={b[key]} />
        ))}

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
