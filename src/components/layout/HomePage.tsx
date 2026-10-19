import { useRef } from 'react';
import { routeHref } from '../../lib/route';
import { Starfield } from './Starfield';

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
 */
export function HomePage({ sites, datasets, still }: HomePageProps) {
  const stepsRef = useRef<HTMLElement>(null);

  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <Starfield still={still} />
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
