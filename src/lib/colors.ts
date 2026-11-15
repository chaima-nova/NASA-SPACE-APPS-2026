/**
 * One colour per evidence state.
 *
 * The scale used to ramp continuously from cold to warm over a composite fit, so
 * 0.53 and 0.54 were different hues while the legend beside the globe showed a
 * single band. Colour now changes only where the word changes, and there are
 * four words: the guide's four states.
 */

import type { EvidenceState } from '../data-contracts/types';
import type { FitBand } from './similarity';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const STATE_COLORS: Record<EvidenceState, string> = {
  similar: '#fbbf24',
  different: '#5b7cfa',
  insufficient_evidence: '#22d3ee',
  not_comparable: '#8b93a7',
};

export function stateColor(state: EvidenceState): string {
  return STATE_COLORS[state];
}

/** The same colour as integers, for three.js materials. */
export function stateRgb(state: EvidenceState): Rgb {
  const hex = STATE_COLORS[state].slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function stateColorHex(state: EvidenceState): string {
  return STATE_COLORS[state];
}

/* ------------------------------------------------------------ fit bands ---- */

/**
 * One colour per fit band, and a neutral for no band.
 *
 * The globe used to paint each beacon with its evidence state, so the legend
 * beside it read Similar / Different / Insufficient evidence / Not comparable.
 * Naming a beacon "Strong" asks a different question — how well the fit type
 * selected in the ranking menu reads for that site — so the palette follows the
 * band now, and the four states stay where they are stated precisely: the
 * dossier's badges, the strip's word and the comparison panel.
 *
 * Green, cyan and periwinkle, none of them the amber a researcher's report uses.
 * A reported site is a ring, not a band, and must never read as a fit.
 */
export const BAND_COLORS: Record<FitBand, string> = {
  strong: '#34d399',
  promising: '#22d3ee',
  weak: '#8b93ff',
};

/** Neutral grey for a fit with no ratio behind it at all. Never a band. */
export const NO_FIT_COLOR = '#8b93a7';

/** The colour a band is drawn in, or the neutral when there is no band. */
export function bandColor(band: FitBand | null): string {
  return band ? BAND_COLORS[band] : NO_FIT_COLOR;
}
