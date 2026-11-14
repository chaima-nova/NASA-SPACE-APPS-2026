/**
 * Who is building this, and what each of them owns.
 *
 * This is the team's own division of work, kept in data rather than in the page
 * so a name, a role or a responsibility is a one-line edit here. The
 * responsibilities are the team's own core-responsibility column, split at its
 * commas so each line is one thing owned rather than a paragraph to read.
 *
 * The team owner is listed first, because the owner is the one answerable for
 * the whole; the rest follow in the order the work reaches them.
 */

export interface TeamMember {
  name: string;
  /** The role or domain, as the team names it. */
  role: string;
  /** Marks the team owner; the page badges the name rather than restating it. */
  owner?: boolean;
  /** What they are responsible for, in the order the work reaches them. */
  tasks: string[];
}

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Chaima',
    role: 'Product Direction & System Integration',
    owner: true,
    tasks: [
      'Product architecture.',
      'Discovery workflow.',
      'Cross-team coordination.',
      'System integration and storytelling.',
    ],
  },
  {
    name: 'Abid',
    role: 'Geospatial Data & GIS',
    tasks: [
      'Dataset availability.',
      'Geographic coverage.',
      'Spatial harmonisation.',
      'Candidate mapping.',
    ],
  },
  {
    name: 'Zehra',
    role: 'Scientific Criteria & Validation',
    tasks: [
      'Planetary criteria.',
      'Scientific comparability.',
      'Reference literature.',
      'Validation methodology.',
    ],
  },
  {
    name: 'Harshil',
    role: 'Machine Learning & AI',
    tasks: [
      'Feature analysis.',
      'Screening algorithms.',
      'Candidate-detection models.',
      'Performance evaluation.',
    ],
  },
  {
    name: 'Jasmine',
    role: 'Frontend & User Experience',
    tasks: [
      'Analog Atlas visual UI.',
      'Analog Quest flow.',
      'Analog DNA profiles.',
      'Candidate investigation UX.',
    ],
  },
];

/**
 * The order work flows through the team. Integration sits in the middle because
 * that is where the other threads meet, not because its part starts later.
 */
export const WORKFLOW: readonly { who: string; detail: string }[] = [
  { who: 'Abid', detail: 'Datasets, coverage and spatial harmonisation.' },
  { who: 'Zehra', detail: 'The planetary criteria and the validation methodology.' },
  { who: 'Harshil', detail: 'Feature analysis, screening and candidate detection.' },
  {
    who: 'Chaima',
    detail: 'Product architecture, and the integration that joins the threads.',
  },
  {
    who: 'Jasmine',
    detail: 'The atlas, the quest flow and the investigation interface.',
  },
];

/** What the team wants in place before the official challenge is released. */
export const TEAM_GOAL =
  'The goal before October 28th is that we already have real data, working ML, reusable technical modules and a functioning integration structure — then, when the official challenges are released, we adapt what we have built to the actual problem.';
