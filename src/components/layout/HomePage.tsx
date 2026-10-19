import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { routeHref } from '../../lib/route';

/**
 * The two halves of the cover: the cold place you land on, and the hot one its
 * ground actually resembles. Resolved through `BASE_URL` so the files are found
 * both from the dev server root and from the relative base a GitHub Pages build
 * uses.
 *
 * Both are committed under `public/home/`, so swapping in different photographs
 * is a file replacement — no code change.
 */
const ARCTIC_PHOTO = `${import.meta.env.BASE_URL}home/arctic.jpg`;
const DESERT_PHOTO = `${import.meta.env.BASE_URL}home/desert.jpg`;

interface HomePageProps {
  /** Live counts, so the page never advertises numbers the app does not have. */
  sites: number;
  datasets: number;
  /** Reduced motion, from the accessibility settings. */
  still: boolean;
}

/**
 * The cover: one idea, one action, no dashboard.
 *
 * The workbench answers "which site, how good, on what evidence" and needs the
 * whole screen to do it. That is the wrong first impression for someone who has
 * never heard the phrase "terrestrial analog", so the landing page says the
 * premise in a sentence and hands them a single button. Everything interactive
 * stays behind the Solution tab.
 *
 * The counts are passed in from the live data rather than typed here: a cover
 * that claims 13 sites while the app has 12 is the kind of detail that makes a
 * reader distrust the rest of the numbers.
 *
 * The backdrop is a photograph rather than a drawn sky. Dragging the pointer
 * across the hero paints the desert on top of the ice with one broad brush:
 * every point on the stroke is redrawn each tick as three concentric passes
 * whose width falls off faster than their strength, so the trail tapers to a
 * point and dries out behind the cursor. Touch, reduced motion and blind mode
 * leave the still ice frame alone, which is why the effect is decoration and
 * not content.
 */
