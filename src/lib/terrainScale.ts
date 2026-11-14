/**
 * The scales drawn beside the 3D terrain, one per overlay.
 *
 * The altitude ramp lives here rather than in the scene for one reason: it must
 * exist once. The mesh paints its vertices with `rampAt` and the scale beside it
 * is generated from the same function, so the legend cannot drift from the
 * ground it describes.
 *
 * Both scales are fitted to a single patch, which is the whole point of them. A
 * global elevation ramp and NASA's land-surface-temperature ramp each span the
 * planet, so a 7 km site lands inside a band or two and every site comes out
 * looking alike. Sizing the scale to the ground in view is what turns it from
 * decoration into a measurement.
 */

/** Low ground to summits: cold blue at the bottom, pale rock at the top. */
const ALTITUDE_RAMP: Array<[number, [number, number, number]]> = [
  [0, [26, 62, 122]],
  [0.22, [42, 132, 138]],
  [0.42, [104, 162, 88]],
  [0.62, [206, 186, 96]],
  [0.8, [190, 118, 74]],
  [1, [246, 244, 240]],
];

/**
 * Ramp colour at a level in 0..1, as three 0..1 channels.
 *
 * Vertices ask for `rampAt(pow(level, 0.85))`: the power lifts the middle of the
 * ramp so a few hundred metres of relief still separate on screen, and the
 * scale samples the identical curve.
 */
export function rampAt(value: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, value));
  for (let i = 1; i < ALTITUDE_RAMP.length; i += 1) {
    const [right, rightRgb] = ALTITUDE_RAMP[i];
    const [left, leftRgb] = ALTITUDE_RAMP[i - 1];
    if (clamped <= right) {
      const k = (clamped - left) / Math.max(1e-6, right - left);
      return [
        (leftRgb[0] + (rightRgb[0] - leftRgb[0]) * k) / 255,
        (leftRgb[1] + (rightRgb[1] - leftRgb[1]) * k) / 255,
        (leftRgb[2] + (rightRgb[2] - leftRgb[2]) * k) / 255,
      ];
    }
  }
  return [1, 1, 1];
}

const asCss = (rgb: [number, number, number]) =>
  `rgb(${rgb.map((channel) => Math.round(channel * 255)).join(' ')})`;

/**
 * The altitude scale as a CSS gradient: twelve samples of the same curve, not
 * the raw stops. A linear gradient between stops would print colours the ground
 * never shows, because the vertices apply the 0.85 power first.
 */
export function altitudeGradient(): string {
  const levels = Array.from({ length: 12 }, (_, index) => index / 11);
  const stops = levels.map(
    (level) => `${asCss(rampAt(Math.pow(level, 0.85)))} ${(level * 100).toFixed(1)}%`,
  );
  return `linear-gradient(to top, ${stops.join(', ')})`;
}

/** Highest, middle and lowest ground of the patch, in whole metres. */
export function altitudeTicks(minElevation: number, maxElevation: number): number[] {
  return [maxElevation, (minElevation + maxElevation) / 2, minElevation].map((value) =>
    Math.round(value),
  );
}

/**
 * Where a colour sits on the product's ramp, colder first: negative for the
 * violets past the blue end, low for blue, high for red.
 */
function warmth({ r, g, b }: { r: number; g: number; b: number }): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  // A grey carries no hue; park it mid-ramp, where the order cannot mislead.
  if (!span) return 120;
  let hue: number;
  if (max === r) hue = (60 * (g - b)) / span;
  else if (max === g) hue = 120 + (60 * (b - r)) / span;
  else hue = 240 + (60 * (r - g)) / span;
  if (hue < 0) hue += 360;
  return hue > 250 ? 250 - hue : 240 - hue;
}

export interface TemperatureSurface {
  /** Vertex colours in 0..1, row-major from the north-west like the patch. */
  colours: Float32Array;
  /** The bands present, coldest first, for the scale. */
  bands: string[];
}

/**
 * Read a temperature frame once and return both things the view needs from it:
 * the colours to paint on the ground's vertices, and the bands for the scale.
 *
 * The frame is baked into the ground rather than draped as a second mesh on the
 * same geometry. Two coincident surfaces fight over the depth buffer, and that
 * is what left whole slopes in terrain palette while the slope beside them
 * showed temperature. One surface cannot fight itself.
 *
 * `size` matches the terrain grid, so pixel (col, row) is vertex (row, col).
 * Pixels the product leaves transparent keep the ground's own colour: missing
 * data is a gap in the product, not a hole in the terrain.
 */
export function temperatureSurface(
  image: CanvasImageSource,
  size: number,
  fallback: Float32Array,
): TemperatureSurface {
  const empty: TemperatureSurface = { colours: fallback, bands: [] };
  try {
    const probe = document.createElement('canvas');
    probe.width = size;
    probe.height = size;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return empty;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    const colours = new Float32Array(size * size * 3);
    const bands = new Map<string, { r: number; g: number; b: number; pixels: number }>();
    let painted = 0;
    for (let i = 0; i < size * size; i += 1) {
      const at = i * 4;
      if (data[at + 3] < 40) {
        colours[i * 3] = fallback[i * 3];
        colours[i * 3 + 1] = fallback[i * 3 + 1];
        colours[i * 3 + 2] = fallback[i * 3 + 2];
        continue;
      }
      const r = data[at];
      const g = data[at + 1];
      const b = data[at + 2];
      colours[i * 3] = r / 255;
      colours[i * 3 + 1] = g / 255;
      colours[i * 3 + 2] = b / 255;
      painted += 1;
      const key = `${r >> 3}/${g >> 3}/${b >> 3}`;
      const band = bands.get(key);
      if (band) band.pixels += 1;
      else bands.set(key, { r, g, b, pixels: 1 });
    }
    if (!painted) return empty;
    return {
      colours,
      bands: [...bands.values()]
        .filter((band) => band.pixels / painted > 0.005)
        .sort((a, b) => warmth(a) - warmth(b))
        .slice(0, 12)
        .map((band) => `rgb(${band.r} ${band.g} ${band.b})`),
    };
  } catch {
    return empty;
  }
}
