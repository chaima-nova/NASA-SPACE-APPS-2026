import {
  CLASS_LABELS,
  spanOverlap,
  type DimensionEvidence,
  type DimensionId,
  type DimensionVerdict,
} from './classification';
import { measuredTerrain } from '../services/pipeline';

/**
 * One similarity percentage per dimension, with the uncertainty that belongs to
 * it — and the refusal that keeps the numbers usable.
 *
 * The guide bans a composite score, and nothing here averages the three
 * dimensions: each percentage is computed inside its own dimension, from that
 * dimension's own comparison, and no screen adds them up. "This site is a 62%
 * Mars analogue" stays a sentence this project will not say.
 *
 * Two kinds of number come out of this file:
 *
 *   measured    both sides were read — a raster span against a raster span, or a
 *               crosswalk set against another. The percentage is the same ratio
 *               that decided the verdict, so the two cannot disagree.
 *   predicted   one side has no measurement for this site. The number is then a
 *               prediction from a published envelope or a reference span, and
 *               every screen that prints it labels it "Prediction".
 *
 * Every percentage carries ± points, itemised so the dialog can show arithmetic
 * rather than assert a confidence. The terms combine in quadrature, which treats
 * them as independent errors — stated in the dialog, not implied.
 */

export type SimilarityKind = 'measured' | 'predicted' | 'incomparable';

export const SIMILARITY_KIND_LABELS: Record<SimilarityKind, string> = {
  measured: 'Measured similarity',
  predicted: 'Prediction',
  incomparable: 'Not comparable',
};

export interface UncertaintyTerm {
  /** What the term measures, in three or four words. */
  label: string;
  /** Its size in percentage points, at one decimal. */
  points: number;
  /** The arithmetic behind it, quoting the numbers it used. */
  detail: string;
}

export interface UncertaintyBudget {
  /** Combined size of every term, in percentage points. */
  total: number;
  terms: UncertaintyTerm[];
  /** The interval the percentage is reported over, clipped to 0–100. */
  low: number;
  high: number;
  /** How the terms were combined, in plain English. */
  method: string;
  /** Known biases that are declared but deliberately kept out of the number. */
  exclusions: string;
}

export interface DimensionSimilarity {
  id: DimensionId;
  label: string;
  /** Null only where the dimension admits no comparison at all. */
  percent: number | null;
  kind: SimilarityKind;
  /** What the percentage was computed from, or why there is none. */
  basis: string;
  uncertainty: UncertaintyBudget | null;
}
/* ------------------------------------------------------------ envelopes ---- */

/**
 * Surface-temperature envelopes, in kelvin, from this repository's own
 * limitation note (`docs/known_limitations.md` §4.2):
 *
 *   Earth  MODIS land surface temperature, −50…+60 °C
 *   Mars   TES/MCS equatorial diurnal, −100…+20 °C
 *   Moon   Diviner, lunar night −130 °C to equatorial midday +120 °C
 *
 * The polar exception the same note records — permanently shadowed regions at
 * −246 °C (27 K) — enters only as an uncertainty term: a PSR floor is not the
 * envelope a base site would be sited in.
 */
const THERMAL_ENVELOPE_K = {
  earth: [223.15, 333.15] as [number, number],
  mars: [173.15, 293.15] as [number, number],
  moon: [140, 393.15] as [number, number],
};

const MOON_PSR_K = 27;

/** The only Earth slope distribution this build publishes. */
const EARTH_TERRAIN = measuredTerrain.find((sample) => sample.planet === 'earth');

/* ------------------------------------------------------------- helpers ----- */

const round1 = (value: number) => Math.round(value * 10) / 10;

/** A ratio in [0, 1] as a percentage, at one decimal. */
function percentage(ratio: number): number {
  return round1(Math.max(0, Math.min(1, ratio)) * 100);
}

/**
 * A span's middle 80%.
 *
 * The guide asks for p10–p90; the published samples carry min/max only. For a
 * uniform distribution p10–p90 is exactly the middle 80% of the range, so this
 * is the substitution the payload implies — and the difference it makes to the
 * ratio is a term in the budget rather than a silent assumption.
 */
function middleEighty(span: [number, number]): [number, number] {
  const width = span[1] - span[0];
  return [span[0] + width * 0.1, span[1] - width * 0.1];
}

/** Independence assumed: the square root of the summed squares. */
function quadrature(terms: UncertaintyTerm[]): number {
  return round1(Math.sqrt(terms.reduce((sum, term) => sum + term.points * term.points, 0)));
}

function budget(args: {
  percent: number;
  terms: UncertaintyTerm[];
  method: string;
  exclusions: string;
}): UncertaintyBudget {
  const rounded = args.terms.map((term) => ({ ...term, points: round1(term.points) }));
  const total = quadrature(rounded);
  return {
    total,
    terms: rounded,
    low: Math.max(0, Math.round(args.percent - total)),
    high: Math.min(100, Math.round(args.percent + total)),
    method: args.method,
    exclusions: args.exclusions,
  };
}

