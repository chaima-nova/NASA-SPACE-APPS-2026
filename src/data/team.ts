/**
 * Who built this, in one place.
 *
 * The page reads this list and nothing else, so correcting a name, a role or the
 * order is a one-line edit here rather than a hunt through the component. The
 * entries are the people this repository actually names — the README credits
 * Jasmine with the interface and Chaima with the backend — rather than invented
 * placeholders, because a team page is the one page a reader can check.
 */

export interface TeamMember {
  name: string;
  role: string;
  /** What they actually built, in one sentence. */
  detail: string;
  /** Short, honest labels. Not a skill dump. */
  tags: string[];
}

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Jasmine',
    role: 'Interface & visualisation',
    detail:
      'Built the workbench: the ranked list, the 3D globe, the site dossier, the evidence panels and the accessibility modes.',
    tags: ['React', 'three.js', 'Interaction', 'Accessibility'],
  },
  {
    name: 'Chaima',
    role: 'Backend & data',
    detail:
      'Built the API and data layer the workbench reads from, including the community records behind the reported sites.',
    tags: ['API', 'NASA datasets', 'Data model'],
  },
];
