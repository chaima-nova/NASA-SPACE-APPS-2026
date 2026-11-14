import { useState } from 'react';
import { Modal } from '../layout/Modal';
import { AnalogueRadar } from '../charts/AnalogueRadar';
import type { Prediction } from '../../data-contracts/types';
import type { Origin } from '../../lib/geo';
import {
  ACCESS_LABELS,
  itinerariesFor,
  travelAccessOf,
  type TravelAccess,
} from '../../lib/travel';
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
  /** Where the reader starts; the logistics side measures routes from it. */
  origin: Origin | null;
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

/** The scored axes, in radar order: the eight dimensions first, then the fits. */
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
    ...FACTOR_ORDER.map((key) => factors[key]),
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
/** What the comparison is about: the science, or the journey. */
type Basis = 'scientific' | 'logistics';

const money = (value: number) => `${Math.round(value).toLocaleString('en-US')}`;

/** The gate airport, or a dash when the service has none on file. */
const gateLabel = (access: TravelAccess) =>
  access.gateway ? `${access.gateway.code} · ${access.gateway.name}` : '—';

/** The last leg: how far from the gate, and by what. */
const transferLabel = (access: TravelAccess) =>
  access.gateway ? `${Math.round(access.transferKm).toLocaleString('en-US')} km · ${access.transferMode}` : '—';

/**
 * The same two sites, read for logistics instead of science.
 *
 * Access, the gate airport and the last leg come from the real airports the
 * app holds, so they are facts about the site. The door-to-door hours and
 * fares are modelled from air distance, so they only appear with a starting
 * point and are labelled as estimates.
 */
function LogisticsComparison({
  current,
  other,
  origin,
}: {
  current: Prediction;
  other: Prediction;
  origin: Origin | null;
}) {
  const a = travelAccessOf(current);
  const b = travelAccessOf(other);
  const pairA = origin ? itinerariesFor(origin, current) : null;
  const pairB = origin ? itinerariesFor(origin, other) : null;
  const route = (pair: typeof pairA, kind: 'fastest' | 'cheapest') =>
    pair ? `${pair[kind].hours} h · ${money(pair[kind].costUsd)}` : '—';

  return (
    <>
      <div className="cmp-table">
        <div className="cmp-row cmp-head-row">
          <span className="cmp-label">Logistics</span>
          <span className="cmp-value">Current</span>
          <span className="cmp-value">Comparison</span>
          <span className="cmp-delta" aria-hidden="true" />
        </div>
        <Row label="Access" a={ACCESS_LABELS[a.access]} b={ACCESS_LABELS[b.access]} />
        <Row label="Gate airport" a={gateLabel(a)} b={gateLabel(b)} />
        <Row label="Gate to site" a={transferLabel(a)} b={transferLabel(b)} />
        {origin ? (
          <>
            <Row label="Fastest, door to door" a={route(pairA, 'fastest')} b={route(pairB, 'fastest')} />
            <Row label="Cheapest, door to door" a={route(pairA, 'cheapest')} b={route(pairB, 'cheapest')} />
          </>
        ) : null}
      </div>

      <div className="cmp-verdicts">
        <div>
          <span className="kicker">Current</span>
          <p>{a.note}</p>
        </div>
        <div>
          <span className="kicker">Comparison</span>
          <p>{b.note}</p>
        </div>
      </div>

      <p className="cmp-basis-note">
        {origin
          ? 'Access and the gate are read from the airports on file; times and fares are modelled from air distance, not quoted. Plan My Trip opens the live route search.'
          : 'Access and the gate are read from the airports on file. Set a location under Mission constraints › Distance from me to compare door-to-door routes.'}
      </p>
    </>
  );
}

export function CompareSites({ current, options, target, origin, onClose }: CompareSitesProps) {
  const others = options.filter((option) => option.id !== current.id);
  const [otherId, setOtherId] = useState<string>(
    () =>
      [...others].sort(
        (a, b) => Math.abs(fitFor(b, target) - fitFor(current, target)) - Math.abs(fitFor(a, target) - fitFor(current, target)),
      )[0]?.id ?? current.id,
  );
  /**
   * What is being compared. Scientific reads the scored dimensions; logistics
   * reads how each site is reached. Same two sites either way.
   */
  const [basis, setBasis] = useState<Basis>('scientific');

  const other = others.find((option) => option.id === otherId) ?? current;

  const bodyA = targetSiteOf(current, target);
  const bodyB = targetSiteOf(other, target);

  return (
    <Modal
      kicker="Compare"
      title="Compare Analogue Sites"
      subtitle={
        basis === 'scientific'
          ? `Both sites scored against ${TARGET_LABELS[target]} on the eight scientific dimensions, both fits and model confidence — with the facts behind the shape underneath.`
          : `How each site is reached: the commercial access, the gate airport and the last leg${origin ? ', plus the modelled door-to-door route from you' : ''}.`
      }
      onClose={onClose}
      size="lg"
      className="compare-sites-modal"
    >
      <div className="cmp-head">
        {/* The two sites are the subject, so they sit as one centred pair with
            a rule between them; the picker that changes the right-hand site
            moves to the right edge, out of the line of comparison. */}
        <div className="cmp-pair">
          <div className="cmp-site">
            <span className="kicker">Current analogue</span>
            <h3>{current.siteName}</h3>
            <span className="cmp-meta">
              {terrainLabel(current)} · {formatCoords(current.lat, current.lon)}
            </span>
          </div>

          <span className="cmp-rule" aria-hidden="true" />

          <div className="cmp-site">
            <span className="kicker">Compared with</span>
            <h3>{other.siteName}</h3>
            <span className="cmp-meta">
              {terrainLabel(other)} · {formatCoords(other.lat, other.lon)}
            </span>
          </div>
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
      </div>

      <div className="cmp-basis">
        <label className="cmp-pick">
          <span className="sr-only">Comparison basis</span>
          <select value={basis} onChange={(event) => setBasis(event.target.value as Basis)}>
            <option value="scientific">Scientific</option>
            <option value="logistics">Logistics</option>
          </select>
        </label>
      </div>

      {basis === 'scientific' ? (
        <>
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
          <span className="cmp-label">Aspect</span>
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
        </>
      ) : (
        <LogisticsComparison current={current} other={other} origin={origin} />
      )}

    </Modal>
  );
}
