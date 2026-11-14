import { Modal } from './Modal';
import { OriginPrompt } from './OriginPrompt';
import type { Origin } from '../../lib/geo';
import type { Prediction } from '../../data-contracts/types';
import { ACCESS_LABELS, routeLinks, travelAccessOf } from '../../lib/travel';

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

/**
 * "Commercial travel available", as a dialog rather than a chip.
 *
 * It answers three questions in order: can this site be reached commercially at
 * all, which airport is the gate, and where to search the flights and the ground
 * leg from where the reader is. If the distance filter already has an
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
  const links = site && origin ? routeLinks(origin, site) : null;

  return (
    <Modal
      kicker="Logistics"
      title="Commercial Travel Available"
      subtitle="Real gate airports, and live searches for the flights and the ground leg."
      onClose={onClose}
      className="travel-modal"
    >
      {!origin ? (
        <>
          <p className="distance-note">
            Routes are measured from where you start. If you have already set a location under
            Distance From Me, that one is reused here.
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

          {links ? (
            <>
              <div className="travel-actions">
                {links.flights ? (
                  <a className="btn" href={links.flights} target="_blank" rel="noreferrer">
                    Check Live Flights to {links.gatewayCode}
                  </a>
                ) : null}
                {links.transit ? (
                  <a className="btn" href={links.transit} target="_blank" rel="noreferrer">
                    Bus and Rail to {links.gatewayCode}
                  </a>
                ) : null}
                <a className="btn" href={links.directions} target="_blank" rel="noreferrer">
                  Directions to the Site
                </a>
              </div>
              <span className="distance-note">
                Live searches, not quotes: the fare and the timetable are whatever each site
                shows today. This app does not price or time the journey itself.
              </span>
            </>
          ) : (
            <p className="distance-error" role="status">
              No commercial route can be built to {site.siteName} from {origin.label}.
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
