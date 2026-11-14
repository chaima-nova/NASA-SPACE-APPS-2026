import { useState } from 'react';
import { Modal } from './Modal';
import { currentOrigin, geocode, type Origin } from '../../lib/geo';

interface DistanceFilterProps {
  origin: Origin | null;
  onPick: (origin: Origin) => void;
  onClear: () => void;
  onClose: () => void;
}

type Mode = 'current' | 'place';

/**
 * The origin picker for "Distance from me".
 *
 * Two routes, because a researcher is not always on site: take the browser's
 * own fix, or type where they are working from. The typed field is free text,
 * so an address, a bare postcode and a city name all work the same way.
 */
export function DistanceFilter({ origin, onPick, onClear, onClose }: DistanceFilterProps) {
  const [mode, setMode] = useState<Mode>('current');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<Origin>) {
    setBusy(true);
    setError(null);
    task()
      .then((next) => {
        onPick(next);
        onClose();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not resolve that place.');
      })
      .finally(() => setBusy(false));
  }

  return (
    <Modal
      kicker="Distance"
      title="Where are you measuring from?"
      subtitle="Analog sites are filtered by how far they are from here. Your location stays in this browser."
      onClose={onClose}
      className="distance-modal"
    >
      <div className="distance-options">
        <button
          type="button"
          className="distance-option"
          aria-pressed={mode === 'current'}
          onClick={() => {
            setMode('current');
            setError(null);
          }}
        >
          <span className="distance-option-title">Use my current location</span>
          <span className="distance-option-hint">
            Asks the browser for a GPS or network fix. Works on https and on localhost.
          </span>
        </button>

        <button
          type="button"
          className="distance-option"
          aria-pressed={mode === 'place'}
          onClick={() => {
            setMode('place');
            setError(null);
          }}
        >
          <span className="distance-option-title">Use a specified location</span>
          <span className="distance-option-hint">
            For when you are not at the lab: type an address, a postcode or just a city.
          </span>
        </button>
      </div>

      {mode === 'current' ? (
        <div className="distance-panel">
          <p className="distance-note">
            Your coordinates filter the list only; they are not stored or sent anywhere.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => run(currentOrigin)}
          >
            {busy ? 'Locating…' : 'Use my location'}
          </button>
        </div>
      ) : (
        <form
          className="distance-panel"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => geocode(query));
          }}
        >
          <label className="distance-field">
            <span className="distance-field-label">Address, postcode or city</span>
            <input
              type="text"
              value={query}
              placeholder="e.g. 10 Downing St, SW1A 2AA, or Bristol"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || query.trim().length < 2}
          >
            {busy ? 'Looking up…' : 'Use this place'}
          </button>
        </form>
      )}

      {error ? (
        <p className="distance-error" role="alert">
          {error}
        </p>
      ) : null}

      {origin ? (
        <div className="distance-current">
          <span className="distance-current-label">Measuring from {origin.label}</span>
          <button type="button" className="btn" onClick={onClear}>
            Clear
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
