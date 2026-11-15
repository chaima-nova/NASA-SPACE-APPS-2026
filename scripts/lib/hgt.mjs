/**
 * Reading and measuring SRTM height tiles.
 *
 * Two scripts in this repository now work from raw SRTM: `measure_sites.mjs`,
 * which measures the curated candidate sites, and `screen_analogues.mjs`, which
 * scans whole tiles for cells that resemble the target ground. Both need the
 * same three things — a tile name turned into degrees, an int16 grid out of the
 * `.hgt`/`.hgt.gz` file, and slope / roughness statistics over a window — so
 * they live here rather than being written twice and drifting apart.
 *
 * The conventions are the ones the rest of the pipeline uses:
 *
 *   * slope is Horn's 3 x 3 gradient, in degrees;
 *   * roughness is Riley's Terrain Ruggedness Index — the mean absolute
 *     difference between a cell and its eight neighbours, in metres;
 *   * SRTM voids (-32768) are excluded from every statistic and never counted
 *     as zero elevation.
 *
 * Cell size is not a constant. A tile is one degree on a side, so an SRTM GL1
 * (3601 x 3601) cell is one arc-second — about 30.9 m north-south — and its
 * east-west width shrinks with the cosine of latitude. Dividing a north-south
 * distance by an east-west one as if the cells were square would overstate
 * slope in high-latitude tiles by a factor of two or more.
 */

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

/** One arc-second of latitude at the equator, in metres. */
const ARC_SECOND_M = 30.866;

/** SRTM's no-data marker, in metres. */
export const VOID = -32768;

/**
 * `N43W114` -> the one-degree box it covers. North and east are the nominal
 * one-degree boundary; the last row and column sit on that boundary, which is
 * why spacing is `1 / (side - 1)` rather than `1 / side`.
 */
export function tileBounds(name) {
  const match = /^([NS])(\d{2})([EW])(\d{3})$/.exec(name);
  if (!match) throw new Error(`Tile name "${name}" is not in N43W114 / S24W069 form`);
  const lat = Number(match[2]) * (match[1] === 'N' ? 1 : -1);
  const lon = Number(match[4]) * (match[3] === 'E' ? 1 : -1);
  return { name, south: lat, north: lat + 1, west: lon, east: lon + 1 };
}

/** The tile that contains a point — the floor of both coordinates. */
export function tileNameFor(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const latPart = String(Math.abs(Math.floor(lat))).padStart(2, '0');
  const lonPart = String(Math.abs(Math.floor(lon))).padStart(3, '0');
  return `${ns}${latPart}${ew}${lonPart}`;
}

/** Read a `.hgt` or `.hgt.gz` tile into a square int16 grid, north row first. */
export function readHgt(path) {
  const raw = readFileSync(path);
  const buffer = path.endsWith('.gz') ? gunzipSync(raw) : raw;
  const side = Math.round(Math.sqrt(buffer.length / 2));
  if (side < 2 || side * side * 2 !== buffer.length) {
    throw new Error(`${path}: ${buffer.length} bytes is not a square int16 tile`);
  }
  const data = new Int16Array(side * side);
  for (let index = 0; index < data.length; index += 1) data[index] = buffer.readInt16BE(index * 2);
  return { data, side };
}

/** Ground size of one cell at a given latitude. */
export function cellMetres(side, latDeg) {
  const arcSeconds = 3600 / (side - 1);
  const northSouth = ARC_SECOND_M * arcSeconds;
  return { y: northSouth, x: northSouth * Math.cos((latDeg * Math.PI) / 180) };
}

/** Latitude of a row, and longitude of a column, within a tile. */
export function coordinateOf(bounds, side, row, col) {
  return {
    lat: bounds.north - row / (side - 1),
    lon: bounds.west + col / (side - 1),
  };
}

/** Where a window of `size` cells can start without running off the tile. */
export function clampWindow(side, row0, col0, size) {
  const limit = side - 1 - size;
  return {
    row0: Math.max(1, Math.min(Math.round(row0), limit)),
    col0: Math.max(1, Math.min(Math.round(col0), limit)),
  };
}

/**
 * Slope, roughness and elevation statistics over one window.
 *
 * The outer ring of the window is read but never counted, because a cell on the
 * ring has no neighbour on one side; dropping one cell per edge keeps every
 * published figure computed from eight neighbours. `validPct` is therefore
 * against the inner window, not the nominal one.
 */
export function measureWindow(grid, bounds, row0, col0, size) {
  const { data, side } = grid;
  const last = row0 + size - 1;
  if (row0 < 1 || col0 < 1 || last > side - 2) {
    throw new Error(`window ${size} at ${row0},${col0} runs off a ${side} cell tile`);
  }

  const midRow = row0 + (size - 1) / 2;
  const lat = bounds.north - midRow / (side - 1);
  const step = cellMetres(side, lat);

  let valid = 0;
  let sum = 0;
  let sumSquares = 0;
  let sumSlope = 0;
  let maxSlope = 0;
  let sumTri = 0;
  let triCells = 0;
  let eMin = Infinity;
  let eMax = -Infinity;

  for (let row = row0 + 1; row < row0 + size - 1; row += 1) {
    const base = row * side;
    for (let col = col0 + 1; col < col0 + size - 1; col += 1) {
      const index = base + col;
      const z = data[index];
      if (z === VOID) continue;

      const north = data[index - side];
      const south = data[index + side];
      const west = data[index - 1];
      const east = data[index + 1];
      if (north === VOID || south === VOID || west === VOID || east === VOID) continue;

      valid += 1;
      sum += z;
      sumSquares += z * z;
      if (z < eMin) eMin = z;
      if (z > eMax) eMax = z;

      const dzdx = (east - west) / (2 * step.x);
      const dzdy = (north - south) / (2 * step.y);
      const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      sumSlope += slope;
      if (slope > maxSlope) maxSlope = slope;

      let tri = 0;
      let neighbours = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const value = data[index + dr * side + dc];
          if (value === VOID) continue;
          tri += Math.abs(z - value);
          neighbours += 1;
        }
      }
      if (neighbours > 0) {
        sumTri += tri / neighbours;
        triCells += 1;
      }
    }
  }

  const cells = (size - 2) * (size - 2);
  const mean = valid > 0 ? sum / valid : Number.NaN;
  const variance = valid > 0 ? Math.max(0, sumSquares / valid - mean * mean) : Number.NaN;
  const centreRow = row0 + (size - 1) / 2;
  const centreCol = col0 + (size - 1) / 2;

  return {
    valid,
    cells,
    validPct: (valid / cells) * 100,
    slopeMeanDeg: valid > 0 ? sumSlope / valid : Number.NaN,
    slopeMaxDeg: maxSlope,
    triMeanM: triCells > 0 ? sumTri / triCells : Number.NaN,
    elevationMeanM: mean,
    elevationStdM: Math.sqrt(variance),
    elevationMinM: valid > 0 ? eMin : Number.NaN,
    elevationMaxM: valid > 0 ? eMax : Number.NaN,
    reliefM: valid > 0 ? eMax - eMin : Number.NaN,
    cellMetres: step,
    centre: coordinateOf(bounds, side, centreRow, centreCol),
  };
}

/** Distance between two points, flat-earth form, in kilometres. */
export function offsetKm(from, to, lat) {
  const northKm = (to.lat - from.lat) * 110.95;
  const eastKm = (to.lon - from.lon) * 111.32 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(northKm, eastKm);
}