const QUADRATURE_METHOD =
  'The terms are combined in quadrature — the square root of the sum of their squares — which treats each as an independent source of error. The result is the distance the percentage would move if any one input were re-measured, not a statistical confidence interval.';

const FOOTPRINT_EXCLUSION =
  'Kept out of the budget: the pixel-footprint mismatch. An Earth window at 30 m records slope that the target grid — about 0.59 km per cell — cannot resolve at all. That is a bias rather than a random error, so it is declared in the terrain caveats instead of being folded into ±.';

const NO_PRODUCT_EXCLUSION =
  'Kept out of the budget: everything no product in this build measures — thermal inertia, albedo, dust cover and seasonal phase. The ± accounts for the assumptions listed above, not for physics nobody ingested.';

function evidenceBasis(evidence: DimensionEvidence): string {
  return `Candidate: ${evidence.candidateSource}. Compared against: ${evidence.targetSource}.`;
}

/* -------------------------------------------------------------- terrain ---- */

function terrainSimilarity(
  verdict: DimensionVerdict,
  evidence: Extract<DimensionEvidence, { method: 'span_overlap' }>,
): DimensionSimilarity {
  const [cLo, cHi] = evidence.candidate;
  const [tLo, tHi] = evidence.target;
  const percent = percentage(evidence.overlap ?? spanOverlap(cLo, cHi, tLo, tHi));
  const unionWidth = Math.max(cHi, tHi) - Math.min(cLo, tLo);
  const predicted = evidence.candidateIsReference || verdict.state === 'insufficient_evidence';

  const [ncLo, ncHi] = middleEighty(evidence.candidate);
  const [ntLo, ntHi] = middleEighty(evidence.target);
  const narrowed = percentage(spanOverlap(ncLo, ncHi, ntLo, ntHi));
  const shape = Math.abs(percent - narrowed);

  if (!predicted) {
    const rounding = unionWidth > 0 ? (100 * evidence.resolution) / unionWidth : 0;
    return {
      id: verdict.id,
      label: verdict.label,
      percent,
      kind: 'measured',
      basis: evidenceBasis(evidence),
      uncertainty: budget({
        percent,
        method: QUADRATURE_METHOD,
        exclusions: FOOTPRINT_EXCLUSION,
        terms: [
          {
            label: 'Endpoint resolution',
            points: rounding,
            detail: `Both slope spans are published to ${evidence.resolution}°, so either endpoint can sit that far from the true edge of its distribution. Across a ${unionWidth.toFixed(1)}° union that is ±${round1(rounding)} points.`,
          },
          {
            label: 'Span shape',
            points: shape,
            detail: `The ratio uses min–max spans because p10–p90 are not published for both sides. Narrowing each span to its middle 80% — the p10–p90 of a uniform distribution — moves the ratio from ${percent}% to ${narrowed}%, so the substitution alone is worth ±${round1(shape)} points.`,
          },
        ],
      }),
    };
  }

  const prior = EARTH_TERRAIN
    ? { span: [0, EARTH_TERRAIN.slopeMaxDeg] as [number, number], mean: EARTH_TERRAIN.slopeMeanDeg }
    : null;
  const flat = prior ? percentage(spanOverlap(prior.span[0], prior.mean, tLo, tHi)) : percent;
  const substitution = Math.abs(percent - flat) / 2;

  return {
    id: verdict.id,
    label: verdict.label,
    percent,
    kind: 'predicted',
    basis: prior
      ? `Prediction: no slope window was measured for this site, so the Earth side is the published ${EARTH_TERRAIN?.region} sample (0–${prior.span[1]}°) rather than this ground. Compared against: ${evidence.targetSource}.`
      : evidenceBasis(evidence),
    uncertainty: budget({
      percent,
      method: QUADRATURE_METHOD,
      exclusions: FOOTPRINT_EXCLUSION,
      terms: [
        {
          label: 'Reference span substituted',
          points: substitution,
          detail: prior
            ? `The Earth side is the ${EARTH_TERRAIN?.region} sample, not this site. Using its mean slope (${prior.mean}°) instead of its steepest cell (${prior.span[1]}°) moves the overlap to ${flat}%; half that swing is the price of standing one region in for another.`
            : 'No Earth reference span is published, so the substitution cannot be quantified.',
        },
        {
          label: 'No site measurement',
          points: 10,
          detail:
            'No slope distribution was read for this site at all. A prediction is never allowed to claim better than ±10 points for that absence on its own.',
        },
      ],
    }),
  };
}
/* ------------------------------------------------------------- geology ---- */

