/**
 * Local terrain for the site fly-in.
 *
 * Real elevation comes from the public Terrarium height tiles (SRTM / ASTER /
 * NED mosaics, served as 256 px PNGs). A handful of tiles around the site is
 * enough to build a several-kilometre patch at ~20–30 m per sample, which is
 * the right scale for reading slope, ridges and crater rims.
 *
 * The tile service is CORS-enabled, so this runs entirely in the browser. When
 * it is unreachable the caller still gets a deterministic procedural patch
 * shaped by the site's terrain family, so the view never dead-ends.
 */

import type { TerrainType } from '../data-contracts/types';

/**
 * What the patch builder needs: a position and a terrain family. Both a model
 * prediction and a researcher's reported site satisfy this, so the same terrain
 * view serves both without inventing scores for the report.
 */
export interface TerrainSite {
  id: string;
  siteName: string;
  lat: number;
  lon: number;
  terrainType?: TerrainType;
  /** Shown in the view header; the DEM supplies the patch's own elevations. */
  elevationM?: number;
  /** Only used to scale procedural relief when the DEM is unavailable. */
  factors?: { geomorphology: number };
}

const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE = 40075016.686;
const DEG = Math.PI / 180;

export type TerrainSource = 'dem' | 'procedural';

export interface TerrainPatch {
  /** Grid is size x size, row-major from north-west. */
  size: number;
  /** Metres above sea level. */
  heights: Float32Array;
  widthMeters: number;
  minElevation: number;
  maxElevation: number;
  meanSlopeDeg: number;
  source: TerrainSource;
  attribution: string;
}

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

/** Fractional tile-pixel coordinates for a lat/lon at zoom `z` (Web Mercator). */
function tilePixel(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = TILE_SIZE * 2 ** z;
  const safeLat = clamp(lat, -85.05, 85.05);
  const sin = Math.sin(safeLat * DEG);
  return {
    x: ((lon + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n,
  };
}

/** Metres per pixel on the ground at a given latitude and zoom. */
function groundMetresPerPixel(lat: number, z: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos(lat * DEG)) / (TILE_SIZE * 2 ** z);
}

/** Terrarium decoding: elevation = (R * 256 + G + B / 256) - 32768. */
function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

function summarise(
  heights: Float32Array,
  size: number,
  widthMeters: number,
): Pick<TerrainPatch, 'minElevation' | 'maxElevation' | 'meanSlopeDeg'> {
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  const step = widthMeters / (size - 1);
  let slopeSum = 0;
  let n = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const dzdx = (heights[i + 1] - heights[i - 1]) / (2 * step);
      const dzdy = (heights[i + size] - heights[i - size]) / (2 * step);
      slopeSum += Math.atan(Math.hypot(dzdx, dzdy)) / DEG;
      n++;
    }
  }
  return { minElevation: min, maxElevation: max, meanSlopeDeg: n ? slopeSum / n : 0 };
}

/**
 * Builds a 2:1-free square patch of real terrain centred on the site.
 *
 * `sizeMeters` is the ground width; `resolution` is the number of samples per
 * side (257 keeps the mesh light while still resolving ridges).
 */
async function loadDem(
  lat: number,
  lon: number,
  sizeMeters: number,
  resolution: number,
): Promise<TerrainPatch> {
  const targetMetresPerSample = sizeMeters / (resolution - 1);
  const z = clamp(
    Math.round(Math.log2((156543.03392 * Math.cos(lat * DEG)) / targetMetresPerSample)),
    10,
    14,
  );
  const mpp = groundMetresPerPixel(lat, z);
  const centre = tilePixel(lat, lon, z);
  const halfPx = sizeMeters / 2 / mpp;

  const minTileX = Math.floor((centre.x - halfPx) / TILE_SIZE);
  const maxTileX = Math.floor((centre.x + halfPx) / TILE_SIZE);
  const minTileY = Math.floor((centre.y - halfPx) / TILE_SIZE);
  const maxTileY = Math.floor((centre.y + halfPx) / TILE_SIZE);
  const cols = maxTileX - minTileX + 1;
  const rows = maxTileY - minTileY + 1;

  if (cols * rows > 9) throw new Error('terrain tile window too large');

  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');

  const tiles = await Promise.all(
    Array.from({ length: cols * rows }, async (_, index) => {
      const tx = minTileX + (index % cols);
      const ty = minTileY + Math.floor(index / cols);
      const res = await fetch(`${TERRARIUM}/${z}/${tx}/${ty}.png`, { mode: 'cors' });
      if (!res.ok) throw new Error(`terrain tile ${res.status}`);
      const bitmap = await createImageBitmap(await res.blob());
      return { bitmap, x: (tx - minTileX) * TILE_SIZE, y: (ty - minTileY) * TILE_SIZE };
    }),
  );

  for (const tile of tiles) {
    ctx.drawImage(tile.bitmap, tile.x, tile.y);
    tile.bitmap.close?.();
  }

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const originsX = centre.x - minTileX * TILE_SIZE;
  const originsY = centre.y - minTileY * TILE_SIZE;
  const stepPx = sizeMeters / (resolution - 1) / mpp;
  const half = (resolution - 1) / 2;

  const heights = new Float32Array(resolution * resolution);
  const sample = (px: number, py: number) => {
    const clampedX = clamp(px, 0, canvas.width - 1.001);
    const clampedY = clamp(py, 0, canvas.height - 1.001);
    const x0 = Math.floor(clampedX);
    const y0 = Math.floor(clampedY);
    const fx = clampedX - x0;
    const fy = clampedY - y0;
    const at = (x: number, y: number) => {
      const i = (y * canvas.width + x) * 4;
      return decodeTerrarium(pixels[i], pixels[i + 1], pixels[i + 2]);
    };
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };

  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      heights[row * resolution + col] = sample(
        originsX + (col - half) * stepPx,
        originsY + (row - half) * stepPx,
      );
    }
  }

  return {
    size: resolution,
    heights,
    widthMeters: sizeMeters,
    source: 'dem',
    attribution: 'Elevation: SRTM / ASTER mosaic via AWS Terrain Tiles',
    ...summarise(heights, resolution, sizeMeters),
  };
}

