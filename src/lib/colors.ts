/**
 * Shared colour scale: cool (low analog fit) -> warm (high analog fit).
 * Kept in one place so map, charts and 3D stay visually consistent.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// Cold indigo (weak analog) -> cyan -> amber (strong analog). Three stops keep
// the ramp readable on the dark instrument surfaces without reading as "alarm".
const STOPS: { t: number; c: Rgb }[] = [
  { t: 0, c: { r: 99, g: 102, b: 241 } },
  { t: 0.55, c: { r: 34, g: 211, b: 238 } },
  { t: 1, c: { r: 251, g: 191, b: 36 } },
];

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const hex = (v: number) => v.toString(16).padStart(2, '0');

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreRgb(score: number): Rgb {
  const t = clamp01(score);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const local = (t - a.t) / (b.t - a.t);
      return {
        r: lerp(a.c.r, b.c.r, local),
        g: lerp(a.c.g, b.c.g, local),
        b: lerp(a.c.b, b.c.b, local),
      };
    }
  }
  return STOPS[STOPS.length - 1].c;
}

export function scoreColor(score: number): string {
  const { r, g, b } = scoreRgb(score);
  return `rgb(${r}, ${g}, ${b})`;
}

export function scoreColorHex(score: number): string {
  const { r, g, b } = scoreRgb(score);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