function geologySimilarity(
  verdict: DimensionVerdict,
  evidence: Extract<DimensionEvidence, { method: 'class_sets' }>,
): DimensionSimilarity {
  const { union, shared, provisional } = evidence;
  const percent = percentage(union.length > 0 ? shared.length / union.length : 0);
  const granularity = union.length > 0 ? 100 / union.length : 100;
  const names = union.map((id) => (CLASS_LABELS[id] ?? id).toLowerCase()).join(', ');

  const terms: UncertaintyTerm[] = [
    {
      label: 'Class granularity',
      points: granularity,
      detail: `Both sides are sets over the six-class USGS crosswalk, and this pair spans ${union.length} classes (${names}). One class either way is worth ±${round1(granularity)} points, which is all a set comparison over ${union.length} classes can resolve.`,
    },
  ];

  if (provisional) {
    terms.push({
      label: 'Provisional site class',
      points: granularity,
      detail: `This site has no hand-registered map unit yet, so its class is inferred from the catalogued terrain family. Treating that inference as one further class of doubt adds the same ±${round1(granularity)} points again.`,
    });
  }

  return {
    id: verdict.id,
    label: verdict.label,
    percent,
    kind: provisional ? 'predicted' : 'measured',
    basis: evidenceBasis(evidence),
    uncertainty: budget({
      percent,
      method: QUADRATURE_METHOD,
      exclusions:
        'Kept out of the budget: rock abundance, mineralogy and weathering. They are not in the crosswalk classes compared here, and no spectral product in this build measures them.',
      terms,
    }),
  };
}

/* ------------------------------------------------------------- thermal ---- */

function thermalSimilarity(verdict: DimensionVerdict, target: 'moon' | 'mars'): DimensionSimilarity {
  const candidate = THERMAL_ENVELOPE_K.earth;
  const envelope = target === 'moon' ? THERMAL_ENVELOPE_K.moon : THERMAL_ENVELOPE_K.mars;
  const percent = percentage(spanOverlap(candidate[0], candidate[1], envelope[0], envelope[1]));

  const [ncLo, ncHi] = middleEighty(candidate);
  const [ntLo, ntHi] = middleEighty(envelope);
  const narrowed = percentage(spanOverlap(ncLo, ncHi, ntLo, ntHi));
  const bodyWide = Math.abs(percent - narrowed);

  const psr = target === 'moon'
    ? Math.abs(percent - percentage(spanOverlap(candidate[0], candidate[1], MOON_PSR_K, envelope[1])))
    : 0;

  const terms: UncertaintyTerm[] = [
    {
      label: 'Body-wide envelope',
      points: bodyWide,
      detail: `The Earth side is MODIS land surface temperature over all land (−50…+60 °C), not this site's own range. Narrowing both envelopes to their middle 80% moves the overlap from ${percent}% to ${narrowed}%, so a body-wide envelope is worth ±${round1(bodyWide)} points.`,
    },
    {
      label: 'No thermal product',
      points: 12,
      detail:
        'No site-level thermal product exists in this build: Diviner and TES inertia are both uningested. A prediction made without either is never allowed to claim better than ±12 points for that absence.',
    },
  ];

  if (psr > 0) {
    terms.push({
      label: 'Polar cold traps',
      points: psr,
      detail: `The lunar envelope runs from night (−130 °C) to equatorial midday (+120 °C). Permanently shadowed ground reaches −246 °C (27 K); including that floor moves the overlap to ${percentage(spanOverlap(candidate[0], candidate[1], MOON_PSR_K, envelope[1]))}%, which is ±${round1(psr)} points of spread this prediction is not modelling.`,
    });
  }

  return {
    id: verdict.id,
    label: verdict.label,
    percent,
    kind: 'predicted',
    basis: `Prediction from published envelopes, not from this site: Earth −50…+60 °C (MODIS) against ${
      target === 'moon'
        ? 'lunar night to equatorial midday, −130…+120 °C (Diviner)'
        : 'Jezero’s equatorial diurnal range, −100…+20 °C (TES/MCS)'
    }. No thermal product is ingested for this site, so the number is a body-level prediction.`,
    uncertainty: budget({
      percent,
      method: QUADRATURE_METHOD,
      exclusions: NO_PRODUCT_EXCLUSION,
      terms,
    }),
  };
}

/* ---------------------------------------------------------------- entry ---- */

/**
 * The percentage and its budget for one dimension.
 *
 * Pure: it reads the verdict's own evidence, so a percentage can never be shown
 * for a comparison the verdict did not make.
 */
export function similarityFor(
  verdict: DimensionVerdict,
  target: 'moon' | 'mars',
): DimensionSimilarity {
  if (verdict.state === 'not_comparable') {
    return {
      id: verdict.id,
      label: verdict.label,
      percent: null,
      kind: 'incomparable',
      basis:
        'This dimension is not comparable by definition — the difference is one of kind, not degree — so no percentage is offered for it.',
      uncertainty: null,
    };
  }

  if (verdict.id === 'thermal') return thermalSimilarity(verdict, target);

  const evidence = verdict.evidence;
  if (!evidence) {
    return {
      id: verdict.id,
      label: verdict.label,
      percent: null,
      kind: 'incomparable',
      basis: 'No comparison was possible for this dimension, so no percentage is offered.',
      uncertainty: null,
    };
  }

  return evidence.method === 'span_overlap'
    ? terrainSimilarity(verdict, evidence)
    : geologySimilarity(verdict, evidence);
}
