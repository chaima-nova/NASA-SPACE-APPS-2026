/**
 * Who is building this, and what each of them owns before the challenge drops.
 *
 * This is the team's own plan, kept in data rather than in the page so a name,
 * a role or a task is a one-line edit here. The tasks are the board's wording,
 * lightly turned into statements ("start collecting…") so a reader sees what
 * each person is doing rather than a note addressed to them.
 */

export interface TeamMember {
  name: string;
  /** The remit, as the board names it. */
  role: string;
  /** What they own, in the order they would do it. */
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
    role: 'NASA Data / Platform',
    tasks: [
      'Start collecting and preparing the actual NASA datasets we can use across our three focus areas.',
      'Set up the data-ingestion workflows so we can download and access the datasets consistently.',
      'Clean and organise the data, and document where each dataset comes from.',
      'Prepare sample datasets that can be handed directly to Farwa and Harshil for their work.',
      'Keep the data workflows reusable so we can adapt them once the official challenge is released.',
    ],
  },
  {
    name: 'Farwa',
    role: 'Earth Observation / Geospatial',
    tasks: [
      "Start preparing the Earth-observation and geospatial datasets we can use for Urban Heat Equity and Atmospheric & Environmental Health.",
      "Work with Abid's NASA data and handle the geospatial preprocessing, feature extraction and spatial organisation.",
      'Produce cleaned, usable datasets and features that Harshil can directly use for ML training.',
      'Document the preprocessing steps so the workflow can be reproduced later.',
    ],
  },
  {
    name: 'Harshil',
    role: 'Machine Learning / Data Engineering',
    tasks: [
      'Start building the machine-learning pipeline now.',
      "Once Abid and Farwa have the cleaned datasets ready, use them to train and test the baseline ML models.",
      'Build the preprocessing → training → validation → evaluation → inference workflow.',
      'Keep the models and inference code modular so we can replace or adapt the model once we know the final challenge.',
      'Give the backend a clear model input/output structure it can connect to.',
    ],
  },
  {
    name: 'Zehra',
    role: 'Space Systems',
    tasks: [
      'Start preparing the space-systems side of the project.',
      "Identify and set up the tools and libraries needed for orbital calculations, coordinates, TLE/ephemeris data and trajectory-related work.",
      'Build a small working space-systems module or demo that we can reuse later.',
      'Document how the outputs are structured so they can connect to the backend if the final challenge requires it.',
    ],
  },
  {
    name: 'Jasmine',
    role: '3D / Visualization / Web',
    tasks: [
      'Start building the reusable visualisation and web shell.',
      'Prepare the map, charts and 3D visualisation structure.',
      'Use mock or sample data initially so building can start before the final datasets and ML outputs are ready.',
      "Make the components ready to receive the actual outputs from Harshil and the rest of the team.",
    ],
  },
  {
    name: 'Chaima',
    role: 'Systems / Backend / Integration',
    tasks: [
      'Continue building and organising the shared GitHub repository.',
      "Set up the backend and API structure and define the data contracts between everyone's modules.",
      "Connect Abid and Farwa's data → Harshil's ML outputs → backend → Jasmine's visualisations.",
      "Integrate Zehra's space-systems outputs where relevant.",
      'Keep the architecture, documentation and decision log updated.',
      "Make sure everyone's work plugs into the same system rather than becoming separate projects.",
    ],
  },
];

/**
 * The order work flows through the team. Chaima and Jasmine sit in the middle
 * because they are where the other four threads meet, not because their part
 * starts after everyone else's.
 */
export const WORKFLOW: readonly { who: string; detail: string }[] = [
  { who: 'Abid + Farwa', detail: 'Prepare and clean the usable data.' },
  { who: 'Harshil', detail: 'Uses that data to train and validate the ML models.' },
  {
    who: 'Chaima',
    detail: 'Connects the data, the ML and the space-systems outputs through the backend.',
  },
  {
    who: 'Jasmine',
    detail: 'Turns those outputs into maps, charts, 3D visuals and the final interface.',
  },
  {
    who: 'Zehra',
    detail: 'Provides the space-systems and orbital layer that plugs into the pipeline.',
  },
];

/** What the team wants in place before the official challenge is released. */
export const TEAM_GOAL =
  'The goal before October 28th is that we already have real data, working ML, reusable technical modules and a functioning integration structure — then, when the official challenges are released, we adapt what we have built to the actual problem.';
