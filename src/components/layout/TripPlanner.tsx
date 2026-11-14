import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { OriginPrompt } from './OriginPrompt';
import type { Origin } from '../../lib/geo';
import type { Prediction } from '../../data-contracts/types';
import { ACCESS_LABELS, routeLinks, siteDirectionsUrl, travelAccessOf } from '../../lib/travel';;

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

  /**
   * One click for a whole route: the flight search, the bus and train search
   * and the final-leg directions, opened together. A trip is booked as a
   * route, not leg by leg; the same links also sit under each leg for
   * browsers that stop the extra tabs.
   */
  const bookTrip = () => {
    if (!links) return;
    const targets = [
      links.flights,
      links.transit,
      links.directions,
    ];
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
            <span className="itinerary-total">{Math.round(access.transferKm).toLocaleString("en-US")} km from {links.gatewayCode ?? "the gate"}</span>
          </div>

          {/* The route as a vertical timeline: the start, each leg with the site that sells it, and the arrival. No clock times and no fares — the app knows neither, so the live search is the only honest figure. */}
          <ol className="trip-timeline">
            <li className="trip-step is-start"><span className="trip-step-mark" aria-hidden="true">◎</span><div className="trip-step-body"><span className="trip-step-kicker">Start</span><b>{origin?.label}</b></div></li>
            {links.flights ? (<li className="trip-step is-air"><span className="trip-step-mark" aria-hidden="true">✈</span><div className="trip-step-body"><span className="trip-step-kicker">Flight</span><b>Fly to {links.gatewayCode}</b><span className="trip-step-detail">{origin?.label} → {links.gatewayCode} · {access.gateway?.name}</span><a className="trip-step-link" href={links.flights} target="_blank" rel="noreferrer">Search Live Flights to {links.gatewayCode}</a></div></li>) : null}
            <li className="trip-step is-ground"><span className="trip-step-mark" aria-hidden="true">⇢</span><div className="trip-step-body"><span className="trip-step-kicker">Ground</span><b>{access.transferMode}</b><span className="trip-step-detail">{links.gatewayCode ?? "the gate"} → {site.siteName}</span><a className="trip-step-link" href={links.directions} target="_blank" rel="noreferrer">Directions to the Site</a></div></li>
            <li className="trip-step is-end"><span className="trip-step-mark" aria-hidden="true">◉</span><div className="trip-step-body"><span className="trip-step-kicker">Arrive</span><b>{site.siteName}</b><span className="trip-step-detail">{Math.round(access.transferKm).toLocaleString("en-US")} km from {links.gatewayCode ?? "the gate"}</span></div></li>
          </ol>

          <p className="distance-note">{access.note}</p>

          <div className="trip-actions trip-book">
            <button type="button" className="btn btn-primary" onClick={bookTrip}>Book Trip</button>
          </div>

          <p className="distance-note">Book Trip opens the live searches for the flight, for bus and rail, and for the last leg — allow pop-ups if the browser asks. No fare and no schedule is quoted here, because this app does not know today's: each site shows its own, and the same links sit under each leg above.</p>

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
