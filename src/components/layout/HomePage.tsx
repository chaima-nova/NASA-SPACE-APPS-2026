import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
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
 * The backdrop is a photograph rather than a drawn sky: a real view of Earth
 * from the Moon says the premise of the tool faster than any decoration. It is
 * decorative (`alt=""`, inert), and its slow pan is switched off for reduced
 * motion, leaving a still frame that is identical in every other way.
 *
 * Moving the pointer over the hero opens a soft-edged patch of desert over the
 * ice — the point of the tool in one gesture. The patch follows the pointer on
 * a CSS custom property rather than React state, so nothing re-renders while
 * the mouse moves. Touch, reduced motion and blind mode leave the still frame
 * alone, which is why the effect is decoration and not content.
 */
export function HomePage({ sites, datasets, still }: HomePageProps) {
  const stepsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const reveal = (event: ReactPointerEvent<HTMLElement>) => {
    if (still || event.pointerType === 'touch') return;
    const hero = heroRef.current;
    if (!hero) return;
    const box = hero.getBoundingClientRect();
    hero.style.setProperty('--reveal-x', `${event.clientX - box.left}px`);
    hero.style.setProperty('--reveal-y', `${event.clientY - box.top}px`);
    hero.dataset.revealed = 'true';
  };

  const conceal = () => {
    delete heroRef.current?.dataset.revealed;
  };

  return (
    <main className="home" data-still={still ? 'true' : undefined}>
      <section
        className="home-hero"
        aria-labelledby="home-title"
        ref={heroRef}
        onPointerMove={reveal}
        onPointerDown={reveal}
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
          <div className="home-photo-sand">
            <img src={DESERT_PHOTO} alt="" decoding="async" draggable={false} />
          </div>
        </div>
        <span className="home-photo-credit">NASA · Operation IceBridge / JPL-Caltech</span>
        <div className="home-orbit" aria-hidden="true">
          <svg viewBox="0 0 400 400">
            <ellipse cx="200" cy="200" rx="186" ry="120" transform="rotate(-18 200 200)" />
            <ellipse cx="200" cy="200" rx="132" ry="132" />
            <circle className="home-orbit-body" cx="200" cy="200" r="46" />
            <circle className="home-orbit-dot" cx="353" cy="146" r="4" />
          </svg>
        </div>

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
