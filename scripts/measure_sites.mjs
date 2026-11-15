/**
 * Measure the curated analog sites from their own terrain, not from fixtures.
 *
 * The shell has always carried thirteen candidate sites whose feature vectors
 * were typed in by hand: an aridity figure, a roughness figure and so on, with a
 * comment saying they were illustrative. The catalogue, the engine reports and
 * the screened candidates all come from data — the ranked list did not. This
 * script closes that gap for the one dimension that can be measured from what
 * the repository can obtain: terrain.
 *
 * For each curated site it reads the SRTM tile that contains the site, takes a
 * 601 x 601 cell window (about 18.5 km across) centred on the coordinates, and
 * publishes mean and maximum slope, mean TRI roughness, relief, elevation
 * statistics and the share of valid cells. Those are the numbers the dossier
 * shows next to the model's own feature values, so a reader can see which part
 * of a site's description is measured and which part is still an assumption.
 *
 * Two things it deliberately does not do:
 *
 *   * it does not rescore the sites. The fit belongs to the model; replacing a
 *     feature with a measurement is a model change, and quietly re-running the
 *     weighted formula here would hide that decision inside a data script;
 *   * it does not pretend to cover the polar sites. SRTM flew between 56°S and
 *     60°N, so Haughton (75.4°N), McMurdo (−77.5°) and Askja (65.0°N) have no
 *     tile in this set. They are published as `outside_coverage` with the reason
 *     attached, which is more useful than a number derived from the wrong place.
 *
 * Site coordinates are read from `src/data-contracts/mock.ts` rather than copied
 * here: two copies of a coordinate are two coordinates that can disagree. The
 * parse below is narrow on purpose (name, then the site-level lat/lon) and fails
 * loudly if the fixture's shape changes.
 *
 * Data: SRTM GL1, one arc-second, courtesy of NASA/USGS, via the
 * elevation-tiles-prod mirror of the SRTM v3 tiles. Tiles are downloaded with:
 *
 *   curl -o data/tiles/N43W114.hgt.gz \
 *     https://s3.amazonaws.com/elevation-tiles-prod/skadi/N43/N43W114.hgt.gz
 *
 * They are large and git-ignored; only the derived report is committed.
 *
 * Run: node scripts/measure_sites.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clampWindow,
  measureWindow,
  offsetKm,
  readHgt,
  tileBounds,
  tileNameFor,
} from './lib/hgt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** The footprint each site is measured over, in cells and kilometres. */
const WINDOW = 601;
const WINDOW_KM = 18.5;

/** SRTM's flight envelope, which is why three sites cannot be measured. */
const SRTM_NORTH = 60;
const SRTM_SOUTH = -56;

const CITATION =
  'Farr et al. (2007). The Shuttle Radar Topography Mission. Reviews of Geophysics, 45(2).';

/* ------------------------------------------------------------- fixtures ---- */

/**
 * Read the site table out of the fixture.
 *
 * Each `SiteSpec` opens with `name: '...'`, then a `targetSites` block that
 * carries coordinates positionally inside `target(...)`, and then the site's own
 * `lat:` / `lon:` fields. Anchoring on the name and taking the first `lat:` after
 * it therefore lands on the site, not on a target feature.
 */
function readFixtureSites() {
  const text = readFileSync(resolve(root, 'src/data-contracts/mock.ts'), 'utf8');
  const pattern = /name: '([^']+)',[\s\S]*?\n\s+lat: (-?[\d.]+),\r?\n\s+lon: (-?[\d.]+),/g;
  const sites = [...text.matchAll(pattern)].map((match, index) => ({
    siteId: `site-${String(index).padStart(3, '0')}`,
    siteName: match[1],
    lat: Number(match[2]),
    lon: Number(match[3]),
  }));

  if (sites.length !== 13) {
    throw new Error(
      `expected 13 curated sites in mock.ts, parsed ${sites.length} — the fixture's shape changed`,
    );
  }
  return sites;
}

/* ------------------------------------------------------------ measuring ---- */

const tiles = new Map();

function gridFor(tile) {
  if (!tiles.has(tile)) {
    const path = resolve(root, `data/tiles/${tile}.hgt.gz`);
    if (!existsSync(path)) {
      throw new Error(
        `missing ${path} — download it from ` +
          `https://s3.amazonaws.com/elevation-tiles-prod/skadi/${tile.slice(0, 3)}/${tile}.hgt.gz`,
      );
    }
    tiles.set(tile, { bounds: tileBounds(tile), grid: readHgt(path) });
  }
  return tiles.get(tile);
}

const round = (value, digits) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

