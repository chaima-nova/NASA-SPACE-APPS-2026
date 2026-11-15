/**
 * One colour per evidence state.
 *
 * The scale used to ramp continuously from cold to warm over a composite fit, so
 * 0.53 and 0.54 were different hues while the legend beside the globe showed a
 * single band. Colour now changes only where the word changes, and there are
 * four words: the guide's four states.
 */

import type { EvidenceState } from '../data-contracts/types';

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
