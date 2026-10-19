import { TEAM } from '../../data/team';
import { routeHref } from '../../lib/route';
import { Starfield } from './Starfield';

interface TeamPageProps {
  /** Reduced motion, from the accessibility settings. */
  still: boolean;
}

/**
 * Who is behind the tool.
 *
 * Kept to a heading and a card per person: a team page that lists frameworks
 * instead of work reads as filler, and the judge-facing question is "did the
 * team actually build the thing they are showing". The roster lives in
 * `data/team.ts`, so the page never holds copy that has to be kept in sync.
 */
export function TeamPage({ still }: TeamPageProps) {
  return (
    <main className="team">
      <section className="team-hero" aria-labelledby="team-title">
        <Starfield still={still} />
        <div className="team-hero-inner">
          <span className="kicker">Our team</span>
          <h2 id="team-title">Built for the NASA Space Apps Challenge 2026.</h2>
          <p className="home-lede">
            The challenge: identify Earth locations that analog the permanent Moon base
            locations and Mars. We split it the way the problems split — the interface and
            the visualisation on one side, the data and the API on the other.
          </p>
        </div>
      </section>

      <section className="team-list" aria-labelledby="team-list-title">
        <h3 id="team-list-title">Who did what</h3>
        <ul className="team-grid">
          {TEAM.map((member) => (
            <li className="team-card" key={member.name}>
              <span className="team-initial" aria-hidden="true">
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <h4>{member.name}</h4>
              <p className="team-role">{member.role}</p>
              <p className="team-detail">{member.detail}</p>
              <ul className="team-tags" aria-label={`${member.name}: areas of work`}>
                {member.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-close" aria-labelledby="team-close-title">
        <h3 id="team-close-title">See what they built.</h3>
        <a className="home-cta" href={routeHref('solution')}>
          Open the solution
        </a>
      </section>
    </main>
  );
}
