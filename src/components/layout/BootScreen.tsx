import { useEffect, useRef, useState } from 'react';
import { Starfield } from './Starfield';

interface BootScreenProps {
  /** False while the first dataset request is still running. */
  ready: boolean;
  /** What can already be said about the payload. */
  siteCount: number;
  datasetCount: number;
  /** True when motion is switched off: the ship holds and nothing cycles. */
  still: boolean;
  /** Called after the fade, so the shell can drop the overlay. */
  onExited: () => void;
}

/**
 * The full-window boot screen.
 *
 * The workbench used to appear empty while the first request was in flight: an
 * empty list, an unlit globe, a dossier with no site. A reader could not tell a
 * slow network from a broken build. This covers the window until the dataset is
 * in hand, then fades out of the way.
 *
 * The ship is drawn rather than fetched: no image, no CDN, no dependency, so it
 * paints on the first frame even when the network is what the reader is waiting
 * on. Every moving part is CSS, and `still` stops all of it — reduced motion
 * gets the same screen without the climb, the flame or the cycling line.
 */
const LINES = [
  'Acquiring NASA terrain and imagery…',
  'Scoring analogue sites against both targets…',
  'Reading the gate airports…',
  'Opening the workbench…',
];

/** Matches the .boot opacity transition in styles.css. */
const FADE_MS = 420;

export function BootScreen({ ready, siteCount, datasetCount, still, onExited }: BootScreenProps) {
  const [line, setLine] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // The parent re-renders while the data lands, so the exit callback is kept in
  // a ref: a fresh arrow each render would restart the fade timer.
  const exitRef = useRef(onExited);
  exitRef.current = onExited;

  useEffect(() => {
    if (still || leaving) return;
    const tick = window.setInterval(
      () => setLine((index) => Math.min(index + 1, LINES.length - 1)),
      720,
    );
    return () => window.clearInterval(tick);
  }, [still, leaving]);

  useEffect(() => {
    if (!ready) return;
    setLeaving(true);
    const timer = window.setTimeout(() => exitRef.current(), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return (
    <div className={leaving ? 'boot is-leaving' : 'boot'} role="status" aria-live="polite">
      <Starfield still={still || leaving} />

      <div className="boot-inner">
        <div className="boot-stage" aria-hidden="true">
          <span className="boot-ring" />
          <span className="boot-ring is-late" />
          <span className="boot-trail" />
          <svg className="boot-ship" viewBox="0 0 120 160" focusable="false">
            {/* The exhaust, then the hull: a crew capsule climbing, fins and all. */}
            <path className="boot-flame" d="M60 116c-7 12-7 24 0 36 7-12 7-24 0-36Z" />
            <path className="boot-hull" d="M60 16c10 14 15 30 15 48v30c0 7-7 12-15 12s-15-5-15-12V64c0-18 5-34 15-48Z" />
            <path className="boot-stripe" d="M46 80h28v10H46Z" />
            <path className="boot-fin" d="M45 88 32 112c-2 4 1 8 6 8h7V88Z" />
            <path className="boot-fin" d="M75 88l13 24c2 4-1 8-6 8h-7V88Z" />
            <circle className="boot-window" cx="60" cy="60" r="9" />
          </svg>
        </div>

        <p className="boot-brand">TerraNexus</p>
        <p className="boot-sub">Earth analogue site finder · NASA Space Apps 2026</p>

        <div className="boot-rail" aria-hidden="true">
          <span className="boot-rail-fill" />
        </div>

        <p className="boot-line">{LINES[line]}</p>
        <p className="boot-meta">
          {siteCount > 0
            ? `${siteCount} sites · ${datasetCount} datasets`
            : 'Contacting the dataset…'}
        </p>
      </div>
    </div>
  );
}
