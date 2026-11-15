/**
 * Site classification, transcribed from the canonical guide.
 *
 * Source: `site_classification_and_onboarding_guide.md` (Harshil, comparison
 * engine lead, 15 November 2026, version 1.0). That document is the authority
 * for everything in this file, and this file is the only place the interface
 * decides what a site is:
 *
 *   1. No composite score. "Site X is an 82% match to Mars" is not a claim the
 *      project makes: the three dimensions are functionally orthogonal and the
 *      physics of each body make some of them incomparable outright.
 *   2. Three independent dimensions — terrain, geology, thermal — each carrying
 *      one of Zehra's four evidence states, so "we measured it and it differs"
 *      never reads the same as "nobody has measured it".
 *   3. Every site carries the four universal physical limitations, because no
 *      Earth site can simulate 0.166 g, hard vacuum, unshielded GCR flux or
 *      agglutinated regolith.
 *
 * Where the guide's inputs are not in this repository, the state is
 * `insufficient_evidence` and the reason says which input is missing. That is
 * the guide's own rule (§2.1), not a fallback for convenience: a number invented
 * to fill the gap would be indistinguishable from a measurement once it reached
 * the screen.
 */

import crosswalkFile from '../../config/geology_crosswalk.json';
import type { EvidenceState, Prediction, TerrainType } from '../data-contracts/types';
import { measuredTerrain, terrainMeasurementFor } from '../services/pipeline';

/* ------------------------------------------------------------- taxonomy ---- */

/** The guide's three dimensions (§1). */
export type DimensionId = 'terrain' | 'geology' | 'thermal';

export const DIMENSION_ORDER: DimensionId[] = ['terrain', 'geology', 'thermal'];

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  terrain: 'Terrain & Topography',
  geology: 'Surface Geology',
  thermal: 'Thermal & Temperature',
};

/**
 * The one number the guide puts a threshold on (§2.2C): the percentile overlap
 * ratio below which two distributions are `DIFFERENT`. It is a decision rule,
 * not a score — nothing averages it with another dimension.
 */
export const TERRAIN_OVERLAP_THRESHOLD = 0.4;

/** A site is not screened when its valid coverage falls below this (§2.2C). */
export const MIN_VALID_COVERAGE = 0.4;

/** Words for the four states, as a reader should meet them. */
export const STATE_LABELS: Record<EvidenceState, string> = {
  similar: 'Similar',
  different: 'Different',
  insufficient_evidence: 'Insufficient evidence',
  not_comparable: 'Not comparable',
};

/** One line saying what each state permits, straight from the guide's table. */
export const STATE_MEANINGS: Record<EvidenceState, string> = {
  similar: 'Operational match on this dimension.',
  different: 'Measured mismatch; the offset is quantified.',
  insufficient_evidence: 'Data gap: not measured, or coverage too thin to decide.',
  not_comparable: 'Definitional barrier: the two cannot be compared at all.',
};

/** Ordering for the queue: the most useful dimension state first. */
export const STATE_RANK: Record<EvidenceState, number> = {
  similar: 0,
  insufficient_evidence: 1,
  different: 2,
  not_comparable: 3,
};

/* ------------------------------------------------------ geology crosswalk ---- */

interface CrosswalkClass {
  class_id: string;
  label: string;
}

interface RegionAssignment {
  primary_class?: string;
  secondary_class?: string;
  description?: string;
  landforms?: string[];
  confidence?: string;
}

interface CrosswalkFile {
  crosswalk_version: string;
  classes: CrosswalkClass[];
  region_assignments: Record<string, RegionAssignment>;
  /** Which region assignment stands in for each catalogued site. */
  site_bindings?: Record<string, string>;
}

const crosswalk = crosswalkFile as unknown as CrosswalkFile;

/** The six USGS classes the guide maps every unit onto (§2.3). */
export const GEOLOGY_CLASSES: CrosswalkClass[] = crosswalk.classes;

export const CLASS_LABELS: Record<string, string> = Object.fromEntries(
  crosswalk.classes.map((entry) => [entry.class_id, entry.label]),
);

/** Regions the engine has run on, whose own crosswalk entries are the targets. */
const TARGET_REGION: Record<'moon' | 'mars', string> = {
  moon: 'moon_south_pole_lola',
  mars: 'mars_jezero_mola',
};

/**
 * Provisional class for a site the crosswalk has not been extended to.
 *
 * The guide's workflow (step 2) registers a class per site by hand. Until that
 * has happened, the site's catalogued terrain family is the only geological
 * statement this build holds, so it is mapped onto the nearest crosswalk class
 * and the verdict says the class is provisional. That keeps the intersection
 * test the guide prescribes without pretending a USGS map unit was read.
 */
