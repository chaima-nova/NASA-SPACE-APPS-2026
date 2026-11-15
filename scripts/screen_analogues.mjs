/**
 * Screen SRTM tiles for cells that look like the target ground.
 *
 * This is the step the brief actually asks for: not characterising three famous
 * sites, but *identifying* new candidates from open data. It runs on SRTM tiles
 * the script expects under `data/tiles/` (see `scripts/measure_sites.mjs` for
 * the download line) — no key, no server, no Python.
 *
 * It screens five tiles, chosen to cover the terrain families the brief names
 * rather than the one square the project happened to start with:
 *
 *   S24W069  Atacama        desert, the original demonstration tile
 *   N29W014  Lanzarote      Timanfaya's young basalt and ash
 *   N43W114  Snake River    Craters of the Moon's lava field
 *   N41W122  Modoc Plateau  Lava Beds country: basalt with tube collapse
 *   N37E094  Qaidam Basin   a high, cold, hyper-arid basin
 *
 * What it does, per window:
 *
 *   1. mean slope, mean terrain roughness index and relief inside the window;
 *   2. the distance from that three-number signature to each target's own
 *      measured signature, scaled by how much each target spreads;
 *   3. a fit in [0, 1] from that distance, and Zehra's evidence state for it.
 *
 * Two honesty rules are load-bearing:
 *
 *   * coverage is five 1° tiles. The output says so in its own words: this is a
 *     screening method demonstrated over a small part of the land surface, not a
 *     survey of the planet;
 *   * only terrain is compared. The thermal, geological and resource dimensions
 *     have no Earth grid in this repository, so the overall state is
 *     `insufficient_evidence` even where the terrain matches well — which is the
 *     point of carrying the state through to the interface at all.
 *
 * Run: node scripts/screen_analogues.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { measureWindow, readHgt, tileBounds } from './lib/hgt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/* ------------------------------------------------------------- coverage ---- */

/**
 * The tiles this pass screens. `region` names the ground in the output so a row
 * is identifiable; `terrain` is the region-level landform the tile is known for,
 * not a per-cell classification — the screen measures shape, not rock type.
 */
const TILES = [
  { tile: 'S24W069', region: 'Antofagasta, Chile', short: 'Atacama', terrain: 'desert' },
  { tile: 'N29W014', region: 'Lanzarote, Canary Islands', short: 'Lanzarote', terrain: 'volcanic' },
  { tile: 'N43W114', region: 'Snake River Plain, Idaho', short: 'Snake River', terrain: 'volcanic' },
  { tile: 'N41W122', region: 'Modoc Plateau, California', short: 'Modoc', terrain: 'volcanic' },
  { tile: 'N37E094', region: 'Qaidam Basin, Qinghai, China', short: 'Qaidam', terrain: 'desert' },
];

/** Window and step, in cells. 64 cells at 30 m is roughly 2 km. */
const WIN = 64;
const STEP = 64;

/** How many cells from each tile survive into the published list. */
const PER_TILE = 3;

/* ------------------------------------------------------------ references ---- */

const stats = (id) =>
  JSON.parse(readFileSync(resolve(root, `data/samples/${id}_stats.json`), 'utf8'));

const reference = (raw, name, body) => ({
  body,
  name,
  slopeMean: raw.slope_deg.mean,
  slopeMax: raw.slope_deg.max,
  triMean: raw.roughness_tri_m.mean,
  triMax: raw.roughness_tri_m.max,
  /** The cell size the reference was measured at: the caveat, in the file. */
  resolutionDeg: raw.grid_resolution_deg ?? null,
  thermal: false,
});

const REFERENCES = [
  reference(stats('lola_moon'), 'Lunar south pole (80–90°S)', 'moon'),
  reference(stats('mola_mars'), 'Jezero crater (17–20°N)', 'mars'),
];

/**
 * Distance between a window's signature and a target's, as a single number.
 *
 * Each axis is divided by the target's own spread (floored at one unit so a
 * nearly flat reference does not blow the ratio up) rather than by a global
 * constant: the Moon's roughness is orders of magnitude above Jezero's, and a
 * shared scale would make every Earth cell look identical to the Moon. Dividing
 * by the target's spread asks the fairer question — how far is this cell, in
 * units the target itself varies by?
 */
