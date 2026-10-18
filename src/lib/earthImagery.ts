/**
 * NASA GIBS — Global Imagery Browse Services, the imagery service behind NASA
 * Worldview. It publishes near-real-time satellite mosaics as plain WMS
 * images, so the globe can show the actual Earth for a chosen day instead of
 * one fixed mosaic.
 *
 * GIBS is open and CORS-enabled, so the browser fetches the mosaic directly.
 * api.nasa.gov keys are not needed for it (they cover EPIC, APOD and friends).
 */

export const GIBS_EPSG4326_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

/** VIIRS (Suomi NPP) corrected reflectance — the daily true-colour composite. */
export const TRUE_COLOR_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';

/** UTC calendar date `daysAgo` days before `now`, as `YYYY-MM-DD`. */
export function utcDate(daysAgo = 0, now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * Latest complete day of imagery. The current UTC day is still being
 * downlinked, so today's composite only covers the hours already processed.
 */
export function latestImageryDate(now = new Date()): string {
  return utcDate(1, now);
}

/**
 * How far back the picker goes. GIBS holds the full VIIRS archive (2012 →),
 * but older gaps composite as empty patches, so the demo window stays inside
 * the period where every day is a complete global mosaic.
 */
export const IMAGERY_WINDOW_DAYS = 60;

export function imageryWindow(now = new Date()): { min: string; max: string } {
  return { min: utcDate(1 + IMAGERY_WINDOW_DAYS, now), max: latestImageryDate(now) };
}

/**
 * A close-up GetMap around one site, for the orbit-vs-ground comparison.
 *
 * `spanDegrees` is the north-south extent; the east-west extent is widened by
 * 1/cos(lat) so the image covers a square patch of ground instead of stretching
 * the further from the equator the site is. Returns the box plus the ground
 * size in kilometres, because the caption has to state the scale rather than
 * imply the satellite resolves 30 m detail.
 */
export function siteImagery(
  lat: number,
  lon: number,
  spanDegrees: number,
  size = 900,
  date = latestImageryDate(),
  layer = TRUE_COLOR_LAYER,
): { url: string; bbox: string; widthKm: number; heightKm: number; date: string } {
  const heightDeg = spanDegrees;
  const widthDeg = Math.min(360, spanDegrees / Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const south = Math.max(-90, lat - heightDeg / 2);
  const north = Math.min(90, lat + heightDeg / 2);
  const west = lon - widthDeg / 2;
  const east = lon + widthDeg / 2;

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/jpeg',
    SRS: 'EPSG:4326',
    BBOX: `${west},${south},${east},${north}`,
    WIDTH: String(size),
    HEIGHT: String(size),
    TIME: date,
  });

  return {
    url: `${GIBS_EPSG4326_WMS}?${params.toString()}`,
    bbox: `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`,
    widthKm: Math.round(111.32 * widthDeg * Math.cos((lat * Math.PI) / 180)),
    heightKm: Math.round(111.32 * heightDeg),
    date,
  };
}

/**
 * One WMS GetMap request returns the whole world as a 2:1 equirectangular
 * JPEG — the same layout three.js sphere UVs expect.
 */
export function trueColorUrl(date: string, width = 3072): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: TRUE_COLOR_LAYER,
    STYLES: '',
    FORMAT: 'image/jpeg',
    SRS: 'EPSG:4326',
    BBOX: '-180,-90,180,90',
    WIDTH: String(width),
    HEIGHT: String(Math.round(width / 2)),
    TIME: date,
  });
  return `${GIBS_EPSG4326_WMS}?${params.toString()}`;
}