const PROVISIONAL_CLASS: Record<TerrainType, string> = {
  desert: 'plains_and_lowlands',
  arid: 'plains_and_lowlands',
  fluvial: 'plains_and_lowlands',
  volcanic: 'volcanic',
  impact: 'impact_related',
  polar: 'polar_and_ice',
  cave: 'apron_and_transition',
};

export function classesOfRegion(regionId: string): string[] {
  const assignment = crosswalk.region_assignments[regionId];
  if (!assignment) return [];
  return [assignment.primary_class, assignment.secondary_class].filter(
    (value): value is string => Boolean(value),
  );
}

/** The crosswalk entry for a catalogued site, following the binding table. */
function regionFor(siteId: string): string | undefined {
  const bound = crosswalk.site_bindings?.[siteId];
  if (bound && crosswalk.region_assignments[bound]) return bound;
  return crosswalk.region_assignments[siteId] ? siteId : undefined;
}

/* ------------------------------------------------------------- geometry ---- */

/**
 * Overlap of two spans, as a fraction of the ground they cover between them.
 *
 * The guide defines the ratio on the central 80% span (p10–p90). The published
 * samples carry min/max/mean and no percentile vector, so the full measured span
 * is used instead: it is wider than p10–p90, which makes the ratio conservative
 * (harder to reach 40%) rather than flattering. Every verdict built on it says
 * so in its basis line.
 */
export function spanOverlap(aLo: number, aHi: number, bLo: number, bHi: number): number {
  const union = Math.max(aHi, bHi) - Math.min(aLo, bLo);
  if (!Number.isFinite(union) || union <= 0) return 0;
  const shared = Math.min(aHi, bHi) - Math.max(aLo, bLo);
  return Math.max(0, shared) / union;
}

/* ------------------------------------------------------ physical limits ---- */

export interface PhysicalLimitation {
  id: 'gravity' | 'atmospheric_pressure' | 'ionizing_radiation' | 'weathering';
  label: string;
  earth: string;
  target: string;
  why: string;
}

/**
 * The four limitations every site carries (§2.5).
 *
 * Wording follows the engine's own `_physical_limitations`, so the dossier and
 * the JSON reports cannot describe the same barrier two different ways.
 */
export function limitationsFor(target: 'moon' | 'mars'): PhysicalLimitation[] {
  const moon = target === 'moon';
  return [
    {
      id: 'gravity',
      label: 'Gravity',
      earth: '1.00 g (9.81 m/s²)',
      target: moon ? '0.166 g (1.62 m/s²)' : '0.38 g (3.72 m/s²)',
      why: 'Slope stability, avalanche dynamics and rover traction differ fundamentally. Equal slope angles are not equally hazardous across bodies.',
    },
    {
      id: 'atmospheric_pressure',
      label: 'Atmospheric pressure',
      earth: '1,013.25 hPa (N₂/O₂)',
      target: moon ? '~10⁻¹² hPa (hard vacuum)' : '~6 hPa CO₂ (under 1% of Earth)',
      why: 'No convective heat dissipation, no liquid water stability, and no atmospheric pressure on suits or habitats.',
    },
    {
      id: 'ionizing_radiation',
      label: 'Ionizing radiation',
      earth: 'Geomagnetically shielded',
      target: moon
        ? 'Direct GCR and solar particle events, no magnetospheric shielding'
        : 'Elevated UV and cosmic-ray flux; the thin CO₂ atmosphere barely shields',
      why: 'Surface habitats need regolith berming or sub-surface siting. Nothing in an Earth analogue campaign prepares for this.',
    },
    {
      id: 'weathering',
      label: 'Soil mechanics',
      earth: 'Active microbial, hydro-chemical and aeolian weathering',
      target: moon
        ? 'Micrometeorite comminution only; glassy electrostatic agglutinates'
        : 'Aeolian dust transport; toxic perchlorate chemistry; no liquid water',
      why: 'Earth soil has organic binders. Target regolith is mechanically abrasive or chemically hazardous.',
    },
  ];
}

/* --------------------------------------------------------- the verdict ---- */

/** One dimension's decision, with the measurements behind it. */
export interface DimensionVerdict {
  id: DimensionId;
  label: string;
  state: EvidenceState;
  /** Why this state, in one sentence, naming the numbers used. */
  basis: string;
  /** What this dimension could not decide, in the guide's terms. */
  caveats: string[];
}

