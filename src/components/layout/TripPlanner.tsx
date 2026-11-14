import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { OriginPrompt } from './OriginPrompt';
import type { Origin } from '../../lib/geo';
import type { Prediction } from '../../data-contracts/types';
import {
  itinerariesFor,
  siteDirectionsUrl,
  transitUrl,
  travelAccessOf,
  flightsUrl,
  type Itinerary,
} from '../../lib/travel';

interface TripPlannerProps {
  /** The site the reader wants to reach. */
  site: Prediction;
  /** Where they start from; asked for here when the shell has no origin yet. */
  origin: Origin | null;
  onPick: (origin: Origin) => void;
  onClear: () => void;
  onClose: () => void;
}

/** The three lines the loading beat cycles through. Short, and about the work. */
const LOADING_LINES = [
  'Reading the gate airports…',
  'Timing the cheap route…',
  'Timing the fast route…',
];

const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/**
 * "Plan My Trip" — the reader's route to one site, as a two-step choice.
 *
 * Step one asks the only question that actually has two answers: the cheapest
 * way there, or the fastest. Step two shows that route and hands over to sites
 * that can sell it — Google Flights for the air leg, Google Maps transit for
 * bus and rail, and a directions link that carries the site's own coordinates
 * so the last leg ends on the ground rather than at the nearest airport.
 *
 * The times and fares are the modelled ones from `lib/travel.ts`, labelled as
 * estimates: nothing here books anything, and no API key ships in the bundle.
 */
