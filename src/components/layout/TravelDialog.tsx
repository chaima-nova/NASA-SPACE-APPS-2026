import { Modal } from './Modal';
import { OriginPrompt } from './OriginPrompt';
import type { Origin } from '../../lib/geo';
import type { Prediction } from '../../data-contracts/types';
import { ACCESS_LABELS, itinerariesFor, travelAccessOf } from '../../lib/travel';

interface TravelDialogProps {
  /** The site being checked — the one selected in the workbench. */
  site: Prediction | null;
  /** Shared origin: set once, used by both logistics facets. */
  origin: Origin | null;
  onPick: (origin: Origin) => void;
  onClear: () => void;
  travelOnly: boolean;
  onTravelOnly: (on: boolean) => void;
  onClose: () => void;
}

const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/**
 * "Commercial travel available", as a dialog rather than a chip.
 *
 * It answers three questions in order: can this site be reached commercially at
 * all, which airport is the gate, and what do the cheapest and fastest journeys
 * look like from where the reader is. If the distance filter already has an
 * origin, that origin is used and the reader is not asked again — the two
 * facets share one piece of state in the shell.
 */
export function TravelDialog({
  site,
  origin,
  onPick,
  onClear,
  travelOnly,
  onTravelOnly,
  onClose,
}: TravelDialogProps) {
  const access = site ? travelAccessOf(site) : null;
  const pair = site && origin ? itinerariesFor(origin, site) : null;

  return (
    <Modal
      kicker="Logistics"
      title="Commercial travel available"
      subtitle="Real gate airports, a modelled itinerary, and a live link to check today's flights."
      onClose={onClose}
      className="travel-modal"
    >
      {!origin ? (
        <>
          <p className="distance-note">
            Routes are measured from where you start. If you have already set a location under
            Distance from me, that one is reused here.
          </p>
          <OriginPrompt
            origin={origin}
            onPick={onPick}
            onClear={onClear}
            note="The origin shapes the route only; it is not stored or sent anywhere."
          />
        </>
      ) : !site || !access ? (
        <p className="distance-note">Select a site in the ranked list to check how to reach it.</p>
      ) : (
        <>
          <div className="travel-summary">
            <span className={`travel-badge is-${access.access}`}>{ACCESS_LABELS[access.access]}</span>
            <p className="distance-note">{access.note}</p>
          </div>

          {pair ? (
            <>
              <div className="itinerary-grid">
                {[pair.fastest, pair.cheapest].map((itinerary) => (
                  <article key={itinerary.kind} className="itinerary">
                    <div className="itinerary-head">
                      <span className="itinerary-kind">{itinerary.label}</span>
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
                  </article>
                ))}
              </div>

              <div className="travel-actions">
                <a className="btn" href={pair.fastest.flightsUrl} target="_blank" rel="noreferrer">
                  Check live flights to {access.gateway?.code}
                </a>
                <span className="distance-note">
                  Times and fares are modelled from distance, not quoted. The link opens a live
                  Google Flights search for the route so you can verify availability.
                </span>
              </div>
            </>
          ) : (
            <p className="distance-error" role="status">
              No commercial itinerary can be built to {site.siteName} from {origin.label}.
            </p>
          )}

          <div className="distance-current">
            <span className="distance-current-label">Routing from {origin.label}</span>
            <button type="button" className="btn" onClick={onClear}>
              Change
            </button>
          </div>
        </>
      )}

      <label className="travel-toggle">
        <input
          type="checkbox"
          checked={travelOnly}
          onChange={(event) => onTravelOnly(event.target.checked)}
        />
        <span>Only list sites with commercial travel in reach</span>
      </label>
    </Modal>
  );
}
