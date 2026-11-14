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

/**
 * The colours a temperature frame actually puts on this ground, coldest first.
 *
 * MODIS land surface temperature ships colour-mapped: the picture carries a
 * position on NASA's ramp, not degrees, and GIBS serves no legend for it. So the
 * scale is read back off the frame the reader is looking at. Bands covering less
 * than half a percent of the ground are dropped, since one antialiased edge pixel
 * is not a band, and what survives is stretched across the whole scale — which is
 * what makes a one-patch legend more specific than the planet's.
 */
export function temperatureBands(image: CanvasImageSource): string[] {
  try {
    const probe = document.createElement('canvas');
    probe.width = 64;
    probe.height = 64;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image, 0, 0, 64, 64);
    const { data } = context.getImageData(0, 0, 64, 64);
    const bands = new Map<string, { r: number; g: number; b: number; pixels: number }>();
    let painted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) continue;
      painted += 1;
      const key = `${data[i] >> 3}/${data[i + 1] >> 3}/${data[i + 2] >> 3}`;
      const band = bands.get(key);
      if (band) band.pixels += 1;
      else bands.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], pixels: 1 });
    }
    if (!painted) return [];
    return [...bands.values()]
      .filter((band) => band.pixels / painted > 0.005)
      .sort((a, b) => warmth(a) - warmth(b))
      .slice(0, 12)
      .map((band) => `rgb(${band.r} ${band.g} ${band.b})`);
  } catch {
    return [];
  }
}
