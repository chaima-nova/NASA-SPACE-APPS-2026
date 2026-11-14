/**
 * Analog-site helpers shared by the ranked list, the globe and the dossier.
 *
 * The UI must never be blocked on the model: every helper here degrades to a
 * documented fallback when the optional contract fields are absent. That keeps
 * the shell working against older `Prediction` payloads from the backend.
 */

import { SCORE_BANDS } from '../data-contracts/types';
import type {
  DataSource,
  Prediction,
  ReportedSite,
  TargetSite,
  TerrainType,
} from '../data-contracts/types';
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

/** Which world the current ranking is scored against. */
export type Target = 'moon' | 'mars';

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
 * coordinate, for the same reason an unscored report gets no analog fit.
 */
export function targetSiteOf(prediction: Prediction, target: Target): TargetSite | null {
  return prediction.targetSites?.[target] ?? null;
}

/** Score used for ranking and colouring, given the active comparison target. */
export function fitFor(prediction: Prediction, target: Target): number {
  if (target === 'mars') return prediction.marsFit ?? prediction.analogScore;
  return prediction.moonFit ?? prediction.analogScore;
}

/**
 * The eight scientific dimensions the fit is scored on. The keys match the
 * brief's comparison table, so a score, its label and the parameter it stands
 * for are always the same three things.
 */
export type SiteFactors = {
  terrain: number;
  surface: number;
  thermal: number;
  water: number;
  atmosphere: number;
  biology: number;
  subsurface: number;
  exploration: number;
};

export const FACTOR_ORDER = [
  'terrain',
  'surface',
  'thermal',
  'water',
  'atmosphere',
  'biology',
  'subsurface',
  'exploration',
] as const;

export const FACTOR_LABELS: Record<keyof SiteFactors, string> = {
  terrain: 'Terrain & Topography',
  surface: 'Surface & Geology',
  thermal: 'Temperature & Environment',
  water: 'Water & Ice',
  atmosphere: 'Atmospheric Processes',
  biology: 'Biology & Habitability',
  subsurface: 'Subsurface Environments',
  exploration: 'Exploration Relevance',
};

/** The measurable parameters behind each dimension, shown in the dossier. */
export const FACTOR_HINTS: Record<keyof SiteFactors, string> = {
  terrain: 'Elevation, slope, roughness, craters and landforms',
  surface: 'Geological units, surface materials and mineralogy',
  thermal: 'Surface temperature and illumination extremes',
  water: 'Indicators of water, ice, snow and permafrost',
  atmosphere: 'Dust, wind, erosion, sedimentation and volcanism',
  biology: 'Extremophile habitats and biological limits',
  subsurface: 'Caves, lava tubes and structural pits',
  exploration: 'Fieldwork testing, robotics and mobility research',
};

/**
 * Baseline feature weights, repeated here only so an older payload's signed
 * contributions can be divided back out into the raw feature they came from.
 */
const FEATURE_WEIGHTS: Record<string, number> = {
  aridity: 0.2,
  diurnalTempSwingC: 0.16,
  regolithMatch: 0.18,
  dustIndex: 0.12,
  solarUvIndex: 0.1,
  radiationAnalog: 0.1,
  terrainRoughness: 0.06,
  isolationIndex: 0.08,
};

/**
 * Per-dimension scores for the dossier.
 *
 * Uses the model's `factors` when present. Older payloads carry only signed
 * feature contributions; those are divided by the weight the baseline model
 * applies, which recovers the raw feature, and the same eight-dimension
 * composition the fixtures use is applied on top. That is an approximation and
 * the dossier says so — but it is derived, not invented.
 */
