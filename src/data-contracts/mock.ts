/**
 * Mock/sample data for the visualization shell.
 *
 * Jasmine uses this to build the UI before the real datasets and ML outputs
 * land. Every fixture matches the shared contracts in ./types.ts, so swapping in
 * real data only requires pointing VITE_API_BASE_URL at the backend.
 *
 * Domain: candidate terrestrial analog sites for permanent Moon base locations
 * and Mars. Coordinates and site names are real, well-known analog locations;
 * the numeric feature vectors are illustrative sample values, not measurements.
 */

import type { DataSource, FocusArea, GeoPoint, OrbitalObject, Prediction } from './types';

interface SiteSpec {
  name: string;
  lat: number;
  lon: number;
  focusArea: FocusArea;
  features: Record<string, number>;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Candidate analog sites. Feature keys describe how closely each place mirrors a
 * Moon/Mars base environment:
 *   aridity            0–1   dryness of the site
 *   diurnalTempSwingC  °C    day–night temperature swing (large on Moon/Mars)
 *   regolithMatch      0–1   mineralogical/geological similarity of surface material
 *   dustIndex          0–1   dust activity and airborne particulates
 *   solarUvIndex       0–1   solar/UV exposure
 *   radiationAnalog    0–1   radiation environment similarity
 *   terrainRoughness   0–1   surface roughness / trafficability
 *   isolationIndex     0–1   remoteness (operations/isolation analog)
 *   elevationM         m     mean elevation
 *   lavaTubePotential  0–1   potential for subsurface lava-tube habitats
 */
const SITES: SiteSpec[] = [
  {
    name: 'Atacama Desert, Chile',
    lat: -23.5,
    lon: -69.2,
    focusArea: 'dual-analog',
    features: { aridity: 0.99, diurnalTempSwingC: 38, regolithMatch: 0.82, dustIndex: 0.7, solarUvIndex: 0.95, radiationAnalog: 0.8, terrainRoughness: 0.5, isolationIndex: 0.9, elevationM: 2400, lavaTubePotential: 0.1 },
  },
  {
    name: 'Haughton Crater, Devon Island, Canada',
    lat: 75.37,
    lon: -89.68,
    focusArea: 'moon-base-analog',
    features: { aridity: 0.9, diurnalTempSwingC: 22, regolithMatch: 0.74, dustIndex: 0.4, solarUvIndex: 0.5, radiationAnalog: 0.7, terrainRoughness: 0.8, isolationIndex: 0.97, elevationM: 200, lavaTubePotential: 0.2 },
  },
  {
    name: 'Death Valley, California, USA',
    lat: 36.24,
    lon: -116.82,
    focusArea: 'mars-base-analog',
    features: { aridity: 0.95, diurnalTempSwingC: 30, regolithMatch: 0.6, dustIndex: 0.55, solarUvIndex: 0.88, radiationAnalog: 0.6, terrainRoughness: 0.7, isolationIndex: 0.6, elevationM: -60, lavaTubePotential: 0.15 },
  },
  {
    name: 'McMurdo Dry Valleys, Antarctica',
    lat: -77.5,
    lon: 162.0,
    focusArea: 'mars-base-analog',
    features: { aridity: 0.98, diurnalTempSwingC: 18, regolithMatch: 0.68, dustIndex: 0.75, solarUvIndex: 0.35, radiationAnalog: 0.65, terrainRoughness: 0.6, isolationIndex: 0.99, elevationM: 500, lavaTubePotential: 0.1 },
  },
  {
    name: 'Mauna Kea, Hawaii, USA',
    lat: 19.82,
    lon: -155.47,
    focusArea: 'moon-base-analog',
    features: { aridity: 0.55, diurnalTempSwingC: 12, regolithMatch: 0.86, dustIndex: 0.2, solarUvIndex: 0.9, radiationAnalog: 0.55, terrainRoughness: 0.75, isolationIndex: 0.5, elevationM: 4200, lavaTubePotential: 0.3 },
  },
  {
    name: 'Kilauea, Hawaii, USA',
    lat: 19.42,
    lon: -155.29,
    focusArea: 'moon-base-analog',
    features: { aridity: 0.4, diurnalTempSwingC: 10, regolithMatch: 0.9, dustIndex: 0.3, solarUvIndex: 0.85, radiationAnalog: 0.5, terrainRoughness: 0.65, isolationIndex: 0.35, elevationM: 1247, lavaTubePotential: 0.5 },
  },
  {
    name: 'Río Tinto, Spain',
    lat: 37.69,
    lon: -6.56,
    focusArea: 'mars-base-analog',
    features: { aridity: 0.7, diurnalTempSwingC: 20, regolithMatch: 0.78, dustIndex: 0.45, solarUvIndex: 0.7, radiationAnalog: 0.4, terrainRoughness: 0.45, isolationIndex: 0.3, elevationM: 400, lavaTubePotential: 0.05 },
  },
  {
    name: 'Timanfaya, Lanzarote, Spain',
    lat: 29.0,
    lon: -13.7,
    focusArea: 'moon-base-analog',
    features: { aridity: 0.8, diurnalTempSwingC: 16, regolithMatch: 0.8, dustIndex: 0.4, solarUvIndex: 0.8, radiationAnalog: 0.45, terrainRoughness: 0.6, isolationIndex: 0.25, elevationM: 300, lavaTubePotential: 0.4 },
  },
  {
    name: 'Craters of the Moon, Idaho, USA',
    lat: 43.42,
    lon: -113.52,
    focusArea: 'moon-base-analog',
    features: { aridity: 0.6, diurnalTempSwingC: 22, regolithMatch: 0.83, dustIndex: 0.35, solarUvIndex: 0.6, radiationAnalog: 0.45, terrainRoughness: 0.7, isolationIndex: 0.4, elevationM: 1800, lavaTubePotential: 0.45 },
  },
  {
    name: 'Qaidam Basin, Tibetan Plateau, China',
    lat: 37.5,
    lon: 94.0,
    focusArea: 'mars-base-analog',
    features: { aridity: 0.96, diurnalTempSwingC: 28, regolithMatch: 0.7, dustIndex: 0.6, solarUvIndex: 0.85, radiationAnalog: 0.75, terrainRoughness: 0.5, isolationIndex: 0.85, elevationM: 2800, lavaTubePotential: 0.1 },
  },
  {
    name: 'Mojave Desert, California, USA',
    lat: 35.0,
    lon: -116.0,
    focusArea: 'mars-base-analog',
    features: { aridity: 0.88, diurnalTempSwingC: 26, regolithMatch: 0.62, dustIndex: 0.5, solarUvIndex: 0.82, radiationAnalog: 0.5, terrainRoughness: 0.55, isolationIndex: 0.35, elevationM: 800, lavaTubePotential: 0.05 },
  },
  {
    name: 'Askja, Iceland',
    lat: 65.03,
    lon: -16.75,
    focusArea: 'dual-analog',
    features: { aridity: 0.55, diurnalTempSwingC: 14, regolithMatch: 0.79, dustIndex: 0.5, solarUvIndex: 0.4, radiationAnalog: 0.5, terrainRoughness: 0.8, isolationIndex: 0.7, elevationM: 1100, lavaTubePotential: 0.25 },
  },
];

function buildGeoPoints(): GeoPoint[] {
  return SITES.map((site, i) => ({
    id: `site-${i.toString().padStart(3, '0')}`,
    name: site.name,
    lat: site.lat,
    lon: site.lon,
    focusArea: site.focusArea,
    features: site.features,
  }));
}

export const mockGeoPoints: GeoPoint[] = buildGeoPoints();

/** Weights for the analog-fit score (sum = 1). */
const WEIGHTS = {
  aridity: 0.2,
  diurnalTempSwingC: 0.16,
  regolithMatch: 0.18,
  dustIndex: 0.12,
  solarUvIndex: 0.1,
  radiationAnalog: 0.1,
  terrainRoughness: 0.06,
  isolationIndex: 0.08,
} as const;

/**
 * Deterministic stand-in for Harshil's model output. The features feed a simple
 * weighted formula so the UI shows plausible ranking structure until the real
 * pipeline lands.
 */
function buildPredictions(points: GeoPoint[]): Prediction[] {
  return points.map((point, i) => {
    const f = point.features;
    const tempSwingNorm = clamp01(f.diurnalTempSwingC / 40);

    const analogScore = clamp01(
      WEIGHTS.aridity * f.aridity +
        WEIGHTS.diurnalTempSwingC * tempSwingNorm +
        WEIGHTS.regolithMatch * f.regolithMatch +
        WEIGHTS.dustIndex * f.dustIndex +
        WEIGHTS.solarUvIndex * f.solarUvIndex +
        WEIGHTS.radiationAnalog * f.radiationAnalog +
        WEIGHTS.terrainRoughness * f.terrainRoughness +
        WEIGHTS.isolationIndex * f.isolationIndex,
    );

    const marsFit = clamp01(
      0.3 * f.aridity +
        0.2 * f.dustIndex +
        0.2 * f.regolithMatch +
        0.15 * tempSwingNorm +
        0.15 * f.solarUvIndex,
    );

    const label = analogScore > 0.72 ? 'Strong' : analogScore > 0.55 ? 'Promising' : 'Weak';

    return {
      id: `pred-${i.toString().padStart(3, '0')}`,
      pointId: point.id,
      siteName: point.name,
      lat: point.lat,
      lon: point.lon,
      focusArea: point.focusArea,
      model: { id: 'analog-fit-baseline', version: '0.1.0-mock' },
      predictedAt: '2026-01-15T00:00:00.000Z',
      analogScore: round3(analogScore),
      marsFit: round3(marsFit),
      label,
      confidence: round3(0.6 + 0.35 * ((Math.sin(i * 7.13) + 1) / 2)),
      featureContributions: {
        aridity: round3(WEIGHTS.aridity * f.aridity),
        diurnalTempSwingC: round3(WEIGHTS.diurnalTempSwingC * tempSwingNorm),
        regolithMatch: round3(WEIGHTS.regolithMatch * f.regolithMatch),
        dustIndex: round3(WEIGHTS.dustIndex * f.dustIndex),
        solarUvIndex: round3(WEIGHTS.solarUvIndex * f.solarUvIndex),
        radiationAnalog: round3(WEIGHTS.radiationAnalog * f.radiationAnalog),
        terrainRoughness: round3(WEIGHTS.terrainRoughness * f.terrainRoughness),
        isolationIndex: round3(WEIGHTS.isolationIndex * f.isolationIndex),
      },
    };
  });
}

export const mockPredictions: Prediction[] = buildPredictions(mockGeoPoints);

export const mockDatasets: DataSource[] = [
  {
    id: 'modis-lst',
    name: 'MODIS Land Surface Temperature (MOD11A2)',
    provider: 'NASA LP DAAC',
    instrument: 'MODIS Terra/Aqua',
    url: 'https://lpdaac.usgs.gov/products/mod11a2v061/',
    focusAreas: ['moon-base-analog', 'mars-base-analog'],
    variables: ['LST_Day_1km', 'LST_Night_1km'],
    temporalResolution: '8-day composite',
    spatialResolution: '1 km',
    retrievedAt: '2026-01-14T00:00:00.000Z',
  },
  {
    id: 'aster-gdem',
    name: 'ASTER Global Digital Elevation Model (ASTGTM)',
    provider: 'NASA LP DAAC / USGS',
    instrument: 'ASTER',
    url: 'https://lpdaac.usgs.gov/products/astgtmv003/',
    focusAreas: ['dual-analog'],
    variables: ['elevation', 'slope', 'aspect'],
    temporalResolution: 'static',
    spatialResolution: '30 m',
    retrievedAt: '2026-01-09T00:00:00.000Z',
  },
  {
    id: 'landsat-oli-tirs',
    name: 'Landsat 9 OLI-2/TIRS-2 Level-2',
    provider: 'USGS / NASA',
    instrument: 'OLI-2 / TIRS-2',
    url: 'https://www.usgs.gov/landsat-missions/landsat-9',
    focusAreas: ['moon-base-analog', 'mars-base-analog', 'dual-analog'],
    variables: ['SR_B4', 'SR_B6', 'SR_B7', 'ST_B10', 'NDVI'],
    temporalResolution: '16-day revisit',
    spatialResolution: '30 m (thermal 100 m)',
    retrievedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'nasa-power-daily',
    name: 'NASA POWER — Daily Point Data',
    provider: 'NASA Langley',
    url: 'https://power.larc.nasa.gov/',
    focusAreas: ['mars-base-analog', 'dual-analog'],
    variables: ['T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M', 'ALLSKY_SFC_SW_DWN', 'PRECTOTCORR'],
    temporalResolution: 'daily',
    spatialResolution: 'point / 0.5° grid',
    retrievedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'viirs-aerosol',
    name: 'VIIRS Deep Blue Aerosol & Dust',
    provider: 'NASA LAADS DAAC',
    instrument: 'VIIRS',
    url: 'https://ladsweb.modaps.eosdis.nasa.gov/',
    focusAreas: ['mars-base-analog'],
    variables: ['AOD_550', 'Angstrom_Exponent'],
    temporalResolution: 'daily',
    spatialResolution: '6 km',
    retrievedAt: '2026-01-11T00:00:00.000Z',
  },
  {
    id: 'lro-diviner',
    name: 'LRO Diviner Lunar Radiometer',
    provider: 'NASA PDS',
    instrument: 'Diviner',
    url: 'https://pds-geosciences.wustl.edu/missions/lro/diviner.htm',
    focusAreas: ['moon-base-analog'],
    variables: ['surface_temp', 'bolometric_temp'],
    temporalResolution: 'monthly',
    spatialResolution: '~0.5 km',
    retrievedAt: '2026-01-08T00:00:00.000Z',
  },
  {
    id: 'lro-mini-rf',
    name: 'LRO Mini-RF (radar)',
    provider: 'NASA PDS',
    instrument: 'Mini-RF',
    url: 'https://pds-geosciences.wustl.edu/missions/lro/minirf.htm',
    focusAreas: ['moon-base-analog'],
    variables: ['CPR', 'm-chi'],
    temporalResolution: 'per-orbit',
    spatialResolution: '15 m',
    retrievedAt: '2026-01-08T00:00:00.000Z',
  },
  {
    id: 'mro-crism',
    name: 'MRO CRISM — Compact Reconnaissance Imaging Spectrometer',
    provider: 'NASA PDS',
    instrument: 'CRISM',
    url: 'https://pds-geosciences.wustl.edu/missions/mro/crism.htm',
    focusAreas: ['mars-base-analog'],
    variables: ['mineralogy', 'hydrated_silica', 'iron_oxides'],
    temporalResolution: 'targeted',
    spatialResolution: '~200 m',
    retrievedAt: '2026-01-07T00:00:00.000Z',
  },
  {
    id: 'mola-topography',
    name: 'MOLA / MGS Mars Topography',
    provider: 'NASA PDS',
    instrument: 'MOLA',
    url: 'https://pds-geosciences.wustl.edu/missions/mgs/mola.html',
    focusAreas: ['mars-base-analog'],
    variables: ['elevation', 'roughness'],
    temporalResolution: 'static',
    spatialResolution: '~463 m/px',
    retrievedAt: '2026-01-06T00:00:00.000Z',
  },
  {
    id: 'msl-rems',
    name: 'MSL REMS — Rover Environmental Monitoring Station',
    provider: 'NASA PDS',
    instrument: 'REMS',
    url: 'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MSL/rems.html',
    focusAreas: ['mars-base-analog'],
    variables: ['air_temp', 'pressure', 'UV_index'],
    temporalResolution: 'hourly',
    spatialResolution: 'point (in-situ)',
    retrievedAt: '2026-01-05T00:00:00.000Z',
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
