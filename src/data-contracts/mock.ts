/**
 * Mock/sample data for the visualization shell.
 *
 * Jasmine uses this to build the UI before the real datasets and ML outputs
 * land. Every fixture matches the shared contracts in ./types.ts, so swapping in
 * real data only requires pointing VITE_API_BASE_URL at the backend.
 *
 * Sample city: Phoenix, AZ (a real urban-heat pilot area).
 */

import type { DataSource, GeoPoint, OrbitalObject, Prediction } from './types';

const CITY = { lat: 33.4484, lon: -112.074 };
const GRID_COLS = 6;
const GRID_ROWS = 6;

/** Deterministic pseudo-random in [0, 1) so the demo is stable across reloads. */
function noise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 * seed + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function buildGeoPoints(): GeoPoint[] {
  const points: GeoPoint[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const i = r * GRID_COLS + c;
      const lat = CITY.lat + (r - (GRID_ROWS - 1) / 2) * 0.02;
      const lon = CITY.lon + (c - (GRID_COLS - 1) / 2) * 0.025;

      const impervious = 0.2 + 0.7 * noise(i + 1, 1.3);
      const canopy = 0.6 * (1 - impervious) * (0.6 + 0.8 * noise(i + 3, 2.1));
      const surfaceTempC = 28 + 22 * impervious + 6 * noise(i + 5, 3.7) - 8 * canopy;
      const airTempC = surfaceTempC - 8 - 4 * noise(i + 7, 1.9);
      const ndvi = Math.max(0, canopy - 0.1 * noise(i + 11, 2.5));
      const no2Ppb = 8 + 30 * impervious * (0.7 + 0.6 * noise(i + 13, 4.2));
      const pm25 = 4 + 18 * (0.5 * impervious + 0.5 * noise(i + 17, 1.1));

      points.push({
        id: `pt-${i.toString().padStart(3, '0')}`,
        lat: round3(lat),
        lon: round3(lon),
        focusArea: i % 3 === 0 ? 'atmospheric-environmental-health' : 'urban-heat-equity',
        features: {
          surfaceTempC: round1(surfaceTempC),
          airTempC: round1(airTempC),
          imperviousSurfacePct: round1(impervious * 100),
          canopyPct: round1(canopy * 100),
          ndvi: round3(ndvi),
          no2Ppb: round1(no2Ppb),
          pm25: round1(pm25),
        },
      });
    }
  }
  return points;
}

export const mockGeoPoints: GeoPoint[] = buildGeoPoints();

/**
 * Deterministic stand-in for Harshil's model output. The features feed a simple
 * weighted formula so the UI shows plausible spatial structure.
 */
function buildPredictions(points: GeoPoint[]): Prediction[] {
  return points.map((point, i) => {
    const f = point.features;
    const impervious = f.imperviousSurfacePct / 100;
    const canopy = f.canopyPct / 100;
    const surface = f.surfaceTempC;

    const heatRisk = clamp01(
      0.35 * impervious + 0.5 * ((surface - 25) / 30) + 0.15 * (1 - canopy),
    );
    const airQualityRisk = clamp01(
      0.5 * (f.no2Ppb / 40) + 0.5 * (f.pm25 / 25),
    );

    const label = heatRisk > 0.66 ? 'High' : heatRisk > 0.33 ? 'Moderate' : 'Low';

    return {
      id: `pred-${i.toString().padStart(3, '0')}`,
      pointId: point.id,
      lat: point.lat,
      lon: point.lon,
      focusArea: point.focusArea,
      model: { id: 'heat-risk-baseline', version: '0.1.0-mock' },
      predictedAt: '2026-01-15T00:00:00.000Z',
      heatRisk: round3(heatRisk),
      airQualityRisk: round3(airQualityRisk),
      label,
      confidence: round3(0.6 + 0.35 * noise(i + 23, 5.1)),
      featureContributions: {
        surfaceTempC: round3(0.5 * ((surface - 25) / 30)),
        imperviousSurfacePct: round3(0.35 * impervious),
        canopyPct: round3(-0.15 * canopy),
        ndvi: round3(-0.1 * (1 - f.ndvi)),
        airTempC: round3(0.05 * ((f.airTempC - 18) / 20)),
      },
    };
  });
}