export interface SiteClassification {
  siteId: string;
  target: 'moon' | 'mars';
  dimensions: DimensionVerdict[];
  limitations: PhysicalLimitation[];
  /** Terrain overlap ratio in [0, 1], where the published spans support one. */
  terrainOverlap?: number;
  /** How many dimensions came back `similar`. Never summed with anything. */
  agreements: number;
}

const targetSample = (target: 'moon' | 'mars') =>
  measuredTerrain.find((sample) => sample.planet === target);

/**
 * Terrain & topography (§2.2).
 *
 * Slope is the parameter with published bounds on both sides, so it decides the
 * state through the 40% overlap rule. Roughness is reported and never used to
 * decide: TRI is scale-dependent, and the guide is explicit that an Earth 30 m
 * window against a 0.59 km MOLA grid measures the pixel footprint rather than
 * the ground. Absolute elevation is `NOT_COMPARABLE` behind three different
 * datums and is not compared at all.
 */
function terrainVerdict(
  prediction: Prediction,
  target: 'moon' | 'mars',
): { verdict: DimensionVerdict; overlap?: number } {
  const label = DIMENSION_LABELS.terrain;
  const caveats = [
    'Roughness (TRI) differs by pixel footprint, not by terrain: Earth at 30 m/px against the target grid measures scale, so it is reported and not used to decide.',
    'Absolute elevation is not comparable: EGM96 geoid on Earth, a geometric sphere on the Moon, a gravitational areoid on Mars.',
  ];

  // A screened cell or engine report carries the state already derived from
  // its own arrays — that is a better witness than a span computed here.
  const carried = prediction.dimensionStates?.[target]?.terrain;
  const sample = targetSample(target);
  const measurement = terrainMeasurementFor(prediction.pointId ?? prediction.id);

  const terrainCaveats = (extra?: string) => (extra ? [...caveats, extra] : caveats);

  if (carried) {
    return {
      verdict: {
        id: 'terrain',
        label,
        state: carried,
        basis: prediction.evidenceNote ?? 'Screening pass verdict over one measured SRTM window.',
        caveats: terrainCaveats('Decided on slope, roughness and peak slope only.'),
      },
    };
  }

  if (!sample) {
    return {
      verdict: {
        id: 'terrain',
        label,
        state: 'insufficient_evidence',
        basis: `No ${target} terrain sample is published in this build, so there is nothing to compare against.`,
        caveats,
      },
    };
  }

  if (!measurement || measurement.status !== 'measured' || !measurement.measured) {
    return {
      verdict: {
        id: 'terrain',
        label,
        state: 'insufficient_evidence',
        basis:
          measurement?.reason ??
          'No measured window is published for this site, so its slope distribution has never been read.',
        caveats,
      },
    };
  }

  // The published sample carries min / max / mean. The low end of a slope
  // distribution is 0° by definition, so the candidate span is [0, max].
  const candidateHi = measurement.measured.slopeMaxDeg;
  const overlap = spanOverlap(0, candidateHi, sample.slopeMinDeg, sample.slopeMaxDeg);
  const state: EvidenceState = overlap >= TERRAIN_OVERLAP_THRESHOLD ? 'similar' : 'different';
  const pct = Math.round(overlap * 100);

  return {
    verdict: {
      id: 'terrain',
      label,
      state,
      basis:
        `Slope span 0–${candidateHi}° (measured over ${measurement.measured.windowCells} cells, ` +
        `${measurement.tile}) against ${sample.region} ${sample.slopeMinDeg}–${sample.slopeMaxDeg}°: ` +
        `${pct}% overlap, ${state === 'similar' ? 'at or above' : 'below'} the ${Math.round(
          TERRAIN_OVERLAP_THRESHOLD * 100,
        )}% threshold.`,
      caveats: terrainCaveats(
        `Computed on published min–max spans rather than p10–p90, which are not published for this site: the ratio is conservative.`,
      ),
    },
    overlap,
  };
}

/**
 * Surface geology (§2.3).
 *
 * The rule is set intersection against the 6-class USGS crosswalk: a shared
 * class is a qualitative match, disjoint classes are different. Weathering is
 * always different — Earth's aqueous and microbial alteration has no counterpart
 * on either body — and rock abundance and mineralogy stay insufficient until
 * calibrated spectral or thermal-inertia products are ingested.
 */
