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
/**
 * The ridge behind the Mars dune field, painted in under the pointer.
 *
 * Mars opens on the dunes because that is the ground a Mars analogue stands in
 * for; brushing the frame then reveals the mountains behind them, which is the
 * landscape the rover sites actually sit against. There is no second mountain
 * photograph in the repository, so this is the arctic ridge already used as the
 * Moon cover, and the two photographs simply trade places: on the Moon the ridge
 * is the frame and the dunes are painted; on Mars the dunes are the frame and the
 * ridge is painted, in its own orientation.
 */
const RIDGE_PHOTO = ARCTIC_PHOTO;

/**
 * Which photograph is the cover, by target.
 *
 * On the Moon the frame is the arctic one: ice in front, its dune analogue painted
 * in under the pointer. On Mars the frame is already the dune field, because that
 * is the ground a Mars analogue stands in for — a snowfield under an orange shell
 * reads as the wrong planet.
 */
function coverFor(target: 'moon' | 'mars'): string {
  return target === 'mars' ? DESERT_PHOTO : ARCTIC_PHOTO;
}

/** What the brush lays down: the desert under ice, the ridge under dunes. */
function paintFor(target: 'moon' | 'mars'): string {
  return target === 'mars' ? RIDGE_PHOTO : DESERT_PHOTO;
}

interface HomePageProps {
  /** Live counts, so the page never advertises numbers the app does not have. */
  sites: number;
  datasets: number;
  /** Reduced motion, from the accessibility settings. */
  still: boolean;
  /** The selected analogue. The cover photograph follows it. */
  target: 'moon' | 'mars';
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
/**
 * What this build actually does, beyond the three steps above it. Each entry is
 * a title, one line and a few tags rather than a paragraph: nine paragraphs in a
 * three-column grid is a wall, and a reader skimming for the thing they care
 * about should not have to read all nine to find it. The tags are the same claim
 * in noun form, so the row can be scanned without reading the line at all.
 */
const FEATURES: readonly {
  title: string;
  /** One line, and only one: anything longer is a paragraph again. */
  line: string;
  /** Two or three nouns that name the concrete parts of the feature. */
  tags: readonly string[];
}[] = [
  {
    title: 'Accessibility settings',
    line: 'Text size, contrast, motion and a reading mode.',
    tags: ['High contrast', 'Dyslexia face', 'Read aloud'],
  },
  {
    title: 'Plan my trip',
    line: 'Route, hours and a modelled cost to each site.',
    tags: ['Gateway airports', 'Flight or drive', 'Live links'],
  },
  {
    title: 'Heat map and altitude map',
    line: 'The same ground as temperature, or as elevation.',
    tags: ['MODIS LST', 'SRTM metres', 'Fitted scale'],
  },
  {
    title: 'Uncertainty, stated',
    line: 'Engine verdicts sit beside the score, never inside it.',
    tags: ['Four states', 'Gaps named', 'Not averaged'],
  },
  {
    title: 'Export in one press',
    line: 'The ranking out, carrying its own provenance line.',
    tags: ['Excel', 'Google Sheets', 'One HTML page'],
  },
  {
    title: 'Your own field notes',
    line: 'Dated observations, kept beside the measurements.',
    tags: ['Dated', 'Per site', 'In this browser'],
  },
  {
    title: 'Submit an analogue site',
    line: 'Send in ground you think belongs on the list.',
    tags: ['Unreviewed', 'No auto-score', 'One panel'],
  },
  {
    title: 'Photographs from the ground',
    line: 'Attach a frame to a note, credited to its source.',
    tags: ['Local upload', 'Downscaled', 'Credited'],
  },
  {
    title: 'Upvotes on field notes',
    line: 'Agree with an observation, once per browser.',
    tags: ['One vote', 'Raises the note'],
  },
];

export function HomePage({ sites, datasets, still, target }: HomePageProps) {
  const stepsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const sandRef = useRef<HTMLCanvasElement>(null);
  const clearTimer = useRef<number>(0);
  const cover = coverFor(target);

  useEffect(() => {
    const canvas = sandRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero || still) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.src = paintFor(target);

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
    const LIFE = 1320;
    /** How often the mask is rebuilt — 33 fps is plenty for a drying trail. */
    const TICK = 30;
    const MAX_STAMPS = 120;

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
      // Same vertical anchor as `.home-photo-ice`'s object-position (50% 46%).
      // Centring the desert instead left the two frames ~10 px apart once the
      // hero was wider than 16:9, which put every peak and dune ripple just off
      // the ice feature it is meant to replace.
      const dx = (width - dw) / 2;
      const dy = (height - dh) * 0.46;
      // The same cover-fit for both targets: the Mars brush lays the ridge down
      // in its own orientation, so Mars is the Moon frame with the photographs
      // exchanged and nothing turned around.
      flatCtx.drawImage(image, dx, dy, dw, dh);
    };

    const resize = () => {
      // Measure the canvas, not the hero: the canvas sits inside the hero border,
      // so sizing it from the outer box painted the sand at a marginally larger
      // scale than the ice and left the dune tips slightly off the peaks.
      const box = canvas.getBoundingClientRect();
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
      const base = Math.min(width, height) * 0.176;
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
        // A missing photograph leaves the frame underneath untouched, which is
        // the intended look rather than a broken one: on Mars the dunes stay.
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
  }, [still, target]);

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
            src={cover}
            alt=""
            decoding="async"
            draggable={false}
          />
          <canvas ref={sandRef} className="home-photo-sand" aria-hidden="true" />
        </div>

        <div className="home-hero-inner">
          <span className="kicker">NASA Space Apps Challenge 2026</span>
          <h2 id="home-title">Some places on Earth already behave like the Moon or Mars.</h2>
          <p className="home-lede">
            TerraNexus starts with Earth. Rather than requiring users to provide a specific planetary target before searching, the system analyzes geographic areas across a defined Earth coverage using available open datasets and scientifically relevant characteristics.
          </p>
          <div className="home-actions">
            <a className="home-cta" href={routeHref('solution')}>
              Open the Solution
            </a>
            <button
              type="button"
              className="home-link"
              onClick={() =>
                stepsRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
              }
            >
              How It Works
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
        <h3 id="home-steps-title">How It Works</h3>
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

      {/* One bar between the two blocks: how the tool works, then what it does. */}
      <hr className="home-sep" aria-hidden="true" />

      {/* The features, under the steps that reach them. A grid rather than a
          numbered list: these are parallel, not sequential. */}
      <section className="home-features" aria-labelledby="home-features-title">
        <h3 id="home-features-title">Feature highlight</h3>
        <ul>
          {FEATURES.map(({ title, line, tags }, index) => (
            <li key={title}>
              <span className="home-feature-n" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h4>{title}</h4>
              <p className="home-feature-line">{line}</p>
              <ul className="home-feature-tags">
                {tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
