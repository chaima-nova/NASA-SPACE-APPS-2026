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

export interface TemperatureScale {
  /** One CSS colour per band the frame carries, coldest first. */
  bands: string[];
  /** Kelvin at the cold end of the coldest band and the warm end of the warmest. */
  span: [number, number] | null;
}

export interface TemperatureSurface {
  /** Vertex colours in 0..1, row-major from the north-west like the patch. */
  colours: Float32Array;
  /** What the frame's own colours say, for the scale. */
  scale: TemperatureScale;
}

/**
 * NASA's land-surface-temperature ramp, as GIBS ships it for this very layer:
 * https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml
 * (units K, retrieved 14 November 2026).
 *
 * Copied rather than eyeballed from the picture. This is the table the WMS
 * colour-maps the frame with, and a sampled frame matched it exactly — every
 * opaque pixel landed on one of these entries, none off-ramp — so a colour read
 * off a frame maps back to a real band here instead of to a guess.
 *
 * One line per entry: rgb in hex, then the band it stands for in Kelvin, low
 * then high. Most steps are 0.6 K; the first and last entries are the catch-alls
 * either side of the ramp.
 */
const LST_RAMP = `
c900ff 0.02 200.00
c500ff 200.00 200.60
c100ff 200.60 201.20
bd00ff 201.20 201.80
b900ff 201.80 202.40
b500ff 202.40 203.00
b100ff 203.00 203.60
ad00ff 203.60 204.20
a900ff 204.20 204.80
a500ff 204.80 205.40
a100ff 205.40 206.00
9d00ff 206.00 206.60
9900ff 206.60 207.20
9500ff 207.20 207.80
9100ff 207.80 208.40
8d00ff 208.40 209.00
8900ff 209.00 209.60
8500ff 209.60 210.20
8100ff 210.20 210.80
7d00ff 210.80 211.40
7900ff 211.40 212.00
7500ff 212.00 212.60
7100ff 212.60 213.20
6d00ff 213.20 213.80
6900ff 213.80 214.40
6500ff 214.40 215.00
6100ff 215.00 215.60
5d00ff 215.60 216.20
5900ff 216.20 216.80
5500ff 216.80 217.40
5100ff 217.40 218.00
4d00ff 218.00 218.60
4900ff 218.60 219.20
4500ff 219.20 219.80
4100ff 219.80 220.40
3d00ff 220.40 221.00
3900ff 221.00 221.60
3500ff 221.60 222.20
3100ff 222.20 222.80
2d00ff 222.80 223.40
2900ff 223.40 224.00
2500ff 224.00 224.60
2100ff 224.60 225.20
1d00ff 225.20 225.80
1900ff 225.80 226.40
1500ff 226.40 227.00
1100ff 227.00 227.60
0d00ff 227.60 228.20
0900ff 228.20 228.80
0500ff 228.80 229.40
0100ff 229.40 230.00
000aff 230.00 230.60
000fff 230.60 231.20
0014ff 231.20 231.80
001aff 231.80 232.40
001fff 232.40 233.00
0024ff 233.00 233.60
0029ff 233.60 234.20
002eff 234.20 234.80
0033ff 234.80 235.40
0038ff 235.40 236.00
003dff 236.00 236.60
0042ff 236.60 237.20
0047ff 237.20 237.80
004dff 237.80 238.40
0052ff 238.40 239.00
0057ff 239.00 239.60
005cff 239.60 240.20
0061ff 240.20 240.80
0066ff 240.80 241.40
006bff 241.40 242.00
0070ff 242.00 242.60
0075ff 242.60 243.20
007aff 243.20 243.80
0080ff 243.80 244.40
0085ff 244.40 245.00
008aff 245.00 245.60
008fff 245.60 246.20
0094ff 246.20 246.80
0099ff 246.80 247.40
009eff 247.40 248.00
00a3ff 248.00 248.60
00a8ff 248.60 249.20
00adff 249.20 249.80
00b3ff 249.80 250.40
00b8ff 250.40 251.00
00bdff 251.00 251.60
00c2ff 251.60 252.20
00c7ff 252.20 252.80
00ccff 252.80 253.40
00d1ff 253.40 254.00
00d6ff 254.00 254.60
00dbff 254.60 255.20
00e0ff 255.20 255.80
00e6ff 255.80 256.40
00ebff 256.40 257.00
00f0ff 257.00 257.60
00f5ff 257.60 258.20
00faff 258.20 258.80
00ffff 258.80 259.40
04fff7 259.40 260.00
0bffe6 260.00 260.60
0fffde 260.60 261.20
12ffd5 261.20 261.80
16ffcd 261.80 262.40
1affc4 262.40 263.00
1dffbc 263.00 263.60
21ffb3 263.60 264.20
24ffab 264.20 264.80
28ffa2 264.80 265.40
2cff9a 265.40 266.00
2fff91 266.00 266.60
33ff89 266.60 267.20
37ff80 267.20 267.80
3aff78 267.80 268.40
3eff6f 268.40 269.00
42ff67 269.00 269.60
45ff5e 269.60 270.20
49ff56 270.20 270.80
4dff4d 270.80 271.40
50ff45 271.40 272.00
54ff3c 272.00 272.60
57ff34 272.60 273.20
5bff2b 273.20 273.80
5fff23 273.80 274.40
62ff1a 274.40 275.00
66ff12 275.00 275.60
6aff09 275.60 276.20
6dff01 276.20 276.80
71ff00 276.80 277.40
75ff00 277.40 278.00
78ff00 278.00 278.60
7cff00 278.60 279.20
80ff00 279.20 279.80
83ff00 279.80 280.40
87ff00 280.40 281.00
8aff00 281.00 281.60
8eff00 281.60 282.20
92ff00 282.20 282.80
95ff00 282.80 283.40
99ff00 283.40 284.00
9dff00 284.00 284.60
a0ff00 284.60 285.20
a4ff00 285.20 285.80
a8ff00 285.80 286.40
abff00 286.40 287.00
afff00 287.00 287.60
b3ff00 287.60 288.20
b6ff00 288.20 288.80
baff00 288.80 289.40
bdff00 289.40 290.00
c5ff00 290.00 290.60
c8ff00 290.60 291.20
ccff00 291.20 291.80
d0ff00 291.80 292.40
d3ff00 292.40 293.00
d7ff00 293.00 293.60
dbff00 293.60 294.20
deff00 294.20 294.80
e2ff00 294.80 295.40
e6ff00 295.40 296.00
e9ff00 296.00 296.60
edff00 296.60 297.20
f0ff00 297.20 297.80
f4ff00 297.80 298.40
f8ff00 298.40 299.00
fbff00 299.00 299.60
ffff00 299.60 300.20
fffd00 300.20 300.80
fffa00 300.80 301.40
fff700 301.40 302.00
fff400 302.00 302.60
fff100 302.60 303.20
ffee00 303.20 303.80
ffeb00 303.80 304.40
ffe800 304.40 305.00
ffe500 305.00 305.60
ffe200 305.60 306.20
ffdf00 306.20 306.80
ffdc00 306.80 307.40
ffd900 307.40 308.00
ffd600 308.00 308.60
ffd300 308.60 309.20
ffd000 309.20 309.80
ffcd00 309.80 310.40
ffca00 310.40 311.00
ffc700 311.00 311.60
ffc400 311.60 312.20
ffc100 312.20 312.80
ffbe00 312.80 313.40
ffbb00 313.40 314.00
ffb800 314.00 314.60
ffb500 314.60 315.20
ffb200 315.20 315.80
ffaf00 315.80 316.40
ffac00 316.40 317.00
ffa900 317.00 317.60
ffa600 317.60 318.20
ffa300 318.20 318.80
ffa000 318.80 319.40
ff9d00 319.40 320.00
ff9700 320.00 320.60
ff9400 320.60 321.20
ff9100 321.20 321.80
ff8e00 321.80 322.40
ff8b00 322.40 323.00
ff8800 323.00 323.60
ff8500 323.60 324.20
ff8200 324.20 324.80
ff7f00 324.80 325.40
ff7c00 325.40 326.00
ff7900 326.00 326.60
ff7600 326.60 327.20
ff7300 327.20 327.80
ff7000 327.80 328.40
ff6d00 328.40 329.00
ff6a00 329.00 329.60
ff6700 329.60 330.20
ff6400 330.20 330.80
ff6100 330.80 331.40
ff5e00 331.40 332.00
ff5b00 332.00 332.60
ff5800 332.60 333.20
ff5500 333.20 333.80
ff5200 333.80 334.40
ff4f00 334.40 335.00
ff4c00 335.00 335.60
ff4900 335.60 336.20
ff4600 336.20 336.80
ff4300 336.80 337.40
ff4000 337.40 338.00
ff3d00 338.00 338.60
ff3a00 338.60 339.20
ff3700 339.20 339.80
ff3400 339.80 340.40
ff3100 340.40 341.00
ff2e00 341.00 341.60
ff2b00 341.60 342.20
ff2800 342.20 342.80
ff2500 342.80 343.40
ff2200 343.40 344.00
ff1f00 344.00 344.60
ff1c00 344.60 345.20
ff1900 345.20 345.80
ff1600 345.80 346.40
ff1300 346.40 347.00
ff1000 347.00 347.60
ff0d00 347.60 348.20
ff0a00 348.20 348.80
ff0700 348.80 349.40
ff0400 349.40 350.00
ff0100 350.02 652.00
`;

