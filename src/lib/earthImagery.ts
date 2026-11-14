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

/**
 * The pickable span, ending on `latest` when the archive's own newest day is
 * known and on "yesterday" when it is not.
 */
export function imageryWindow(
  now = new Date(),
  latest = latestImageryDate(now),
): { min: string; max: string } {
  const end = new Date(`${latest}T00:00:00Z`).getTime();
  const min = Number.isNaN(end)
    ? utcDate(1 + IMAGERY_WINDOW_DAYS, now)
    : new Date(end - IMAGERY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  return { min, max: latest };
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
 *
 * `width` is the detail ceiling of the globe, not the sensor's: VIIRS resolves
 * about 375 m at nadir, while a single global texture has to fit in GPU memory.
 * The globe asks for 6144 px (4.4 km per texel) on desktop; see EarthGlobe for
 * the touch-device cap.
 */
export function trueColorUrl(date: string, width = 6144): string {
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

/**
 * A colour shaded-relief composite of the whole planet: the "map" half of the
 * terrain-versus-satellite comparison. It is a static product, so no TIME is
 * sent — the layer has no time dimension and a dated request is meaningless.
 */
export const RELIEF_LAYER = 'ASTER_GDEM_Color_Shaded_Relief';

/** One GetMap for a box of shaded relief. */
export function reliefMapUrl(bbox: string, size: number): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: RELIEF_LAYER,
    STYLES: '',
    FORMAT: 'image/jpeg',
    SRS: 'EPSG:4326',
    BBOX: bbox,
    WIDTH: String(size),
    HEIGHT: String(size),
  });
  return GIBS_EPSG4326_WMS + '?' + params.toString();
}

/* ---------------------------------------------------- archive probing ---- */

/** A thumbnail request, cheap enough to sample the archive with. */
function probeUrl(date: string): string {
  return boxImageryUrl('-180,-90,180,90', 96, date);
}

/**
 * True when GIBS actually holds a pass for that day.
 *
 * A missing day does not fail: GIBS answers with a valid, empty JPEG, which
 * would paint the globe black while the UI reports success. So the thumbnail is
 * decoded and its luminance range measured — a real global mosaic always has
 * cloud tops against ocean, while a no-data frame is one flat colour.
 */
async function hasImagery(date: string): Promise<boolean> {
  try {
    const response = await fetch(probeUrl(date), { mode: 'cors' });
    if (!response.ok) return false;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let min = 255;
    let max = 0;
    for (let index = 0; index < data.length; index += 4) {
      const luma = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      if (luma < min) min = luma;
      if (luma > max) max = luma;
    }
    return max - min > 24;
  } catch {
    // Offline, blocked or undecodable: treat the day as unproven, not as present.
    return false;
  }
}

/**
 * The newest day the archive actually carries, asked rather than assumed.
 *
 * `latestImageryDate()` assumes the downlink is exactly one day behind the
 * calendar. That holds on a machine whose clock matches the archive, and fails
 * on one that runs ahead of it: the app then asks for a date with no pass, GIBS
 * returns its empty frame, and the cloud layer appears to do nothing at all.
 * The last `lookBackDays` are sampled newest-first in small parallel batches and
 * the first day with real imagery wins. `null` means the service could not be
 * reached, and the caller should keep its own guess.
 */
export async function newestAvailableImageryDate(
  from = latestImageryDate(),
  lookBackDays = 45,
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  const end = new Date(`${from}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return null;

  const day = 86_400_000;
  const at = (offset: number) => new Date(end - offset * day).toISOString().slice(0, 10);
  const batchSize = 8;

  for (let start = 0; start < lookBackDays; start += batchSize) {
    const offsets = Array.from(
      { length: Math.min(batchSize, lookBackDays - start) },
      (_, index) => start + index,
    );
    const results = await Promise.all(offsets.map((offset) => hasImagery(at(offset))));
    const first = results.indexOf(true);
    if (first !== -1) return at(offsets[first]);
  }
  return null;
}
