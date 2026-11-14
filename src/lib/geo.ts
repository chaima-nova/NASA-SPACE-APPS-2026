/**
 * Distance and place lookup for the "Distance from me" filter.
 *
 * A researcher is not always standing in the place they are screening from, so
 * the origin is either the browser's own fix or a typed address, postcode or
 * city. Everything here is browser-side: no key, no backend, no build step.
 */

export interface Origin {
  lat: number;
  lon: number;
  /** Human-readable label, e.g. "Bristol, England" or "Current location". */
  label: string;
}

/** Radii offered in the filter, in kilometres. */
export const RADIUS_OPTIONS = [250, 500, 1000, 2500, 5000, 10000, 20000];

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The browser's own position, as an origin. Rejects with a readable reason. */
export function currentOrigin(): Promise<Origin> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('This browser has no location support. Enter a place instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: 'Current location',
        });
      },
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? 'Location permission was declined. Enter a place instead.'
              : 'Could not get a location fix. Enter a place instead.',
          ),
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

/**
 * Free-text place lookup: a full address, a postcode on its own, or just a city.
 *
 * Uses OpenStreetMap's Nominatim, which needs no key and answers cross-origin.
 * Its usage policy covers light interactive use with attribution, which is what
 * this is: one request per press. A deployment with real traffic should move to
 * a keyed provider rather than lean on this.
 */
export async function geocode(query: string): Promise<Origin> {
  const trimmed = query.trim();
  if (trimmed.length < 2) throw new Error('Enter a place, postcode or address.');

  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=' +
    encodeURIComponent(trimmed);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('The place lookup service did not respond.');

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
  }>;
  if (results.length === 0) throw new Error('No place matched that. Try a city or postcode.');

  const first = results[0];
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    label: first.display_name ?? trimmed,
  };
}