export function HomePage({ sites, datasets, still }: HomePageProps) {
  const stepsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const sandRef = useRef<HTMLCanvasElement>(null);
  const clearTimer = useRef<number>(0);

  useEffect(() => {
    const canvas = sandRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero || still) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.src = DESERT_PHOTO;

    // `flat` is the desert drawn to cover the frame; `mask` holds the dabs. The
    // visible canvas is `flat` clipped by `mask`, recomposed at most once a frame.
    const flat = document.createElement('canvas');
    const mask = document.createElement('canvas');
    const flatCtx = flat.getContext('2d');
    const maskCtx = mask.getContext('2d');
    if (!flatCtx || !maskCtx) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let ready = false;
    let last: { x: number; y: number } | null = null;
    let frame = 0;
    let dirty = false;
    let ticker = 0;

    /** One point along a stroke, with its brush width and when it was laid down. */
    interface Stamp {
      x: number;
      y: number;
      w: number;
      born: number;
    }

    const stamps: Stamp[] = [];
    /** How long a stroke survives before the ice is back. */
    const LIFE = 1200;
    /** How often the mask is rebuilt — 33 fps is plenty for a drying trail. */
    const TICK = 30;
    const MAX_STAMPS = 110;

    const composite = () => {
      frame = 0;
      if (!dirty) return;
      dirty = false;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(flat, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    };

    const schedule = () => {
      dirty = true;
      if (!frame) frame = window.requestAnimationFrame(composite);
    };

    const drawFlat = () => {
      flatCtx.clearRect(0, 0, width, height);
      if (!ready) return;
      // Cover, never stretch: the desert keeps its aspect ratio at any frame.
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const dw = image.naturalWidth * scale;
      const dh = image.naturalHeight * scale;
      flatCtx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
    };

    const resize = () => {
      const box = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = Math.max(1, Math.round(box.width * dpr));
      height = Math.max(1, Math.round(box.height * dpr));
      for (const target of [canvas, flat, mask]) {
        target.width = width;
        target.height = height;
      }
      stamps.length = 0;
      last = null;
      maskCtx.clearRect(0, 0, width, height);
      drawFlat();
      schedule();
    };

    // Stable jitter: the same wobble keeps its shape while it lives, instead of
    // shimmering on every repaint.
    const noise = (i: number, k: number) => {
      const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
      return s - Math.floor(s) - 0.5;
    };

    // One broad stroke, drawn in three concentric passes: the widest is the
    // feathered edge, the narrowest carries the body. Width and alpha both fall
    // off with age — width faster than alpha, so the tail thins to a point as it
    // dries instead of fading as a uniform band.
    const PASSES = [
      { width: 1, alpha: 0.26 },
      { width: 0.74, alpha: 0.3 },
      { width: 0.46, alpha: 0.34 },
    ];

    /** Rebuild the mask from the live stamps. */
    const render = () => {
      ticker = 0;
      const now = performance.now();
      while (stamps.length && now - stamps[0].born > LIFE) stamps.shift();
      maskCtx.clearRect(0, 0, width, height);

      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';

      for (let i = 0; i < stamps.length - 1; i += 1) {
        const a = stamps[i];
        const b = stamps[i + 1];
        const life = 1 - (now - a.born) / LIFE;
        if (life <= 0) continue;
        const taper = Math.pow(life, 0.8);
        const alpha = Math.pow(life, 1.4);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        // A little drift of the centreline keeps the edge organic; it is a
        // shape wobble, not separate strands.
        const wobble = noise(i, 0) * Math.min(a.w, b.w) * 0.05;
        const w = Math.min(a.w, b.w) * taper;

        for (const pass of PASSES) {
          maskCtx.strokeStyle = `rgba(255, 255, 255, ${alpha * pass.alpha})`;
          maskCtx.lineWidth = Math.max(2, w * pass.width);
          maskCtx.beginPath();
          maskCtx.moveTo(a.x + nx * wobble, a.y + ny * wobble);
          maskCtx.lineTo(b.x + nx * wobble, b.y + ny * wobble);
          maskCtx.stroke();
        }
      }

      schedule();
      if (stamps.length) ticker = window.setTimeout(render, TICK);
    };

    const ensureTicker = () => {
      if (!ticker) ticker = window.setTimeout(render, TICK);
    };

    const stampAt = (x: number, y: number, born: number, w: number) => {
      stamps.push({ x: x * dpr, y: y * dpr, w: w * dpr, born });
      if (stamps.length > MAX_STAMPS) stamps.shift();
    };

    const stroke = (x: number, y: number) => {
      const now = performance.now();
      const base = Math.min(width, height) * 0.16;
      if (!last) {
        stampAt(x, y, now, base);
        last = { x, y };
        ensureTicker();
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1.5) return;
      // A fast sweep lays down a thinner line: paint that cannot keep up.
      const widthHere = base * Math.max(0.45, Math.min(1, 1 - distance / 320));
      const steps = Math.max(1, Math.ceil(distance / 6));
      for (let i = 1; i <= steps; i += 1) {
        stampAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps, now, widthHere);
      }
      last = { x, y };
      ensureTicker();
    };

    const reset = () => {
      last = null;
    };

    const clear = () => {
      stamps.length = 0;
      last = null;
      window.clearTimeout(ticker);
      ticker = 0;
      maskCtx.clearRect(0, 0, width, height);
      schedule();
    };

    const onResize = () => resize();
    const observer = new ResizeObserver(onResize);
    observer.observe(hero);

    resize();

    image
      .decode()
      .then(() => {
        ready = true;
        resize();
      })
      .catch(() => {
        // A missing photograph leaves the ice frame: nothing else to do.
      });

    // The handlers live in React, but they need the painter; expose it on the
    // canvas so the component tree stays declarative.
    const painter = {
      stroke: (x: number, y: number) => {
        if (!ready) return;
        stroke(x, y);
      },
      reset,
      clear,
      cancel: () => window.clearTimeout(clearTimer.current),
    };
    (canvas as HTMLCanvasElement & { __painter?: typeof painter }).__painter = painter;

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearTimer.current);
      window.clearTimeout(ticker);
      observer.disconnect();
      delete (canvas as HTMLCanvasElement & { __painter?: typeof painter }).__painter;
    };
  }, [still]);

  const painter = () => {
    const canvas = sandRef.current as
      | (HTMLCanvasElement & {
          __painter?: {
            stroke: (x: number, y: number) => void;
            reset: () => void;
            clear: () => void;
            cancel: () => void;
          };
        })
      | null;
    return canvas?.__painter;
  };

  const reveal = (event: ReactPointerEvent<HTMLElement>) => {
    if (still || event.pointerType === 'touch') return;
    const hero = heroRef.current;
    if (!hero) return;
    const box = hero.getBoundingClientRect();
    const paint = painter();
    if (!paint) return;
    window.clearTimeout(clearTimer.current);
    paint.stroke(event.clientX - box.left, event.clientY - box.top);
    hero.dataset.revealed = 'true';
  };

  const reenter = () => {
    if (still) return;
    window.clearTimeout(clearTimer.current);
    painter()?.reset();
  };

  const conceal = () => {
    const hero = heroRef.current;
    delete hero?.dataset.revealed;
    painter()?.reset();
    window.clearTimeout(clearTimer.current);
    // Let the fade finish, then throw the paint away so the next visit starts clean.
    clearTimer.current = window.setTimeout(() => painter()?.clear(), 360);
  };

  return (
    <main className="home" data-still={still ? 'true' : undefined}>
      <section
        className="home-hero"
        aria-labelledby="home-title"
        ref={heroRef}
        onPointerMove={reveal}
        onPointerDown={reveal}
        onPointerEnter={reenter}
        onPointerLeave={conceal}
        onPointerCancel={conceal}
      >
        <div className="home-photo" aria-hidden="true">
          <img
            className="home-photo-ice"
            src={ARCTIC_PHOTO}
            alt=""
            decoding="async"
            draggable={false}
          />
          <canvas ref={sandRef} className="home-photo-sand" aria-hidden="true" />
        </div>
        <span className="home-photo-credit">Cover photographs: team-supplied</span>

        <div className="home-hero-inner">
          <span className="kicker">NASA Space Apps Challenge 2026</span>
          <h2 id="home-title">Some places on Earth already behave like the Moon or Mars.</h2>
          <p className="home-lede">
            Earth Analogue Site Finder scores real terrestrial ground — deserts, lava
            tubes, impact craters, polar valleys — against what a permanent lunar or Mars
            base has to survive, using NASA datasets. Every score shows its features, its
            evidence and where it came from.
          </p>
          <div className="home-actions">
            <a className="home-cta" href={routeHref('solution')}>
              Open the solution
            </a>
            <button
              type="button"
              className="home-link"
              onClick={() =>
                stepsRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
              }
            >
              How it works
            </button>
          </div>

          <dl className="home-stats">
            <div>
              <dt>Candidate sites</dt>
              <dd>{sites || '—'}</dd>
            </div>
            <div>
              <dt>NASA datasets</dt>
              <dd>{datasets || '—'}</dd>
            </div>
            <div>
              <dt>Destinations</dt>
              <dd>2</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="home-steps" ref={stepsRef} aria-labelledby="home-steps-title">
        <h3 id="home-steps-title">Three steps, no guesswork</h3>
        <ol>
          <li>
            <span className="home-step-n" aria-hidden="true">
              01
            </span>
            <h4>Pick a destination</h4>
            <p>
              Moon or Mars. The same site scores differently against each, because the
              hazards are not the same.
            </p>
          </li>
          <li>
            <span className="home-step-n" aria-hidden="true">
              02
            </span>
            <h4>Read the ranking</h4>
            <p>
              Candidates are ordered by analog fit, with the terrain, the coordinates and
              both scores on every row.
            </p>
          </li>
          <li>
            <span className="home-step-n" aria-hidden="true">
              03
            </span>
            <h4>Check the evidence</h4>
            <p>
              Each dossier shows the features behind the number, the datasets it came from
              and photographs of the ground itself.
            </p>
          </li>
        </ol>
      </section>

      <section className="home-close" aria-labelledby="home-close-title">
        <h3 id="home-close-title">See which Earth sites made the cut.</h3>
        <a className="home-cta" href={routeHref('solution')}>
          Open the solution
        </a>
      </section>
    </main>
  );
}
