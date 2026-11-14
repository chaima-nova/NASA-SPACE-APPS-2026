import { useState } from 'react';
import { currentOrigin, geocode, type Origin } from '../../lib/geo';

type Mode = 'current' | 'place';

interface OriginPromptProps {
  origin: Origin | null;
  onPick: (origin: Origin) => void;
  onClear: () => void;
  /**
   * Runs after a successful pick. The distance sheet closes on it; the travel
   * sheet does not, because travel has something to show once it has an origin.
   */
  onDone?: () => void;
  /** One line explaining why this dialog wants a location. */
  note?: string;
}

/**
 * The two ways of saying where you are: the browser's own fix, or a typed
 * address, postcode or city. Shared by the distance filter and the commercial
 * travel check so the two never drift apart — and so a reader who has already
 * set one is never asked for it again by the other.
 */
export function OriginPrompt({ origin, onPick, onClear, onDone, note }: OriginPromptProps) {
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
        onDone?.();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not resolve that place.');
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
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
            {note ?? 'Your coordinates are used in this browser only; they are not stored or sent anywhere.'}
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(currentOrigin)}>
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
          <button type="submit" className="btn btn-primary" disabled={busy || query.trim().length < 2}>
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
    </>
  );
}