function distanceTo(window, target) {
  const slopeScale = Math.max(1, target.slopeMean * 0.6);
  const triScale = Math.max(1, target.triMean * 0.6);
  const peakScale = Math.max(1, target.slopeMax * 0.6);
  const dSlope = (window.slopeMeanDeg - target.slopeMean) / slopeScale;
  const dTri = (window.triMeanM - target.triMean) / triScale;
  const dPeak = (window.slopeMaxDeg - target.slopeMax) / peakScale;
  return Math.sqrt((dSlope * dSlope + dTri * dTri + dPeak * dPeak) / 3);
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

/* ---------------------------------------------------------------- screen ---- */

const pad = (n) => String(n).padStart(2, '0');
const round = (value, digits) => Number(value.toFixed(digits));

const candidates = [];
const screenedTiles = [];

for (const entry of TILES) {
  const path = resolve(root, `data/tiles/${entry.tile}.hgt.gz`);
  if (!existsSync(path)) {
    throw new Error(
      `missing ${path} — download it from ` +
        `https://s3.amazonaws.com/elevation-tiles-prod/skadi/${entry.tile.slice(0, 3)}/${entry.tile}.hgt.gz`,
    );
  }

  const bounds = tileBounds(entry.tile);
  const grid = readHgt(path);
  const windows = [];

  for (let row0 = 1; row0 + WIN <= grid.side - 2; row0 += STEP) {
    for (let col0 = 1; col0 + WIN <= grid.side - 2; col0 += STEP) {
      const window = measureWindow(grid, bounds, row0, col0, WIN);
      if (window.valid < window.cells * 0.9) continue; // voids are not candidates

      const fits = REFERENCES.map((target) => {
        const distance = distanceTo(window, target);
        return {
          target: target.body,
          targetName: target.name,
          distance: round(distance, 3),
          fit: round(Math.max(0, Math.min(1, 1 - distance / 2)), 3),
          state: stateFor(distance),
        };
      });

      windows.push({
        lat: round(window.centre.lat, 4),
        lon: round(window.centre.lon, 4),
        slopeMean: round(window.slopeMeanDeg, 2),
        slopeMax: round(window.slopeMaxDeg, 2),
        triMean: round(window.triMeanM, 1),
        relief: round(window.reliefM, 0),
        elevationMean: round(window.elevationMeanM, 0),
        validPct: round(window.validPct, 1),
        fits,
        best: Math.max(...fits.map((f) => f.fit)),
      });
    }
  }

  windows.sort((a, b) => b.best - a.best);

  windows.slice(0, PER_TILE).forEach((window, index) => {
    const moon = window.fits.find((f) => f.target === 'moon');
    const mars = window.fits.find((f) => f.target === 'mars');
    const strongest = moon.fit >= mars.fit ? moon : mars;
    candidates.push({
      id: `screened-${entry.tile.toLowerCase()}-${pad(index + 1)}`,
      siteName: `Screened cell ${pad(index + 1)}, ${entry.short} tile`,
      region: `${entry.region} (SRTM ${entry.tile})`,
      tile: entry.tile,
      lat: window.lat,
      lon: window.lon,
      terrainType: entry.terrain,
      elevationM: window.elevationMean,
      measured: {
        slopeMeanDeg: window.slopeMean,
        slopeMaxDeg: window.slopeMax,
        triMeanM: window.triMean,
        reliefM: window.relief,
        windowCells: WIN * WIN,
        validPct: window.validPct,
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
      strongest: strongest.target,
    });
  });

  screenedTiles.push({
    dataset_id: 'srtm_gl1',
    tile: entry.tile,
    label: `${entry.short} — ${entry.region}`,
    bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
    grid: `${grid.side} x ${grid.side}`,
    arc_seconds: round(3600 / (grid.side - 1), 1),
    screened_windows: windows.length,
    citation: stats('srtm_earth').source_citation,
  });
}

/* --------------------------------------------------------------- output ---- */

candidates.sort((a, b) => Math.max(b.moon.fit, b.mars.fit) - Math.max(a.moon.fit, a.mars.fit));

const tilesLabel = TILES.map((entry) => `${entry.short} (${entry.tile})`).join(', ');
const screenedWindows = screenedTiles.reduce((total, tile) => total + tile.screened_windows, 0);

const output = {
  generated_by: 'scripts/screen_analogues.mjs',
  method:
    'Windows of 64x64 SRTM cells (about 2 km), mean slope / mean TRI / relief, distance to ' +
    'each target reference scaled by that reference spread, fit = 1 - distance/2. Slope is ' +
    "Horn's 3x3 gradient, roughness is Riley's TRI.",
  coverage:
    `${TILES.length} one-degree SRTM GL1 tiles — ${tilesLabel} — ` +
    `${screenedWindows.toLocaleString('en-US')} windows scored, the best three per tile published. ` +
    'Terrain was screened over these five tiles only; every other tile in the SRTM set, and every ' +
    'area outside its 56°S–60°N band, is unscreened. The forbidding part of the comparison is ' +
    'scale: a 2 km window at 30 m and a target reference built from much coarser cells do not ' +
    'measure the same thing, so a fit here is a screening signal, not a verdict.',
  window: { cells: WIN * WIN, metres: Math.round(WIN * 30.866) },
  earth_tiles: screenedTiles,
  references: REFERENCES,
  screened_windows: screenedWindows,
  candidates,
};

mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(
  resolve(root, 'reports/screened_candidates.json'),
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(
  `screened ${screenedWindows} windows over ${TILES.length} tiles; ${candidates.length} candidates:`,
);
for (const candidate of candidates) {
  console.log(
    `  ${candidate.id.padEnd(24)} moon ${candidate.moon.fit}  mars ${candidate.mars.fit}  ` +
      `slope ${candidate.measured.slopeMeanDeg}°  TRI ${candidate.measured.triMeanM} m`,
  );
}