const LST_BY_COLOUR = new Map<string, { low: number; high: number }>();
const LST_ENTRIES: Array<{ rgb: [number, number, number]; low: number; high: number }> = [];

for (const line of LST_RAMP.trim().split('\n')) {
  const [hex, low, high] = line.trim().split(/\s+/);
  const rgb: [number, number, number] = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
  const band = { low: Number(low), high: Number(high) };
  LST_ENTRIES.push({ rgb, ...band });
  LST_BY_COLOUR.set(hex, band);
}

/**
 * The Kelvin band behind a colour in a frame. Exact match first, because the WMS
 * writes the ramp's own rgb values; nearest colour after that, in case an image
 * has been through any resampling. Past a small nudge the colour is not this
 * ramp at all, and null is the honest answer rather than the nearest thing.
 */
function kelvinBand(r: number, g: number, b: number): { low: number; high: number } | null {
  const exact = LST_BY_COLOUR.get(
    [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join(''),
  );
  if (exact) return exact;
  let best: { low: number; high: number } | null = null;
  let nearest = Infinity;
  for (const entry of LST_ENTRIES) {
    const distance =
      (entry.rgb[0] - r) ** 2 + (entry.rgb[1] - g) ** 2 + (entry.rgb[2] - b) ** 2;
    if (distance < nearest) {
      nearest = distance;
      best = entry;
    }
  }
  return nearest <= 24 * 24 ? best : null;
}

/** Whole degrees Celsius, which is all a 0.6 K step can honestly support. */
export function formatTemperature(kelvin: number): string {
  return `${Math.round(kelvin - 273.15)} °C`;
}

/**
 * Three labels for the scale: warm end, middle, cold end. Empty when the frame's
 * colours could not be matched to the ramp, so the legend falls back to
 * Warmer/Cooler rather than printing a number it cannot stand behind.
 */
export function temperatureTicks(scale: TemperatureScale): string[] {
  if (!scale.span) return [];
  const [cold, warm] = scale.span;
  const ticks = [warm, (cold + warm) / 2, cold].map(formatTemperature);
  // A frame whose whole span rounds to one degree has nothing to separate:
  // three identical labels read as a broken scale, so the legend stays
  // qualitative rather than claiming a resolution it does not have.
  return new Set(ticks).size > 1 ? ticks : [];
}

/**
 * Read a temperature frame once and return both things the view needs from it:
 * the colours to paint on the ground's vertices, and what the scale should say.
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
  const empty: TemperatureSurface = { colours: fallback, scale: { bands: [], span: null } };
  try {
    const probe = document.createElement('canvas');
    probe.width = size;
    probe.height = size;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return empty;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    const colours = new Float32Array(size * size * 3);
    const bands = new Map<
      string,
      { r: number; g: number; b: number; pixels: number; kelvin: { low: number; high: number } | null }
    >();
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
      else bands.set(key, { r, g, b, pixels: 1, kelvin: kelvinBand(r, g, b) });
    }
    if (!painted) return empty;
    const kept = [...bands.values()]
      .filter((band) => band.pixels / painted > 0.005)
      .sort((a, b) => warmth(a) - warmth(b))
      .slice(0, 12);
    const coldest = kept[0]?.kelvin;
    const warmest = kept[kept.length - 1]?.kelvin;
    return {
      colours,
      scale: {
        bands: kept.map((band) => `rgb(${band.r} ${band.g} ${band.b})`),
        // Only claim a span when both ends of the scale are ramp colours.
        span: coldest && warmest ? [coldest.low, warmest.high] : null,
      },
    };
  } catch {
    return empty;
  }
}