/* --------------------------------------------------------------------------
 * Procedural fallback
 * ------------------------------------------------------------------------ */

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a wrapped grid, sampled at [0,1). */
function makeValueNoise(rand: () => number, cells: number) {
  const grid = Array.from({ length: cells * cells }, rand);
  const at = (x: number, y: number) =>
    grid[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
  return (x: number, y: number) => {
    const gx = x * cells;
    const gy = y * cells;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
    const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

function buildProcedural(
  prediction: TerrainSite,
  sizeMeters: number,
  resolution: number,
): TerrainPatch {
  const rand = mulberry32(hashSeed(prediction.id + prediction.siteName));
  const base = makeValueNoise(rand, 8);
  const detail = makeValueNoise(rand, 32);
  const cracks = makeValueNoise(rand, 16);
  const type = prediction.terrainType ?? 'desert';
  // `factors` is 0–1; `featureContributions` holds weighted terms, not raw
  // features, so it must not be used as a roughness input here.
  const roughness = prediction.factors?.geomorphology ?? 0.55;
  const relief = 80 + 260 * roughness;
  const heights = new Float32Array(resolution * resolution);

  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const u = col / (resolution - 1);
      const v = row / (resolution - 1);
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      let h = (fbm(base, u * 3, v * 3) - 0.5) * relief;
      h += (fbm(detail, u * 9, v * 9, 3) - 0.5) * relief * 0.22;

      if (type === 'impact') {
        h -= Math.exp(-(r * r) / 0.16) * relief * 0.9;
        h += Math.exp(-((r - 0.34) * (r - 0.34)) / 0.012) * relief * 0.7;
      } else if (type === 'volcanic') {
        h += Math.exp(-r * r * 2.6) * relief * 1.2;
        h -= Math.abs(fbm(cracks, u * 5, v * 2)) * relief * 0.25;
      } else if (type === 'polar') {
        h *= 0.45;
        h += (cracks(u * 4, v * 4) - 0.5) * relief * 0.08;
      } else if (type === 'cave') {
        h *= 0.5;
        h -= Math.exp(-((r - 0.45) * (r - 0.45)) / 0.02) * relief * 0.5;
      } else if (type === 'fluvial') {
        const channel = Math.abs(v - 0.5 + Math.sin(u * 6.2) * 0.12);
        h -= Math.exp(-(channel * channel) / 0.004) * relief * 0.6;
      } else if (type === 'desert') {
        h += Math.sin((u * 7 + fbm(detail, u * 3, v * 3)) * Math.PI) * relief * 0.08;
      }

      heights[row * resolution + col] = h;
    }
  }

  return {
    size: resolution,
    heights,
    widthMeters: sizeMeters,
    source: 'procedural',
    attribution: 'Procedural relief from the site feature vector (no DEM)',
    ...summarise(heights, resolution, sizeMeters),
  };
}

/**
 * Real DEM where the network allows it, deterministic relief otherwise.
 * `heightExaggeration` is applied by the renderer, not here.
 */
export async function loadTerrainPatch(
  prediction: TerrainSite,
  options: { sizeMeters?: number; resolution?: number } = {},
): Promise<TerrainPatch> {
  const sizeMeters = options.sizeMeters ?? 7000;
  const resolution = options.resolution ?? 257;
  try {
    return await loadDem(prediction.lat, prediction.lon, sizeMeters, resolution);
  } catch {
    return buildProcedural(prediction, sizeMeters, resolution);
  }
}

/** Per-family surface palette used by the terrain vertex colours. */
export const TERRAIN_PALETTE: Record<
  TerrainType,
  { low: [number, number, number]; high: [number, number, number]; rock: [number, number, number] }
> = {
  desert: { low: [168, 128, 84], high: [234, 206, 160], rock: [96, 80, 62] },
  arid: { low: [142, 76, 50], high: [214, 162, 118], rock: [88, 60, 46] },
  polar: { low: [156, 176, 200], high: [255, 255, 255], rock: [74, 88, 106] },
  volcanic: { low: [30, 26, 24], high: [136, 116, 98], rock: [20, 18, 17] },
  cave: { low: [48, 40, 34], high: [152, 130, 106], rock: [28, 24, 21] },
  impact: { low: [112, 102, 88], high: [198, 188, 170], rock: [70, 64, 56] },
  fluvial: { low: [120, 50, 32], high: [206, 136, 88], rock: [78, 46, 36] },
};