export const mockPredictions: Prediction[] = buildPredictions(mockGeoPoints);

export const mockDatasets: DataSource[] = [
  {
    id: 'nasa-power-daily',
    name: 'NASA POWER — Daily Point Data',
    provider: 'NASA Langley',
    url: 'https://power.larc.nasa.gov/',
    focusAreas: ['urban-heat-equity', 'atmospheric-environmental-health'],
    variables: ['T2M', 'T2M_MAX', 'RH2M', 'WS2M', 'ALLSKY_SFC_SW_DWN'],
    temporalResolution: 'daily',
    spatialResolution: 'point / 0.5° grid',
    retrievedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'modis-lst',
    name: 'MODIS Land Surface Temperature (MOD11A2)',
    provider: 'NASA LP DAAC',
    instrument: 'MODIS Terra/Aqua',
    url: 'https://lpdaac.usgs.gov/products/mod11a2v061/',
    focusAreas: ['urban-heat-equity'],
    variables: ['LST_Day_1km', 'LST_Night_1km'],
    temporalResolution: '8-day composite',
    spatialResolution: '1 km',
    retrievedAt: '2026-01-14T00:00:00.000Z',
  },
  {
    id: 'landsat-oli-tirs',
    name: 'Landsat 9 OLI-2/TIRS-2 Level-2',
    provider: 'USGS / NASA',
    instrument: 'OLI-2 / TIRS-2',
    url: 'https://www.usgs.gov/landsat-missions/landsat-9',
    focusAreas: ['urban-heat-equity'],
    variables: ['SR_B4', 'SR_B5', 'ST_B10', 'NDVI', 'NDBI'],
    temporalResolution: '16-day revisit',
    spatialResolution: '30 m (thermal 100 m)',
    retrievedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'tropomi-no2',
    name: 'Sentinel-5P TROPOMI — NO₂ / Aerosol',
    provider: 'ESA Copernicus (NASA collaboration)',
    instrument: 'TROPOMI',
    url: 'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-5P',
    focusAreas: ['atmospheric-environmental-health'],
    variables: ['NO2_column', 'Aerosol_Index', 'CO_column'],
    temporalResolution: 'daily',
    spatialResolution: '~5.5 km',
    retrievedAt: '2026-01-13T00:00:00.000Z',
  },
  {
    id: 'grace-fo',
    name: 'GRACE-FO Gravity Field',
    provider: 'NASA JPL',
    instrument: 'GRACE-FO',
    url: 'https://gracefo.jpl.nasa.gov/',
    focusAreas: ['space-systems'],
    variables: ['gravity_anomaly', 'mascon'],
    temporalResolution: 'monthly',
    spatialResolution: '~3° mascon',
    retrievedAt: '2026-01-10T00:00:00.000Z',
  },
];

export const mockOrbitalObjects: OrbitalObject[] = [
  {
    id: 'iss',
    name: 'ISS (ZARYA)',
    noradId: 25544,
    altitudeKm: 420,
    inclinationDeg: 51.64,
    epoch: '2026-01-15T00:00:00.000Z',
    tle: {
      line1: '1 25544U 98067A   26015.50000000  .00016717  00000+0  10270-3 0  9993',
      line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
    },
  },
  {
    id: 'landsat-9',
    name: 'LANDSAT 9',
    noradId: 49260,
    altitudeKm: 705,
    inclinationDeg: 98.22,
    epoch: '2026-01-15T00:00:00.000Z',
    tle: {
      line1: '1 49260U 21088A   26015.50000000  .00000123  00000+0  25706-4 0  9990',
      line2: '2 49260  98.2196 132.4517 0001231  90.3119 269.8224 14.57109968190876',
    },
  },
];
