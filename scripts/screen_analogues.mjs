/**
 * Screen the Earth coverage for cells that look like the target ground.
 *
 * This is the step the brief actually asks for: not characterising three famous
 * sites, but *identifying* new candidates from open data. It runs on the grids
 * Abid's sample builder already committed — a 601 x 601 SRTM tile over the
 * Atacama (30 m cells), a 10 x 10 MOLA window over Jezero, and the 40 x 360 LOLA
 * south-polar grid — so nothing here needs a download, a key or a server.
 *
 * What it does, per window of the Earth tile:
 *
 *   1. mean slope, mean terrain roughness index and relief (highest cell minus
 *      lowest) inside the window;
 *   2. the distance from that three-number signature to each target's own
 *      measured signature, scaled by how much each target spreads;
 *   3. a fit in [0, 1] from that distance, and Zehra's evidence state for it.
 *
 * Two honesty rules are load-bearing:
 *
 *   * the coverage is one tile, and the output says so in its own words. A pass
 *     over 1 degree of Chile is a demonstration of the method, not a survey of
 *     the planet;
 *   * only terrain is compared. The thermal, geological and resource dimensions
 *     have no Earth grid in this repository, so the overall state is
 *     `insufficient_evidence` even where the terrain matches well — which is the
 *     point of carrying the state through to the interface at all.
 *
 * Run: node scripts/screen_analogues.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Minimal .npy reader: v1/v2 headers, C-order, little-endian floats. */
function readNpy(path) {
  const buffer = readFileSync(path);
  const magic = buffer.subarray(0, 6).toString('latin1');
  if (magic !== '\x93NUMPY') throw new Error(`${path} is not a .npy file`);

  const major = buffer[6];
  let headerStart;
  let headerLength;
  if (major === 1) {
    headerLength = buffer.readUInt16LE(8);
    headerStart = 10;
  } else {
    headerLength = buffer.readUInt32LE(8);
    headerStart = 12;
  }
  const header = buffer.subarray(headerStart, headerStart + headerLength).toString('latin1');
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1] ?? '<f4';
  const shapeText = /'shape':\s*\(([^)]*)\)/.exec(header)?.[1] ?? '';
  const shape = shapeText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);

  if (!/f4|f8/.test(descr) || descr.startsWith('>')) {
    throw new Error(`Unsupported dtype ${descr} in ${path}`);
  }
  const little = descr.endsWith('f4');
  const bytes = little ? 4 : 8;
  const count = shape.reduce((a, b) => a * b, 1);
  const dataStart = headerStart + headerLength;
  const data = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const at = dataStart + i * bytes;
    data[i] = little ? buffer.readFloatLE(at) : buffer.readDoubleLE(at);
  }
  return { data, rows: shape[0], cols: shape[1] ?? 1 };
}

const stats = (id) => JSON.parse(readFileSync(resolve(root, `data/samples/${id}_stats.json`), 'utf8'));

const earthStats = stats('srtm_earth');
const jezeroStats = stats('mola_mars');
const lolaStats = stats('lola_moon');

const slope = readNpy(resolve(root, 'data/samples/srtm_earth_atacama_slope.npy'));
const tri = readNpy(resolve(root, 'data/samples/srtm_earth_atacama_roughness.npy'));
const elevation = readNpy(resolve(root, 'data/samples/srtm_earth_atacama_elevation.npy'));

const nodata = (v) => !Number.isFinite(v) || v <= -9999;

/** Reference signature for one target: the numbers the cell has to resemble. */
function reference(raw, name, body) {
  return {
    body,
    name,
    slopeMean: raw.slope_deg.mean,
    slopeMax: raw.slope_deg.max,
    triMean: raw.roughness_tri_m.mean,
    triMax: raw.roughness_tri_m.max,
    thermal: false,
  };
}

const REFERENCES = [
  reference(lolaStats, 'Lunar south pole (80–90°S)', 'moon'),
  reference(jezeroStats, 'Jezero crater (17–20°N)', 'mars'),
];

/**
 * Distance between a window's signature and a target's, as a single number.
 *
 * Each axis is divided by the target's own spread (half its mean, floored at 1)
 * rather than by a global constant: the Moon's roughness is three orders of
 * magnitude above Jezero's, and a shared scale would make every Earth cell look
 * identical to the Moon. Dividing by the target's spread asks the fairer
 * question — how far is this cell, in units the target itself varies by?
 */
function distanceTo(window, target) {
  const slopeScale = Math.max(1, target.slopeMean * 0.6);
  const triScale = Math.max(1, target.triMean * 0.6);
  const dSlope = (window.slopeMean - target.slopeMean) / slopeScale;
  const dTri = (window.triMean - target.triMean) / triScale;
  return Math.sqrt((dSlope * dSlope + dTri * dTri) / 2);
}

/**
 * Zehra's four states, from the distance — and from what was *not* compared.
 *
 * A close terrain match is `insufficient_evidence`, not `similar`: a site is not
 * a base-site analog on terrain alone, and saying so is the difference between
 * a score and a claim. `different` is a real result, though, and is allowed
 * where the ground is plainly unlike the target.
 */