export function TripPlanner({ site, origin, onPick, onClear, onClose }: TripPlannerProps) {
  /** Which trade-off the reader asked for; null until they choose. */
  const [choice, setChoice] = useState<'cheapest' | 'fastest' | null>(null);

  /**
   * A short beat of travel before the routes appear. Nothing is being fetched —
   * the itineraries are computed on render — so this is theatre to make the
   * moment of choosing feel like leaving. Reduced motion gets a brief flash
   * rather than a plane crossing the screen.
   */
  const [loading, setLoading] = useState(true);
  const [leg, setLeg] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const total = reduced ? 450 : 1500;
    const ticks = [
      window.setTimeout(() => setLeg(1), total / 3),
      window.setTimeout(() => setLeg(2), (total * 2) / 3),
    ];
    const done = window.setTimeout(() => setLoading(false), total);
    return () => {
      ticks.forEach((tick) => window.clearTimeout(tick));
      window.clearTimeout(done);
    };
  }, []);

  const access = travelAccessOf(site);
  const pair = origin ? itinerariesFor(origin, site) : null;
  const itinerary: Itinerary | null =
    choice === 'cheapest' ? (pair?.cheapest ?? null) : choice === 'fastest' ? (pair?.fastest ?? null) : null;

  return (
    <Modal
      kicker="Logistics"
      title="Plan My Trip"
      subtitle="Pick the trade-off you want — the cheapest way there, or the fastest — then take the route to a site that sells it."
      onClose={onClose}
      className="travel-modal"
    >
      {loading ? (
        <div className="trip-loading" role="status" aria-live="polite">
          <div className="trip-sky" aria-hidden="true">
            <span className="trip-cloud is-a" />
            <span className="trip-cloud is-b" />
            <span className="trip-cloud is-c" />
            <span className="trip-track" />
            <span className="trip-plane">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M2 12.4 22 3l-6.3 18-3.3-6.6L2 12.4Zm9.4 3.1 2.2 4.4 4.2-12-10.4 6.6 4 1Z" />
              </svg>
            </span>
          </div>
          <p className="trip-loading-line">{LOADING_LINES[leg]}</p>
          <span className="trip-loading-hint">
            {site.siteName} · gate {access.gateway?.code ?? 'unmapped'}
          </span>
        </div>
      ) : (
        <>

      {!origin ? (
        <>
          <p className="distance-note">
            The route starts from where you are. If you already set a location under Distance from
            me, that one is reused here.
          </p>
          <OriginPrompt
            origin={origin}
            onPick={onPick}
            onClear={onClear}
            note="Your start point shapes the route only; it is not stored or sent anywhere."
          />
        </>
      ) : !pair ? (
        <>
          <p className="distance-error" role="status">
            No commercial itinerary can be built to {site.siteName} from {origin.label}.
          </p>
          <p className="distance-note">{access.note}</p>
          <div className="trip-actions">
            <a
              className="btn"
              href={siteDirectionsUrl(origin, site)}
              target="_blank"
              rel="noreferrer"
            >
              Directions to the site
            </a>
            <button type="button" className="btn" onClick={onClear}>
              Change start
            </button>
          </div>
        </>
      ) : choice === null ? (
        <>
          <p className="distance-note">
            Two routes from {origin.label} to {site.siteName}, through{' '}
            {access.gateway?.code ?? 'the nearest gate'}. Times and fares are modelled from
            distance, not quoted.
          </p>
          <div className="trip-choices">
            <button type="button" className="trip-choice" onClick={() => setChoice('cheapest')}>
              <span className="trip-choice-index">Option 1</span>
              <span className="trip-choice-label">Cheapest route</span>
              <span className="trip-choice-total">
                {pair.cheapest.hours} h · {money(pair.cheapest.costUsd)}
              </span>
              <span className="trip-choice-hint">One stop, longer day, lowest fare.</span>
            </button>
            <button type="button" className="trip-choice" onClick={() => setChoice('fastest')}>
              <span className="trip-choice-index">Option 2</span>
              <span className="trip-choice-label">Fastest route</span>
              <span className="trip-choice-total">
                {pair.fastest.hours} h · {money(pair.fastest.costUsd)}
              </span>
              <span className="trip-choice-hint">Direct air leg, then straight to the gate.</span>
            </button>
          </div>
          <div className="trip-actions">
            <button type="button" className="btn" onClick={onClear}>
              Change start
            </button>
          </div>
        </>
      ) : itinerary ? (
        <>
          <div className="travel-summary">
            <span className={`travel-badge is-${access.access}`}>{itinerary.label} route</span>
            <span className="itinerary-total">
              {itinerary.hours} h · {money(itinerary.costUsd)}
            </span>
          </div>

          <ol className="itinerary-legs">
            {itinerary.legs.map((leg, index) => (
              <li key={index} className="itinerary-leg">
                <b>
                  {leg.from} → {leg.to}
                </b>
                <span>
                  {leg.mode} · {leg.hours} h · {money(leg.costUsd)}
                </span>
              </li>
            ))}
          </ol>

          <p className="distance-note">
            {access.note} Times and fares are estimates — check the live links before booking.
          </p>

          <div className="trip-links">
            <a
              className="btn btn-primary"
              href={itinerary.flightsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Flights to {access.gateway?.code}
            </a>
            {access.gateway ? (
              <a
                className="btn"
                href={transitUrl(origin, access.gateway)}
                target="_blank"
                rel="noreferrer"
              >
                Bus &amp; train to {access.gateway.name.split(',')[0]}
              </a>
            ) : null}
            <a className="btn" href={siteDirectionsUrl(origin, site)} target="_blank" rel="noreferrer">
              Directions to {site.siteName.split(',')[0]}
            </a>
          </div>

          <p className="distance-note">
            The directions link ends at the site&rsquo;s coordinates, not the airport. Where the
            last leg is off-road or a charter, plan it with the field party before booking the air
            leg.
          </p>

          <div className="trip-actions">
            <button type="button" className="btn" onClick={() => setChoice(null)}>
              Back to routes
            </button>
            <button type="button" className="btn" onClick={onClear}>
              Change start
            </button>
          </div>
        </>
      ) : null}

      {/* Flights are the one link that needs no origin to be useful, so it is
          offered even before a route has been chosen. */}
      {origin && access.gateway && choice === null ? (
        <p className="distance-note">
          <a
            className="link-btn"
            href={flightsUrl(access.gateway.code)}
            target="_blank"
            rel="noreferrer"
          >
            Browse live flights to {access.gateway.code}
          </a>{' '}
          while you decide.
        </p>
      ) : null}
        </>
      )}
    </Modal>
  );
}