function measureSite(site) {
  const outsideBand = site.lat > SRTM_NORTH || site.lat < SRTM_SOUTH;
  const tile = tileNameFor(site.lat, site.lon);
  const available = existsSync(resolve(root, `data/tiles/${tile}.hgt.gz`));

  if (outsideBand) {
    return {
      ...site,
      status: 'outside_coverage',
      tile,
      reason:
        `SRTM covers ${Math.abs(SRTM_SOUTH)}°S to ${SRTM_NORTH}°N and this site is at ` +
        `${Math.abs(site.lat).toFixed(1)}°${site.lat >= 0 ? 'N' : 'S'}, so no tile in the set ` +
        "reaches it. The fixture's hand-set values stand unmeasured for this site.",
    };
  }

  if (!available) {
    return {
      ...site,
      status: 'tile_not_downloaded',
      tile,
      reason: `the ${tile} tile is inside the SRTM band but is not in data/tiles, so this site was not measured`,
    };
  }

  const { bounds, grid } = gridFor(tile);
  const centreRow = (bounds.north - site.lat) * (grid.side - 1);
  const centreCol = (site.lon - bounds.west) * (grid.side - 1);
  const { row0, col0 } = clampWindow(
    grid.side,
    centreRow - (WINDOW - 1) / 2,
    centreCol - (WINDOW - 1) / 2,
    WINDOW,
  );
  const measured = measureWindow(grid, bounds, row0, col0, WINDOW);
  const shift = offsetKm(site, measured.centre, site.lat);

  return {
    ...site,
    status: 'measured',
    tile,
    windowCentre: {
      lat: round(measured.centre.lat, 4),
      lon: round(measured.centre.lon, 4),
      /** How far the window had to move to stay inside the tile. */
      offsetKm: round(shift, 1),
    },
    cellMetres: {
      northSouth: round(measured.cellMetres.y, 1),
      eastWest: round(measured.cellMetres.x, 1),
    },
    measured: {
      slopeMeanDeg: round(measured.slopeMeanDeg, 2),
      slopeMaxDeg: round(measured.slopeMaxDeg, 2),
      triMeanM: round(measured.triMeanM, 1),
      reliefM: round(measured.reliefM, 0),
      elevationMeanM: round(measured.elevationMeanM, 0),
      elevationStdM: round(measured.elevationStdM, 1),
      elevationMinM: round(measured.elevationMinM, 0),
      elevationMaxM: round(measured.elevationMaxM, 0),
      validPct: round(measured.validPct, 1),
      windowCells: WINDOW,
    },
  };
}

/* --------------------------------------------------------------- output ---- */

const sites = readFixtureSites().map(measureSite);
const measured = sites.filter((site) => site.status === 'measured');
const uncovered = sites.filter((site) => site.status !== 'measured');
const tileNames = [...new Set(measured.map((site) => site.tile))].sort();

const report = {
  generated_by: 'scripts/measure_sites.mjs',
  method:
    'Horn 3x3 slope, Riley TRI and elevation statistics over a 601 x 601 cell window ' +
    '(about 18.5 km across) centred on each curated site; SRTM GL1, one arc-second ' +
    '(about 30 m) cells, voids excluded and not counted.',
  window: { cells: WINDOW, km: WINDOW_KM },
  coverage:
    `${measured.length} of ${sites.length} curated sites measured over ${tileNames.join(', ')}. ` +
    `${uncovered.length} lie outside the SRTM flight band and keep their fixture values; each ` +
    'row carries the reason. Terrain only: aridity, thermal swing, dust, mineralogy and lava-tube ' +
    'potential are not measurable from a DEM and are still hand-set.',
  citation: CITATION,
  source: {
    dataset_id: 'srtm_gl1',
    resolution: '1 arc-second (~30 m)',
    catalogue: 'https://s3.amazonaws.com/elevation-tiles-prod/skadi/',
    tiles: tileNames.map((tile) => {
      const { bounds, grid } = gridFor(tile);
      return {
        tile,
        bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
        grid: `${grid.side} x ${grid.side}`,
      };
    }),
  },
  sites,
};

mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(resolve(root, 'reports/site_terrain.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `measured ${measured.length}/${sites.length} sites over ${tileNames.length} tiles; ` +
    `${uncovered.length} outside SRTM coverage`,
);
for (const site of measured) {
  console.log(
    `  ${site.siteId}  ${site.siteName.padEnd(42)} slope ${site.measured.slopeMeanDeg}° ` +
      `(max ${site.measured.slopeMaxDeg}°)  TRI ${site.measured.triMeanM} m  ` +
      `relief ${site.measured.reliefM} m`,
  );
}
for (const site of uncovered) {
  console.log(`  ${site.siteId}  ${site.siteName.padEnd(42)} ${site.status}`);
}
