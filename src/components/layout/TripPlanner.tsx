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

  /**
   * One click for a whole route: the flight search, the bus and train search
   * and the final-leg directions, opened together. A trip is booked as a
   * route, not leg by leg; the same links also sit under each leg for
   * browsers that stop the extra tabs.
   */
  const bookTrip = () => {
    if (!origin) return;
    const targets = [
      itinerary?.flightsUrl,
      access.gateway ? transitUrl(origin, access.gateway) : null,
      siteDirectionsUrl(origin, site),
    ];
    for (const href of targets) {
      if (href) window.open(href, '_blank', 'noopener');
    }
  };
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
              Change Start
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
              Change Start
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

          {/* The route as a vertical timeline: where it starts, each leg with
              the booking site that sells it, and where it ends. No clock times —
              the hours are modelled, so a clock would be borrowed authority. */}
          <ol className="trip-timeline">
            <li className="trip-step is-start">
              <span className="trip-step-mark" aria-hidden="true">◎</span>
              <div className="trip-step-body">
                <span className="trip-step-kicker">Start</span>
                <b>{origin.label}</b>
              </div>
            </li>
            {itinerary.legs.map((leg, index) => (
              <li key={index} className={'trip-step ' + (index === 0 ? 'is-air' : 'is-ground')}>
                <span className="trip-step-mark" aria-hidden="true">{index === 0 ? '✈' : '⇢'}</span>
                <div className="trip-step-body">
                  <span className="trip-step-kicker">{index === 0 ? 'Flight' : 'Ground'}</span>
                  <b>{leg.mode}</b>
                  <span className="trip-step-detail">{leg.from} → {leg.to}</span>
                  <a
                    className="trip-step-link"
                    href={index === 0 ? itinerary.flightsUrl : siteDirectionsUrl(origin, site)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {index === 0 ? 'Find flights to ' + (access.gateway?.code ?? 'the gate') : 'Directions to the site'}
                  </a>
                </div>
              </li>
            ))}
            <li className="trip-step is-end">
              <span className="trip-step-mark" aria-hidden="true">◉</span>
              <div className="trip-step-body">
                <span className="trip-step-kicker">Arrive</span>
                <b>{site.siteName}</b>
                <span className="trip-step-detail">{access.transferMode} from {access.gateway?.code ?? 'the gate'}</span>
              </div>
            </li>
          </ol>

          <p className="distance-note">
            {access.note} Times and fares are estimates — check the live links before booking.
          </p>

          <p className="distance-note">
            The directions link ends at the site&rsquo;s coordinates, not the airport. Where the
            last leg is off-road or a charter, plan it with the field party before booking the air
            leg.
          </p>

          <div className="trip-actions trip-book">
            <button type="button" className="btn btn-primary" onClick={bookTrip}>
              Book Trip
            </button>
          </div>

          <p className="distance-note">
            Book Trip opens the flight search, the bus and train search and the final-leg directions
            together — allow pop-ups for this page if the browser asks. The same links are under each
            leg above. Times and fares are estimates: check each site before booking.
          </p>

          <div className="trip-actions">
            <button type="button" className="btn" onClick={() => setChoice(null)}>
              Back to Routes
            </button>
            <button type="button" className="btn" onClick={onClear}>
              Change Start
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
