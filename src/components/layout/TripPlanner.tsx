import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { OriginPrompt } from './OriginPrompt';
import type { Origin } from '../../lib/geo';
import type { Prediction } from '../../data-contracts/types';
import {
  ACCESS_LABELS,
  formatHours,
  formatMoney,
  routeLinks,
  siteDirectionsUrl,
  travelAccessOf,
  tripEstimate,
  type TripOption,
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
  'Measuring the last leg to the site…',
  'Finding the live searches…',
];

/**
 * "Plan My Trip" — the reader's route to one site, as a timeline.
 *
 * It shows the real gate airport and the real ground leg, then hands over to sites that sell each part: Google Flights for the air leg, Google Maps transit for bus and rail, and a directions link carrying the site's own coordinates.
 *
 * No fare and no duration is printed. The app has no flight API and no timetable, so any figure here would be invented, and a reader plans around a price they are shown. The searches are live; the numbers come from there.
 */
export function TripPlanner({ site, origin, onPick, onClear, onClose }: TripPlannerProps) {

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
  const links = origin ? routeLinks(origin, site) : null;
  /** What the trip costs and takes, as the two options a party picks between. */
  const estimate = origin ? tripEstimate(origin, site) : null;

  /**
   * Which of the two ways the reader is taking. The cards below are the choice,
   * and everything after them follows it: the total is the cost of the picked
   * route rather than a spread across both, the timeline describes that route,
   * and Book Trip opens only the searches that sell it.
   *
   * The pick is held by id, not by the option object, because the estimate is
   * rebuilt whenever the site or the start point changes. When the picked way
   * stops being offered — a road trip once the next site is too far from this
   * start point — the first option still offered takes over, so nothing is left
   * pressed at a route that is not on screen.
   */
  const [pick, setPick] = useState<TripOption['id']>('faster');
  const selected = estimate?.options.find((option) => option.id === pick) ?? estimate?.options[0] ?? null;
  const byRoad = selected?.id === 'cheaper';

  /**
   * One click for a whole route: the flight search, the bus and train search
   * and the final-leg directions, opened together. A trip is booked as a
   * route, not leg by leg; the same links also sit under each leg for
   * browsers that stop the extra tabs.
   */
  const bookTrip = () => {
    if (!links) return;
    // A road trip is one drive: there is no flight and no gate transfer to
    // search, so opening those would send a party after tickets it will not use.
    const targets = byRoad
      ? [links.directions]
      : [links.flights, links.transit, links.directions];
    for (const href of targets) {
      if (href) window.open(href, '_blank', 'noopener');
    }
  };
  return (
    <Modal
      kicker="Logistics"
      title="Plan My Trip"
      subtitle="The real gate airport, the real ground leg, and live searches that sell each part."
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
      ) : !links ? (
        <>
          <p className="distance-error" role="status">No commercial route can be built to {site.siteName} from {origin?.label ?? "your start point"}.</p>
          <p className="distance-note">{access.note}</p>
          <p className="distance-note">The directions link still ends at the site's coordinates, which is what matters when the last leg is a charter or an expedition.</p>
          <div className="trip-actions">
            <a className="btn" href={siteDirectionsUrl(origin!, site)} target="_blank" rel="noreferrer">Directions to the Site</a>
            <button type="button" className="btn" onClick={onClear}>Change Start</button>
          </div>
        </>
      ) : (
        <>
          <div className="travel-summary">
            <span className={`travel-badge is-${access.access}`}>{ACCESS_LABELS[access.access]}</span>
            <span className="itinerary-total">{byRoad && selected ? `${Math.round(selected.km).toLocaleString("en-US")} km by road from ${origin?.label ?? "your start point"}` : `${Math.round(access.transferKm).toLocaleString("en-US")} km from ${links.gatewayCode ?? "the gate"}`}</span>
          </div>

          {/* Cost and time, as the two ways a party can make this trip — and a
              choice between them. The cards are buttons: pressing one re-costs
              the total, rewrites the timeline below and narrows Book Trip to the
              searches that sell the route picked, so the screen describes one
              trip rather than two half-trips. The figures stay modelled, so the
              total is a range said to be modelled, with the live search beside
              it as the only quote. */}
          {estimate && estimate.options.length > 0 ? (
            <>
              {/* The choice is the point of this block: everything under it —
                  the total, the timeline, Book Trip — follows the card pressed. */}
              <p className="distance-note">
                Two ways to make this trip. Pick one: the total, the timeline and Book Trip
                all follow the card you choose.
              </p>

              <div
                className={`trip-options${estimate.options.length > 1 ? '' : ' is-single'}`}
                role="group"
                aria-label="Choose between the cheapest route and the fastest route"
              >
                {estimate.options.map((option) => (
                  <button
                    type="button"
                    className="trip-option"
                    key={option.id}
                    aria-pressed={selected?.id === option.id}
                    onClick={() => setPick(option.id)}
                  >
                    <span className="trip-option-kicker">{option.headline}</span>
                    <b className="trip-option-mode">{option.mode}</b>
                    <span className="trip-option-price">
                      {formatMoney(option.costLow)}–{formatMoney(option.costHigh)}
                    </span>
                    <span className="trip-option-time">
                      {formatHours(option.hours)} · {Math.round(option.km).toLocaleString('en-US')} km
                    </span>
                  </button>
                ))}
              </div>

              {selected ? (
                <p className="trip-total" aria-live="polite">
                  <span className="trip-total-label">Total cost · {selected.headline}</span>
                  <b>{formatMoney(selected.costLow)}–{formatMoney(selected.costHigh)}</b>
                  <span className="trip-total-tag">modelled estimate</span>
                </p>
              ) : null}

              <p className="distance-note">
                {byRoad
                  ? "Priced as one road journey from your start point to the site, with the vehicle and its fuel carried by the party of four. It is a modelled range, not a quote: the driving search below has the real fuel, tolls and hire prices."
                  : estimate.groundPossible
                    ? "Both figures are modelled from the great-circle route to the gate and the measured last leg, priced for a party of four, and the range covers the spread. They are not quotes: the live searches above show the price of the day."
                    : "Only the flying option is modelled from here: an overland trip would be further than the point at which a vehicle stops being the cheaper way to arrive."}
              </p>
            </>
          ) : null}

          {/* The route as a vertical timeline for the option picked above: the start, the leg or legs that option uses with the site that sells each, and the arrival. The hours and the total are modelled; the live search beside each leg is the only quote. */}
          <ol className="trip-timeline">
            <li className="trip-step is-start"><span className="trip-step-mark" aria-hidden="true">◎</span><div className="trip-step-body"><span className="trip-step-kicker">Start</span><b>{origin?.label}</b></div></li>
            {!byRoad && links.flights ? (<li className="trip-step is-air"><span className="trip-step-mark" aria-hidden="true">✈</span><div className="trip-step-body"><span className="trip-step-kicker">Flight</span><b>Fly to {links.gatewayCode}</b><span className="trip-step-detail">{origin?.label} → {links.gatewayCode} · {access.gateway?.name}</span><a className="trip-step-link" href={links.flights} target="_blank" rel="noreferrer">Search Live Flights to {links.gatewayCode}</a></div></li>) : null}
            <li className="trip-step is-ground"><span className="trip-step-mark" aria-hidden="true">⇢</span><div className="trip-step-body"><span className="trip-step-kicker">{byRoad ? "Road" : "Ground"}</span><b>{byRoad ? "Drive to the site" : access.transferMode}</b><span className="trip-step-detail">{byRoad ? origin?.label : (links.gatewayCode ?? "the gate")} → {site.siteName}</span>{byRoad && selected ? (<span className="trip-step-detail">{formatHours(selected.hours)} on the road · {Math.round(selected.km).toLocaleString("en-US")} km</span>) : null}<a className="trip-step-link" href={links.directions} target="_blank" rel="noreferrer">{byRoad ? "Search the Driving Route" : "Directions to the Site"}</a></div></li>
            <li className="trip-step is-end"><span className="trip-step-mark" aria-hidden="true">◉</span><div className="trip-step-body"><span className="trip-step-kicker">Arrive</span><b>{site.siteName}</b><span className="trip-step-detail">{Math.round(access.transferKm).toLocaleString("en-US")} km from {links.gatewayCode ?? "the gate"}</span></div></li>
          </ol>

          <p className="distance-note">{access.note}</p>

          <div className="trip-actions trip-book">
            <button type="button" className="btn btn-primary" onClick={bookTrip}>Book Trip</button>
          </div>

          <p className="distance-note">
            {byRoad
              ? "Book Trip opens the driving route for this trip, with the same link beside the road leg — allow pop-ups if the browser asks. The total above is a modelled range, not a quote: the search is where the real fuel, tolls and hire prices are."
              : "Book Trip opens the live searches for the flight, for bus and rail, and for the last leg — allow pop-ups if the browser asks. The total above is a modelled range, not a quote: the live search has the price a party would actually pay, and the same links sit under each leg."}
          </p>

          <div className="trip-actions">
            <button type="button" className="btn" onClick={onClose}>Close</button>
            <button type="button" className="btn" onClick={onClear}>Change Start</button>
          </div>
        </>
      )}
        </>
      )}
    </Modal>
  );
}
