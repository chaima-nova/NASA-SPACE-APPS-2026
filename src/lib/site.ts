/**
 * Analog-site helpers shared by the ranked list, the globe and the dossier.
 *
 * The UI must never be blocked on the model: every helper here degrades to a
 * documented fallback when the optional contract fields are absent. That keeps
 * the shell working against older `Prediction` payloads from the backend.
 */

import type { DataSource, Prediction, ReportedSite, TerrainType } from '../data-contracts/types';

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

/** Score used for ranking and colouring, given the active comparison target. */
export function fitFor(prediction: Prediction, target: Target): number {
  if (target === 'mars') return prediction.marsFit ?? prediction.analogScore;
  return prediction.moonFit ?? prediction.analogScore;
}

export type SiteFactors = {
  geomorphology: number;
  mineralogy: number;
  environment: number;
  logistics: number;
};

export const FACTOR_ORDER = [
  'geomorphology',
  'mineralogy',
  'environment',
  'logistics',
] as const;

export const FACTOR_LABELS: Record<keyof SiteFactors, string> = {
  geomorphology: 'Geomorphology',
  mineralogy: 'Mineralogy',
  environment: 'Environment',
  logistics: 'Logistics',
};

/** What each pillar actually measures, shown on hover in the dossier. */
export const FACTOR_HINTS: Record<keyof SiteFactors, string> = {
  geomorphology: 'Surface slope, roughness and crater density',
  mineralogy: 'Sulfates, iron oxides and regolith match',
  environment: 'UV index, aridity, dust and thermal swing',
  logistics: 'Access to roads, power and resupply',
};

/**
 * Per-axis scores for the dossier.
 *
 * Uses the model's `factors` when present. Otherwise it groups the raw feature
 * contributions under the brief's four characterization axes and normalizes each
 * group by the largest value it could take (the feature weights in mock.ts).
 */
export function factorsOf(prediction: Prediction): SiteFactors {
  if (prediction.factors) return prediction.factors;

  const c = prediction.featureContributions;
  const get = (key: string) => Math.abs(c[key] ?? 0);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  // Axis ceilings: sum of the weights that feed each group.
  return {
    geomorphology: clamp(get('terrainRoughness') / 0.06),
    mineralogy: clamp(get('regolithMatch') / 0.18),
    environment: clamp(
      (get('aridity') +
        get('diurnalTempSwingC') +
        get('dustIndex') +
        get('solarUvIndex') +
        get('radiationAnalog')) /
        0.56,
    ),
    // Isolation is the inverse of accessibility: remote sites are harder to
    // resupply, so a high isolation contribution lowers the logistics score.
    logistics: clamp(1 - get('isolationIndex') / 0.08),
  };
}

/** Strongest of the four axes, used by the plain-language verdict. */
export function topFactor(prediction: Prediction): { key: keyof SiteFactors; value: number } {
  const factors = factorsOf(prediction);
  return FACTOR_ORDER.reduce(
    (best, key) => (factors[key] > best.value ? { key, value: factors[key] } : best),
    { key: 'mineralogy' as keyof SiteFactors, value: -1 },
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
  const band = score > 0.72 ? 'Strong' : score > 0.55 ? 'Promising' : 'Marginal';

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

/** RFC-4180-ish CSV: quote every field, double any embedded quote. */
export function toCsv(rows: Prediction[], target: Target): string {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
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

  const lines = ranked.map((p, i) =>
    [
      i + 1,
      p.siteName,
      p.region ?? '',
      terrainOf(p) ?? '',
      p.lat.toFixed(4),
      p.lon.toFixed(4),
      p.elevationM ?? '',
      fitFor(p, 'moon').toFixed(3),
      fitFor(p, 'mars').toFixed(3),
      p.analogScore.toFixed(3),
      p.label,
      p.confidence.toFixed(2),
      target,
    ]
      .map(cell)
      .join(','),
  );

  return [header.map(cell).join(','), ...lines].join('\r\n');
}
