import { TEAM, TEAM_GOAL, WORKFLOW } from '../../data/team';
import { routeHref } from '../../lib/route';
import { Starfield } from './Starfield';

interface TeamPageProps {
  /** Reduced motion, from the accessibility settings. */
  still: boolean;
}

/**
 * Who is behind the tool, and what each of them owns.
 *
 * The board this page is built from is a work plan, not a credits strip, so the
 * page keeps that shape: who the team is up top, one card per person with their
 * actual tasks, then the order the work flows through the team. A team page that
 * lists frameworks instead of work reads as filler.
 *
 * All copy lives in `data/team.ts`, so adding a person or fixing a task is a
 * data edit and never a hunt through markup.
 */
export function TeamPage({ still }: TeamPageProps) {
  return (
    <main className="team">
      <section className="team-hero" aria-labelledby="team-title">
        <Starfield still={still} />
        <div className="team-hero-inner">
          <span className="kicker">Our team · NASA Space Apps Challenge 2026</span>
          <h2 id="team-title">Different countries. Same mission.</h2>
          <p className="home-lede">
            Working across the globe, our team has built an analogue site finder from the
            ground up. We all come from different backgrounds, but as a team we have turned
            that spread into a single working system.
          </p>
        </div>
      </section>

      <section className="team-list" aria-labelledby="team-list-title">
        <h3 id="team-list-title">Who does what</h3>
        <ul className="team-grid">
          {TEAM.map((member) => (
            <li className="team-card" key={member.name}>
              <div className="team-card-head">
                <span className="team-initial" aria-hidden="true">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h4>
                    {member.name}{' '}
                    {member.owner ? <span className="team-owner">Team Owner</span> : null}
                  </h4>
                  <p className="team-role">{member.role}</p>
                </div>
              </div>
              <ul className="team-tasks" aria-label={`${member.name}: responsibilities`}>
                {member.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="team-flow" aria-labelledby="team-flow-title">
        <h3 id="team-flow-title">The workflow we are aiming for</h3>
        <ol>
          {WORKFLOW.map((step, index) => (
            <li key={step.who}>
              <span className="team-flow-n" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h4>{step.who}</h4>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-close" aria-labelledby="team-close-title">
        <h3 id="team-close-title">{TEAM_GOAL}</h3>
        <a className="home-cta" href={routeHref('solution')}>
          See what we built
        </a>
      </section>
    </main>
  );
}