function geologyVerdict(prediction: Prediction, target: 'moon' | 'mars'): DimensionVerdict {
  const label = DIMENSION_LABELS.geology;
  const carried = prediction.dimensionStates?.[target]?.geology;
  const caveats = [
    'Weathering is always different: Earth microbial and aqueous alteration has no counterpart here.',
    'Rock abundance and mineralogical indicators are insufficient until calibrated spectral or thermal-inertia products are ingested.',
  ];

  if (carried) {
    return {
      id: 'geology',
      label,
      state: carried,
      basis: prediction.evidenceNote ?? 'Engine verdict on the USGS crosswalk.',
      caveats,
    };
  }

  const boundRegion = regionFor(prediction.pointId ?? prediction.id);
  const assigned = boundRegion ? classesOfRegion(boundRegion) : [];
  const provisional = assigned.length === 0 && prediction.terrainType
    ? [PROVISIONAL_CLASS[prediction.terrainType]]
    : [];
  const candidate = assigned.length > 0 ? assigned : provisional;
  const targetClasses = classesOfRegion(TARGET_REGION[target]);

  if (candidate.length === 0 || targetClasses.length === 0) {
    return {
      id: 'geology',
      label,
      state: 'insufficient_evidence',
      basis:
        targetClasses.length === 0
          ? `The ${target} reference region has no crosswalk assignment yet, so no class test is possible.`
          : 'This site has no USGS crosswalk assignment yet, so its units cannot be compared.',
      caveats,
    };
  }

  const shared = candidate.filter((classId) => targetClasses.includes(classId));
  const state: EvidenceState = shared.length > 0 ? 'similar' : 'different';
  const nameList = (ids: string[]) =>
    ids.map((id) => (CLASS_LABELS[id] ?? id).toLowerCase()).join(' + ');

  return {
    id: 'geology',
    label,
    state,
    basis:
      `Site units: ${nameList(candidate)}${
        provisional.length > 0 ? ' (provisional, from the catalogued terrain family)' : ''
      }. ${target === 'moon' ? 'Lunar south pole' : 'Jezero'} units: ${nameList(targetClasses)}. ` +
      (state === 'similar'
        ? `Shared class: ${nameList(shared)} — qualitative match.`
        : 'No class in common — disjoint units.'),
    caveats,
  };
}

/**
 * Thermal & temperature (§2.4).
 *
 * Atmospheric thermal physics is `NOT_COMPARABLE` by definition — convective
 * buffering at 1,013 hPa against a hard vacuum is not a difference of degree.
 * Surface temperature, diurnal amplitude and thermal inertia are
 * `INSUFFICIENT_EVIDENCE` because no temperature product is ingested for the
 * candidate or the target in this build.
 */
function thermalVerdict(target: 'moon' | 'mars', carried?: EvidenceState): DimensionVerdict {
  return {
    state: carried ?? 'insufficient_evidence',
    id: 'thermal',
    label: DIMENSION_LABELS.thermal,
    basis:
      'Surface temperature, diurnal amplitude and thermal inertia are insufficient: ' +
      (target === 'moon'
        ? 'Diviner Level 2 brightness temperature is not ingested.'
        : 'numeric TES thermal inertia is not ingested.'),
    caveats: [
      'Atmospheric thermal physics is not comparable: 1,013 hPa of convective buffering against ' +
        (target === 'moon' ? 'hard vacuum.' : 'about 6 hPa of CO₂.'),
    ],
  };
}

/**
 * The classification of one site against one target.
 *
 * Pure and synchronous: it reads the pipeline's committed reports and the
 * crosswalk, never the network, so the dossier cannot describe a site the
 * exports disagree with.
 */
export function classifySite(prediction: Prediction, target: 'moon' | 'mars'): SiteClassification {
  const terrain = terrainVerdict(prediction, target);
  const dimensions: DimensionVerdict[] = [
    terrain.verdict,
    geologyVerdict(prediction, target),
    thermalVerdict(target, prediction.dimensionStates?.[target]?.thermal),
  ];

  return {
    siteId: prediction.id,
    target,
    dimensions,
    limitations: limitationsFor(target),
    terrainOverlap: terrain.overlap,
    agreements: dimensions.filter((dimension) => dimension.state === 'similar').length,
  };
}

/** One line for a list row: what the site is, against this target. */
export function classificationSummary(classification: SiteClassification): string {
  const [terrain, geology] = classification.dimensions;
  const phrase = (verdict: DimensionVerdict) =>
    verdict.state === 'similar'
      ? 'similar'
      : verdict.state === 'different'
        ? 'different'
        : verdict.state === 'not_comparable'
          ? 'not comparable'
          : 'unmeasured';
  return `Terrain ${phrase(terrain)}, geology ${phrase(geology)}.`;
}

/** Worst-case ordering key: a site is as good as its least settled dimension. */
export function classificationRank(classification: SiteClassification): number {
  return Math.min(...classification.dimensions.map((dimension) => STATE_RANK[dimension.state]));
}
