/**
 * Who is building this, and what each of them owns.
 *
 * This is the team's own division of work, kept in data rather than in the page
 * so a name, a role or a responsibility is a one-line edit here. The
 * descriptions are the team's own core-responsibility column kept as one line
 * of prose, because that is how the team wrote them: broken at the commas they
 * read as four unrelated bullet points rather than as one person's remit.
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
  /** What they own, in the team's own words, as one line rather than a list. */
  description: string;
}

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Chaima Hafsi',
    role: 'Product Direction & System Integration',
    owner: true,
    description: 'Product architecture, discovery workflow, cross-team coordination, system integration, storytelling.',
  },
  {
    name: 'Abid T.S',
    role: 'Geospatial Data & GIS',
    description: 'Dataset availability, geographic coverage, spatial harmonisation, candidate mapping.',
  },
  {
    name: 'Zehra Merve Camci',
    role: 'Scientific Criteria & Validation',
    description: 'Planetary criteria, scientific comparability, reference literature, validation methodology.',
  },
  {
    name: 'Harshil P',
    role: 'Machine Learning & AI',
    description: 'Feature analysis, screening algorithms, candidate-detection models, performance evaluation.',
  },
  {
    name: 'Jasmine Jowahir',
    role: 'Frontend & User Experience',
    description: 'Analog Atlas visual UI, Analog Quest flow, Analog DNA profiles, candidate investigation UX.',
  },
];

/**
 * The order work flows through the team. Integration sits in the middle because
 * that is where the other threads meet, not because its part starts later.
 */
export const WORKFLOW: readonly { who: string; detail: string }[] = [
  { who: 'Abid T.S', detail: 'Datasets, coverage and spatial harmonisation.' },
  { who: 'Zehra Merve Camci', detail: 'The planetary criteria and the validation methodology.' },
  { who: 'Harshil P', detail: 'Feature analysis, screening and candidate detection.' },
  {
    who: 'Chaima Hafsi',
    detail: 'Product architecture, and the integration that joins the threads.',
  },
  {
    who: 'Jasmine Jowahir',
    detail: 'The atlas, the quest flow and the investigation interface.',
  },
];

