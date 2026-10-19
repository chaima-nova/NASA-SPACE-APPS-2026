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
 * across the hero paints the desert on top of the ice in soft brush dabs: the
 * canvas keeps a mask that the dabs build up, so a sweep leaves a stroke rather
 * than dragging a fixed disc around. That stroke dries out behind the brush, so
 * the ice returns a second or two after you stop moving. Touch, reduced motion
 * and blind mode leave the still ice frame alone, which is why the effect is
 * decoration and not content.
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
    let painted = false;
    let fadeTimer = 0;
    let lastStrokeAt = 0;

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
      maskCtx.clearRect(0, 0, width, height);
      drawFlat();
      schedule();
    };

    // Each stroke dries out: every 75 ms the mask is erased by a small slice,
    // so the trail dissolves behind the brush instead of staining the frame.
    // The loop stops on its own once nothing has been painted for a beat.
    const fade = () => {
      fadeTimer = 0;
      if (!painted) return;
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      maskCtx.fillRect(0, 0, width, height);
      maskCtx.globalCompositeOperation = 'source-over';
      schedule();
      if (performance.now() - lastStrokeAt > 1600) {
        maskCtx.clearRect(0, 0, width, height);
        painted = false;
        schedule();
        return;
      }
      fadeTimer = window.setTimeout(fade, 75);
    };

    const keepDrying = () => {
      painted = true;
      lastStrokeAt = performance.now();
      if (!fadeTimer) fadeTimer = window.setTimeout(fade, 75);
    };

    const dab = (x: number, y: number) => {
      // Wide enough to read as a brush, soft enough that dabs blend into a stroke.
      const radius = Math.min(width, height) * 0.115;
      const gradient = maskCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.45, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      maskCtx.fillStyle = gradient;
      maskCtx.beginPath();
      maskCtx.arc(x, y, radius, 0, Math.PI * 2);
      maskCtx.fill();
    };

    const stroke = (x: number, y: number) => {
      const px = x * dpr;
      const py = y * dpr;
      if (!last) {
        dab(px, py);
        last = { x, y };
        keepDrying();
        schedule();
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 2) return;
      // Space dabs along the segment so a fast sweep is still a continuous
      // stroke rather than a dotted line.
      const steps = Math.max(1, Math.ceil(distance / 7));
      for (let i = 1; i <= steps; i += 1) {
        dab((last.x + (dx * i) / steps) * dpr, (last.y + (dy * i) / steps) * dpr);
      }
      last = { x, y };
      keepDrying();
      schedule();
    };

    const reset = () => {
      last = null;
    };

    const clear = () => {
      maskCtx.clearRect(0, 0, width, height);
      last = null;
      painted = false;
      window.clearTimeout(fadeTimer);
      fadeTimer = 0;
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
      window.clearTimeout(fadeTimer);
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