export function factorsOf(prediction: Prediction): SiteFactors {
  if (prediction.factors) return prediction.factors;

  const contributions = prediction.featureContributions;
  const clamp = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
  const raw = (key: string) =>
    clamp(Math.abs(contributions[key] ?? 0) / (FEATURE_WEIGHTS[key] ?? 1));

  const terrain = prediction.terrainType;
  const polar = terrain === 'polar';
  const cave = terrain === 'cave';
  const volcanic = terrain === 'volcanic';
  const elevation = clamp(((prediction.elevationM ?? 0) + 100) / 4500);
  const tempSwing = raw('diurnalTempSwingC');
  const aridity = raw('aridity');
  const uv = raw('solarUvIndex');
  const radiation = raw('radiationAnalog');
  const tube = raw('lavaTubePotential');

  return {
    terrain: clamp(0.55 * raw('terrainRoughness') + 0.45 * elevation),
    surface: clamp(0.8 * raw('regolithMatch') + 0.2 * tube),
    thermal: clamp(0.5 * tempSwing + 0.3 * uv + 0.2 * radiation),
    water: clamp(0.55 * aridity + 0.45 * (polar ? 1 : cave ? 0.4 : 0.15)),
    atmosphere: clamp(0.65 * raw('dustIndex') + 0.2 * (1 - aridity) + 0.15 * (volcanic ? 1 : 0)),
    biology: clamp(0.5 * (1 - uv) + 0.3 * (1 - radiation) + 0.2 * (1 - aridity)),
    subsurface: clamp(0.8 * tube + 0.2 * (cave ? 1 : 0)),
    exploration: clamp(
      0.55 * (1 - raw('isolationIndex')) +
        0.25 * (1 - raw('terrainRoughness')) +
        0.2 * (1 - aridity),
    ),
  };
}

/** Strongest of the eight dimensions, used by the plain-language verdict. */
export function topFactor(prediction: Prediction): { key: keyof SiteFactors; value: number } {
  const factors = factorsOf(prediction);
  return FACTOR_ORDER.reduce(
    (best, key) => (factors[key] > best.value ? { key, value: factors[key] } : best),
    { key: 'surface' as keyof SiteFactors, value: -1 },
  );
}

/**
 * One-sentence answer to "should I care about this site?" — a decision, not a
 * dump of variables. Prefers a model-authored verdict when one is supplied.
 */
export function verdictOf(prediction: Prediction, target: Target): string {
  if (prediction.verdict) return prediction.verdict;

  const terrain = terrainLabel(prediction).toLowerCase();
  const { key, value } = topFactor(prediction);
  const score = fitFor(prediction, target);
  const band =
    score >= SCORE_BANDS.strong ? 'Strong' : score >= SCORE_BANDS.promising ? 'Promising' : 'Marginal';

  return `${band} ${TARGET_LABELS[target]} analog: ${terrain} terrain, strongest on ${FACTOR_LABELS[
    key
  ].toLowerCase()} (${Math.round(value * 100)}%).`;
}

/** Earth-observation datasets that actually feed this site's scores. */
export function datasetsFor(prediction: Prediction, datasets: DataSource[]): DataSource[] {
  if (prediction.datasetIds) {
    const picked = datasets.filter((d) => prediction.datasetIds?.includes(d.id));
    if (picked.length > 0) return picked;
  }

  const wantTarget: Target =
    prediction.focusArea === 'mars-base-analog'
      ? 'mars'
      : prediction.focusArea === 'moon-base-analog'
        ? 'moon'
        : 'moon';

  const earthCore = new Set(['modis-lst', 'aster-gdem', 'landsat-oli-tirs']);
  const moonIds = new Set(['lro-diviner', 'lro-mini-rf']);
  const marsIds = new Set(['mro-crism', 'mola-topography', 'msl-rems']);
  // Dual-target sites cite both target catalogues.
  const targetIds =
    prediction.focusArea === 'dual-analog'
      ? new Set([...moonIds, ...marsIds])
      : wantTarget === 'mars'
        ? marsIds
        : moonIds;

  return datasets.filter((d) => earthCore.has(d.id) || targetIds.has(d.id));
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

export function formatScore(score: number): string {
  return score.toFixed(2);
}

/**
 * The ranking as a table, best fit first. One producer for every export
 * format, so CSV, the workbook and the HTML page cannot drift apart.
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
    'moon_fit',
    'mars_fit',
    'analog_fit',
    'label',
    'confidence',
    'target',
  ];

  const ranked = [...rows].sort((a, b) => fitFor(b, target) - fitFor(a, target));

  return {
    header,
    rows: ranked.map((p, i) => [
      String(i + 1),
      p.siteName,
      p.region ?? '',
      terrainOf(p) ?? '',
      p.lat.toFixed(4),
      p.lon.toFixed(4),
      p.elevationM === undefined ? '' : String(p.elevationM),
      fitFor(p, 'moon').toFixed(3),
      fitFor(p, 'mars').toFixed(3),
      p.analogScore.toFixed(3),
      p.label,
      p.confidence.toFixed(2),
      target,
    ]),
  };
}
