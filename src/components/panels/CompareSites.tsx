import { useState } from 'react';
import { Modal } from '../layout/Modal';
import { AnalogueRadar } from '../charts/AnalogueRadar';
import type { EvidenceState, Prediction } from '../../data-contracts/types';
import type { Origin } from '../../lib/geo';
import {
  ACCESS_LABELS,
  formatHours,
  formatMoney,
  travelAccessOf,
  tripEstimate,
  type Access,
  type TravelAccess,
} from '../../lib/travel';
import {
  classificationSummary,
  classifySite,
  DIMENSION_LABELS,
  DIMENSION_ORDER,
  STATE_LABELS,
} from '../../lib/classification';
import {
  formatCoords,
  formatElevation,
  TARGET_LABELS,
  targetSiteOf,
  terrainLabel,
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

/**
 * One dimension, one state per site.
 *
 * The state is the colour, and the word sits in the cell beside it: a reader
 * comparing a similar terrain against an unmeasured one is making exactly the
 * decision this dialog exists for, and that distinction cannot survive being
 * averaged into a single number.
 */
function StateRow({
  label,
  a,
  b,
}: {
  label: string;
  a: EvidenceState;
  b: EvidenceState;
}) {
  return (
    <div className="cmp-row">
      <span className="cmp-label">{label}</span>
      <span className="cmp-value">
        <span className={`state-chip is-${a}`}>{STATE_LABELS[a]}</span>
      </span>
      <span className="cmp-value">
        <span className={`state-chip is-${b}`}>{STATE_LABELS[b]}</span>
      </span>
      <span className="cmp-delta" aria-hidden="true" />
    </div>
  );
}

/**
 * Two analogue sites, side by side.
 *
 * The dossier answers "why this site"; this answers "why this one rather than
 * that one", which is the question a selection panel actually asks. The left
 * column is fixed to the site already open, so the comparison is always against
 * what the reader is looking at; the right column is any other classified site.
 *
 * The science is read dimension by dimension rather than as a radar of weighted
 * scores, because the project does not compute weights at all: terrain, geology
 * and thermal are independent, each carries one of four states, and a silhouette
 * over eight invented axes was the composite score in disguise.
 */
/** What the comparison is about: the science, or the journey. */
type Basis = 'scientific' | 'logistics';

/** The gate airport, or a dash when the service has none on file. */
const gateLabel = (access: TravelAccess) =>
  access.gateway ? `${access.gateway.code} · ${access.gateway.name}` : '—';

/** The last leg: how far from the gate, and by what. */
const transferLabel = (access: TravelAccess) =>
  access.gateway ? `${Math.round(access.transferKm).toLocaleString('en-US')} km · ${access.transferMode}` : '—';

/* ---- The logistics web ---------------------------------------------------
 *
 * The journey side is still read as a shape: the same radar, over the four
 * things that decide how a party reaches a site. The axes are not scientific
 * scores out of one, so each vertex is a position on a stated scale and each
 * caption prints the fact behind it — an airport code, a distance, a class.
 * Nothing here is a fare or a timetable.
 */

/** Access as a class, drawn from best to worst. */
const ACCESS_SCORE: Record<Access, number> = {
  scheduled: 1,
  charter: 0.55,
  none: 0,
};

const ACCESS_SHORT: Record<Access, string> = {
  scheduled: 'Scheduled',
  charter: 'Charter',
  none: 'None',
};

/** The last leg by the mode travel.ts assigns, a road being the reference. */
const MODE_SCORE: Record<string, number> = {
  'Road transfer': 1,
  'Off-road transfer': 0.6,
  'Charter flight': 0.35,
  'Ice flight or ship': 0.15,
};

/** travel.ts's own "beyond commercial travel" ceiling, so the gate axis is read
 *  against a threshold the app already states rather than one invented here. */
const GATE_CEILING_KM = 4500;

/** Half the Earth's circumference: the air axis is read against the longest
 *  route there is, which is a distance rather than a score. */
const AIR_CEILING_KM = 20000;

const LOGISTICS_AXES = [
  { id: 'access', label: 'Access' },
  { id: 'gate', label: 'Gate' },
  { id: 'leg', label: 'Last leg' },
  { id: 'season', label: 'Season' },
];

const kmLabel = (km: number) => `${Math.round(km).toLocaleString('en-US')} km`;

const seasonLabel = (access: TravelAccess) =>
  access.gateway ? (access.gateway.seasonal ? 'Seasonal' : 'Year-round') : '—';

interface LogisticsRead {
  /** One value per axis, in LOGISTICS_AXES order, plus the air leg when known. */
  values: number[];
  /** The fact each vertex stands for, printed on the axis. */
  readouts: string[];
  access: TravelAccess;
  airKm: number;
  /** Modelled door-to-door time and cost, and a dash when underivable. */
  total: string;
}

/** One site as the logistics web reads it. */
function logisticsOf(site: Prediction, origin: Origin | null): LogisticsRead {
  const access = travelAccessOf(site);
  const values = [
    ACCESS_SCORE[access.access],
    access.gateway ? Math.max(0, 1 - access.transferKm / GATE_CEILING_KM) : 0,
    MODE_SCORE[access.transferMode] ?? 0,
    access.gateway ? (access.gateway.seasonal ? 0.35 : 1) : 0,
  ];
  const readouts = [
    ACCESS_SHORT[access.access],
    access.gateway ? `${access.gateway.code} · ${kmLabel(access.transferKm)}` : '—',
    access.gateway ? access.transferMode : '—',
    seasonLabel(access),
  ];

  let airKm = 0;
  let total = '—';
  if (origin) {
    const estimate = tripEstimate(origin, site);
    airKm = estimate.airKm;
    values.push(airKm > 0 ? Math.max(0, 1 - airKm / AIR_CEILING_KM) : 0);
    readouts.push(airKm > 0 ? kmLabel(airKm) : '—');

    const fastest = estimate.options.find((option) => option.id === 'faster');
    if (fastest) {
      total = `${formatHours(fastest.hours)} · ${formatMoney(fastest.costLow)}–${formatMoney(
        fastest.costHigh,
      )}`;
    }
  }

  return { values, readouts, access, airKm, total };
}

/**
 * The same two sites, read for logistics instead of science.
 *
 * The shape answers "which of these is easier to reach, and on what"; the rows
 * underneath carry the facts that have no shape — the airport, the last leg's
 * mode and length, whether the gate is seasonal. Access and the gate come from
 * the real airports the app holds; the air leg and the modelled total only
 * appear once the reader has set a location, and both are labelled estimates
 * because the app holds no fare or timetable.
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
  const a = logisticsOf(current, origin);
  const b = logisticsOf(other, origin);
  const axes = origin ? [...LOGISTICS_AXES, { id: 'air', label: 'Air leg' }] : LOGISTICS_AXES;

  return (
    <>
      <AnalogueRadar
        axes={axes}
        current={{
          label: 'Current analogue',
          color: '#22d3ee',
          values: a.values,
          readouts: a.readouts,
        }}
        other={{
          label: 'Compared with',
          color: '#fbbf24',
          values: b.values,
          readouts: b.readouts,
        }}
      />

      <div className="cmp-table">
        <div className="cmp-row cmp-head-row">
          <span className="cmp-label">Logistics</span>
          <span className="cmp-value">Current</span>
          <span className="cmp-value">Comparison</span>
          <span className="cmp-delta" aria-hidden="true" />
        </div>
        <Row label="Access" a={ACCESS_LABELS[a.access.access]} b={ACCESS_LABELS[b.access.access]} />
        <Row label="Gate airport" a={gateLabel(a.access)} b={gateLabel(b.access)} />
        <Row label="Gate to site" a={transferLabel(a.access)} b={transferLabel(b.access)} />
        <Row label="Seasonal gate" a={seasonLabel(a.access)} b={seasonLabel(b.access)} />
        {origin ? (
          <>
            <Row
              label="You → gate"
              a={a.airKm ? kmLabel(a.airKm) : '—'}
              b={b.airKm ? kmLabel(b.airKm) : '—'}
            />
            <Row label="Total (modelled)" a={a.total} b={b.total} />
          </>
        ) : null}
      </div>

      <div className="cmp-verdicts">
        <div>
          <span className="kicker">Current</span>
          <p>{a.access.note}</p>
        </div>
        <div>
          <span className="kicker">Comparison</span>
          <p>{b.access.note}</p>
        </div>
      </div>

      <p className="cmp-basis-note">
        {origin
          ? 'Access and the gate are read from the airports on file. Hours and fares are modelled ranges from those distances, not quotes; Plan My Trip hands over to live searches for the flight, the bus and rail, and the last leg.'
          : 'Access and the gate are read from the airports on file. Set a location under Mission constraints › Distance From Me to add the air leg and the modelled total.'}
      </p>
    </>
  );
}

export function CompareSites({ current, options, target, origin, onClose }: CompareSitesProps) {
  const others = options.filter((option) => option.id !== current.id);
  const [otherId, setOtherId] = useState<string>(
    () => [...others].sort((a, b) => a.siteName.localeCompare(b.siteName))[0]?.id ?? current.id,
  );
  /**
   * What is being compared. Scientific reads the three dimension verdicts;
   * logistics reads how each site is reached. Same two sites either way.
   */
  const [basis, setBasis] = useState<Basis>('scientific');

  const other = others.find((option) => option.id === otherId) ?? current;

  const bodyA = targetSiteOf(current, target);
  const bodyB = targetSiteOf(other, target);
  const classificationA = classifySite(current, target);
  const classificationB = classifySite(other, target);

  const stateOf = (index: number, side: 'a' | 'b') =>
    (side === 'a' ? classificationA : classificationB).dimensions[index].state;

  return (
    <Modal
      kicker="Compare"
      title="Compare Analogue Sites"
      subtitle={
        basis === 'scientific'
          ? `Both sites classified against ${TARGET_LABELS[target]} on the guide's three independent dimensions — with the facts behind each verdict underneath.`
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
            {others.length === 0 ? <option value={current.id}>No other classified site</option> : null}
            {others.map((option) => (
              <option key={option.id} value={option.id}>
                {option.siteName.split(',')[0]}
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
          <div className="cmp-table">
            <div className="cmp-row cmp-head-row">
              <span className="cmp-label">Dimension</span>
              <span className="cmp-value">Current</span>
              <span className="cmp-value">Comparison</span>
              <span className="cmp-delta" aria-hidden="true" />
            </div>
            {DIMENSION_ORDER.map((id, index) => (
              <StateRow
                key={id}
                label={DIMENSION_LABELS[id]}
                a={stateOf(index, 'a')}
                b={stateOf(index, 'b')}
              />
            ))}
          </div>

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
              <p>{classificationSummary(classificationA)}</p>
            </div>
            <div>
              <span className="kicker">Comparison</span>
              <p>{classificationSummary(classificationB)}</p>
            </div>
          </div>
        </>
      ) : (
        <LogisticsComparison current={current} other={other} origin={origin} />
      )}

    </Modal>
  );
}
