/**
 * Who is building this, and what each of them owns.
 *
 * This is the team's own division of work, kept in data rather than in the page
 * so a name, a role or a responsibility is a one-line edit here. The
 * responsibilities are the remit as the team defined it, written as statements
 * so a reader sees what each person is answerable for rather than a note
 * addressed to them.
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

export interface FocusArea {
  name: string;
  /** One line on what the area is about. */
  detail: string;
}

/** The three focus areas the team is preparing for. */
export const FOCUS_AREAS: readonly FocusArea[] = [
  {
    name: 'Urban Heat Equity',
    detail: 'Where heat lands hardest inside a city, and who it lands on.',
  },
  {
    name: 'Atmospheric & Environmental Health',
    detail: 'Air, haze and the conditions a base or a city has to live with.',
  },
  {
    name: 'Orbital Dynamics & Space Systems',
    detail: 'Orbits, ephemerides and the geometry that puts a site in context.',
  },
];

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Abid',
    role: 'Geospatial Data & GIS',
    tasks: [
      'Own dataset availability: what exists, from which mission, and under what licence.',
      'Establish geographic coverage — which regions each layer actually reaches.',
      'Harmonise the spatial layers: projections, grids and resolution, so they can be joined.',
      'Map the candidate sites those layers support.',
    ],
  },
  {
    name: 'Zehra',
    role: 'Scientific Criteria & Validation',
    tasks: [
      'Define the planetary criteria a terrestrial site has to meet to count as an analog.',
      'Judge scientific comparability between Earth conditions and the Moon or Mars.',
      'Keep the reference literature behind every criterion.',
      'Own the validation methodology, so a score can be defended rather than asserted.',
    ],
  },
  {
    name: 'Harshil',
    role: 'Machine Learning & AI',
    tasks: [
      'Analyse the features: which measurements actually separate a good analog from a poor one.',
      'Build the screening algorithms that cut a continent down to a shortlist.',
      'Train the candidate-detection models.',
      'Evaluate performance, and report what the models get wrong.',
    ],
  },
  {
    name: 'Jasmine',
    role: 'Frontend & User Experience',
    tasks: [
      'Build the Analog Atlas visual interface.',
      'Design the Analog Quest flow, from the first question to a shortlist.',
      'Render the Analog DNA profiles that explain a site at a glance.',
      'Own the candidate-investigation experience: dossier, comparison and export.',
    ],
  },
  {
    name: 'Chaima',
    role: 'Product Direction & System Integration',
    owner: true,
    tasks: [
      'Set the product architecture: what the finder is for, and how its parts fit.',
      'Own the discovery workflow a reader moves through.',
      'Coordinate across the data, science, ML and interface threads.',
      'Integrate the modules into one running system, and tell its story.',
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