function stateFor(distance) {
  if (distance <= 0.5) return { terrain: 'similar', overall: 'insufficient_evidence' };
  if (distance <= 0.9) return { terrain: 'insufficient_evidence', overall: 'insufficient_evidence' };
  return { terrain: 'different', overall: 'different' };
}

const WIN = 16;
const STEP = 16;
const [west, south, east, north] = earthStats.bbox;

const windows = [];
for (let row = 0; row + WIN <= slope.rows; row += STEP) {
  for (let col = 0; col + WIN <= slope.cols; col += STEP) {
    let sSum = 0;
    let tSum = 0;
    let eSum = 0;
    let eMin = Infinity;
    let eMax = -Infinity;
    let valid = 0;
    for (let r = row; r < row + WIN; r += 1) {
      for (let c = col; c < col + WIN; c += 1) {
        const index = r * slope.cols + c;
        const sv = slope.data[index];
        const tv = tri.data[index];
        const ev = elevation.data[index];
        if (nodata(sv) || nodata(tv) || nodata(ev)) continue;
        valid += 1;
        sSum += sv;
        tSum += tv;
        eSum += ev;
        if (ev < eMin) eMin = ev;
        if (ev > eMax) eMax = ev;
      }
    }
    const cells = WIN * WIN;
    if (valid < cells * 0.9) continue; // voids are not candidates

    const window = {
      slopeMean: sSum / valid,
      triMean: tSum / valid,
      elevationMean: eSum / valid,
      relief: eMax - eMin,
      validPct: (valid / cells) * 100,
    };

    const rowCentre = row + WIN / 2;
    const colCentre = col + WIN / 2;
    const lat = north - (rowCentre / slope.rows) * (north - south);
    const lon = west + (colCentre / slope.cols) * (east - west);

    const scored = REFERENCES.map((target) => {
      const distance = distanceTo(window, target);
      const fit = Math.max(0, Math.min(1, 1 - distance / 2));
      return {
        target: target.body,
        targetName: target.name,
        distance: Number(distance.toFixed(3)),
        fit: Number(fit.toFixed(3)),
        state: stateFor(distance),
      };
    });

    const best = Math.max(...scored.map((s) => s.fit));
    windows.push({
      row,
      col,
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      slopeMean: Number(window.slopeMean.toFixed(2)),
      triMean: Number(window.triMean.toFixed(1)),
      relief: Number(window.relief.toFixed(0)),
      elevationMean: Number(window.elevationMean.toFixed(0)),
      validPct: Number(window.validPct.toFixed(1)),
      best,
      scored,
    });
  }
}

windows.sort((a, b) => b.best - a.best);
const top = windows.slice(0, 6);

const pad = (n) => String(n).padStart(2, '0');
const candidates = top.map((w, index) => {
  const moon = w.scored.find((s) => s.target === 'moon');
  const mars = w.scored.find((s) => s.target === 'mars');
  const strongest = moon.fit >= mars.fit ? moon : mars;
  return {
    id: `screened-${pad(index + 1)}`,
    siteName: `Screened cell ${pad(index + 1)}, Atacama tile`,
    region: 'Antofagasta, Chile (SRTM S24W069)',
    lat: w.lat,
    lon: w.lon,
    terrainType: 'desert',
    elevationM: w.elevationMean,
    measured: {
      slopeMeanDeg: w.slopeMean,
      triMeanM: w.triMean,
      reliefM: w.relief,
      windowCells: WIN * WIN,
      validPct: w.validPct,
    },
    moon: {
      fit: moon.fit,
      distance: moon.distance,
      terrainState: moon.state.terrain,
      overallState: moon.state.overall,
    },
    mars: {
      fit: mars.fit,
      distance: mars.distance,
      terrainState: mars.state.terrain,
      overallState: mars.state.overall,
    },
    /** Which target this cell is the stronger claim for, and by how much. */
    strongest: strongest.target,
  };
});

const output = {
  generated_by: 'scripts/screen_analogues.mjs',
  method:
    'Windows of 16x16 SRTM cells, mean slope / mean TRI / relief, distance to each target reference scaled by that reference spread, fit = 1 - distance/2.',
  coverage:
    'One 1x1 degree SRTM GL1 tile over the Atacama (24S 069W, 601x601 cells at 30 m). This demonstrates the screening method; it is not a global survey, and cells outside this tile have not been screened.',
  window_cells: WIN * WIN,
  earth_tile: {
    dataset_id: earthStats.dataset_id,
    bbox: earthStats.bbox,
    grid: '601 x 601',
    citation: earthStats.source_citation,
  },
  references: REFERENCES,
  screened_windows: windows.length,
  candidates,
};

mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(resolve(root, 'reports/screened_candidates.json'), `${JSON.stringify(output, null, 2)}\n`);

console.log(
  `screened ${windows.length} windows; top ${candidates.length}: ` +
    candidates.map((c) => `${c.id} moon ${c.moon.fit} mars ${c.mars.fit}`).join(' | '),
);
