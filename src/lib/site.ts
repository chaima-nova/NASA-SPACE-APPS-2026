/**
 * Analog-site helpers shared by the ranked list, the globe and the dossier.
 *
 * The UI must never be blocked on the model: every helper here degrades to a
 * documented fallback when the optional contract fields are absent. That keeps
 * the shell working against older `Prediction` payloads from the backend.
 *
 * There is deliberately no `fitFor` or `formatScore` here any more. The project
 * does not publish a composite analog score (see lib/classification.ts), so the
 * helpers that produced one — the eight weighted dimensions, the band table and
 * the derived verdict — went with it.
 */

import type {
  DataSource,
  Prediction,
  ReportedSite,
  TargetSite,
  TerrainType,
} from '../data-contracts/types';
import { classifySite, classificationRank, type SiteClassification } from './classification';
import type { Table } from './export';

/**
 * The positional minimum every site-like object satisfies: a model prediction
 * or a researcher's report. Everything that only needs to place a site on the
 * globe or build a terrain patch takes this, not the full `Prediction`.
 */
export type SiteRef = {
  id: string;
  siteName: string;
  lat: number;
  lon: number;
  terrainType?: TerrainType;
  elevationM?: number;
};

export function siteRefOf(reported: ReportedSite): SiteRef {
  return {
    id: reported.id,
    siteName: reported.name,
    lat: reported.lat,
    lon: reported.lon,
    terrainType: reported.terrainType,
    elevationM: reported.elevationM,
  };
}

/** Which world the current classification is made against. */
export type Target = 'moon' | 'mars';

/**
 * The model id the SRTM screening pass writes on the rows it publishes.
 *
 * A screened row is the only candidate this project found itself: a Node pass
 * walked the committed 601x601 elevation and slope grids, measured each 16x16
 * window and published the best cells. Every other row is a place somebody
 * catalogued from the literature. The model id is the record of that difference,
 * so the interface names it instead of leaving a reader to infer it from a site
 * name that starts with "Screened cell".
 */
const SCREENING_MODEL_ID = 'screening-pass';

/** True when TerraNexus found this ground, rather than cataloguing it. */
export function foundByTerraNexus(prediction: Pick<Prediction, 'model'>): boolean {
  return prediction.model.id === SCREENING_MODEL_ID;
}

export const TERRAIN_ORDER: TerrainType[] = [
  'desert',
  'arid',
  'polar',
  'volcanic',
  'cave',
  'impact',
  'fluvial',
];

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  desert: 'Desert',
  arid: 'Arid',
  polar: 'Polar',
  volcanic: 'Volcanic',
  cave: 'Cave',
  impact: 'Impact',
  fluvial: 'Fluvial',
};

export const TARGET_LABELS: Record<Target, string> = {
  moon: 'Moon',
  mars: 'Mars',
};

/**
 * Terrain family for a site, or undefined when the payload predates the field.
 * Deliberately not defaulted to `desert`: mislabelling a site is worse than
 * admitting the classifier has not seen it yet.
 */
export function terrainOf(prediction: Pick<Prediction, 'terrainType'>): TerrainType | undefined {
  return prediction.terrainType;
}

/** Display label for the terrain facet. */
export function terrainLabel(site: Pick<Prediction, 'terrainType'>): string {
  const terrain = terrainOf(site);
  return terrain ? TERRAIN_LABELS[terrain] : 'Unclassified';
}

/**
 * Where this site lands on the chosen target body, or null when the payload
 * predates the crosswalk. Callers hide the marker rather than inventing a
 * coordinate, for the same reason an unmeasured dimension gets no verdict.
 */
export function targetSiteOf(prediction: Prediction, target: Target): TargetSite | null {
  return prediction.targetSites?.[target] ?? null;
}

/** Earth-observation datasets that actually feed this site's classification. */
export function datasetsFor(prediction: Prediction, datasets: DataSource[]): DataSource[] {
  // When the pipeline says exactly which products fed this site, that list wins:
  // it is the record of the data behind the verdict, not an approximation of it.
  if (prediction.datasetIds) {
    const picked = datasets.filter((d) => prediction.datasetIds?.includes(d.id));
    if (picked.length > 0) return picked;
  }

  /**
   * Otherwise use the catalogue's own tagging.
   *
   * Every dataset records which target(s) it serves, so a site's sources are the
   * products tagged for its focus area plus the dual-use ones that serve both
   * bodies. This replaces a hand-kept list of ids ('modis-lst', 'lro-diviner',
   * 'mola-topography', ...) that matched nothing once the catalogue was rebuilt —
   * which is why the dossier said "Sources 0" for every site while ten datasets
   * sat in the provenance card.
   */
  const tagged = datasets.filter((dataset) => {
    const areas = dataset.focusAreas ?? [];
    return areas.includes(prediction.focusArea) || areas.includes('dual-analog');
  });
  if (tagged.length > 0) return tagged;

  // An untagged catalogue still names the build's sources rather than none of
  // them; the alternative is claiming a classified site has no data behind it.
  return datasets;
}

/** `23.50°S 69.20°W` — fixed decimals so rows do not jitter while sorting. */
export function formatCoords(lat: number, lon: number): string {
  const latHem = lat >= 0 ? 'N' : 'S';
  const lonHem = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latHem} ${Math.abs(lon).toFixed(2)}°${lonHem}`;
}

/** Elevation with a thousands separator; em dash when unknown. */
export function formatElevation(elevationM: number | undefined): string {
  if (elevationM === undefined) return '—';
  const metres = Math.round(elevationM);
  return `${metres > 0 ? '+' : ''}${metres.toLocaleString('en-US')} m`;
}

/** `insufficient_evidence` -> `Insufficient evidence`, for a column or a badge. */
export function formatState(state: string): string {
  return state.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

/**
 * The classification as a table, most settled first. One producer for every
 * export format, so CSV, the workbook and the HTML page cannot drift apart.
 *
 * The columns are the guide's three dimensions and nothing that averages them:
 * a spreadsheet with a "fit" column is exactly the composite score the project
 * refuses to publish.
 */
export function siteTable(rows: Prediction[], target: Target): Table {
  const header = [
    'rank',
    'site',
    'region',
    'terrain',
    'lat',
    'lon',
    'elevation_m',
    'terrain_state',
    'geology_state',
    'thermal_state',
    'terrain_overlap',
    'target',
  ];

  const classified = rows.map((prediction) => ({
    prediction,
    classification: classifySite(prediction, target),
  }));

  classified.sort(
    (a, b) =>
      classificationRank(a.classification) - classificationRank(b.classification) ||
      a.prediction.siteName.localeCompare(b.prediction.siteName),
  );

  const stateOf = (classification: SiteClassification, id: 'terrain' | 'geology' | 'thermal') =>
    classification.dimensions.find((dimension) => dimension.id === id)?.state ?? '';

  return {
    header,
    rows: classified.map(({ prediction, classification }, index) => [
      String(index + 1),
      prediction.siteName,
      prediction.region ?? '',
      terrainOf(prediction) ?? '',
      prediction.lat.toFixed(4),
      prediction.lon.toFixed(4),
      prediction.elevationM === undefined ? '' : String(prediction.elevationM),
      stateOf(classification, 'terrain'),
      stateOf(classification, 'geology'),
      stateOf(classification, 'thermal'),
      classification.terrainOverlap === undefined
        ? ''
        : classification.terrainOverlap.toFixed(3),
      target,
    ]),
  };
}
