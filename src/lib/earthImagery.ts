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
 * The bounding box of one site close-up, in degrees.
 *
 * `spanDegrees` is the north-south extent; the east-west extent is widened by
 * 1/cos(lat) so the image covers a square patch of ground instead of stretching
 * the further from the equator the site is.
 */
function closeUpBox(lat: number, lon: number, spanDegrees: number) {
  const heightDeg = spanDegrees;
  const widthDeg = Math.min(360, spanDegrees / Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return {
    bbox: `${(lon - widthDeg / 2).toFixed(4)},${Math.max(-90, lat - heightDeg / 2).toFixed(4)},` +
      `${(lon + widthDeg / 2).toFixed(4)},${Math.min(90, lat + heightDeg / 2).toFixed(4)}`,
    widthDeg,
    heightDeg,
  };
}

/** One GetMap request for a box, at the layer's own resolution. */
export function boxImageryUrl(
  bbox: string,
  size: number,
  date: string,
  layer = TRUE_COLOR_LAYER,
): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/jpeg',
    SRS: 'EPSG:4326',
    BBOX: bbox,
    WIDTH: String(size),
    HEIGHT: String(size),
    TIME: date,
  });
  return `${GIBS_EPSG4326_WMS}?${params.toString()}`;
}

/**
 * A close-up around one site, for the satellite half of the comparison.
 *
 * Returns the box plus the ground size in kilometres, because the caption has
 * to state the scale rather than imply the satellite resolves 30 m detail.
 */
export function siteImagery(
  lat: number,
  lon: number,
  spanDegrees: number,
  size = 900,
  date = latestImageryDate(),
  layer = TRUE_COLOR_LAYER,
): { url: string; bbox: string; widthKm: number; heightKm: number; date: string } {
  const box = closeUpBox(lat, lon, spanDegrees);
  return {
    url: boxImageryUrl(box.bbox, size, date, layer),
    bbox: box.bbox,
    widthKm: Math.round(111.32 * box.widthDeg * Math.cos((lat * Math.PI) / 180)),
    heightKm: Math.round(111.32 * box.heightDeg),
    date,
  };
}

/**
 * How many days one cloud-free composite averages. Five is the smallest window
 * that survives two consecutive cloudy passes — which is what a median needs —
 * without reaching so far back that the ground itself has moved on.
 */
export const COMPOSITE_DAYS = 5;

/**
 * The days a cloud-free composite ending on `date` combines, oldest first.
 *
 * Each is a complete global mosaic in GIBS, so the same box can be requested
 * once per day and stacked pixel for pixel.
 */
export function compositeDates(date: string, days = COMPOSITE_DAYS): string[] {
  const end = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return [date];
  const span = Math.max(1, Math.floor(days));
  return Array.from({ length: span }, (_, index) =>
    new Date(end - (span - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
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
