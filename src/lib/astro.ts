/**
 * Low-precision lunar and Martian astronomy.
 *
 * The Moon section follows Meeus, "Astronomical Algorithms".
 *
 * Gives the position of the Sun as seen from the Moon's surface, which is what
 * drives the terminator (day/night line) in the globe. The sub-solar longitude
 * is the Moon's phase angle, so the illuminated hemisphere matches the real
 * lunar phase at any given moment.
 *
 * Accuracy: the phase angle is good to roughly 0.01 deg (a few hours of
 * terminator drift), which is well inside what is visible on a globe. The
 * sub-solar latitude term uses the Moon's 1.54 deg axial tilt and is the
 * least precise part of this module, but it only ever moves the sub-solar
 * point within +-1.54 deg.
 */

const RAD = Math.PI / 180;

const norm360 = (d: number) => ((d % 360) + 360) % 360;
const norm180 = (d: number) => {
  const x = norm360(d);
  return x > 180 ? x - 360 : x;
};

/** Mean synodic month, days. */
export const SYNODIC_MONTH = 29.530588853;

export interface MoonLighting {
  /** Selenographic latitude of the sub-solar point, degrees. */
  subSolarLat: number;
  /** Selenographic longitude of the sub-solar point, degrees (-180..180). */
  subSolarLon: number;
  /** Illuminated fraction of the near side, 0 (new) .. 1 (full). */
  illumination: number;
  /** Age in the synodic month, days; 0 = new, ~14.8 = full. */
  ageDays: number;
  /** Human-readable phase name. */
  phaseName: string;
}

function phaseName(ageDays: number): string {
  if (ageDays < 1.0 || ageDays >= SYNODIC_MONTH - 1.0) return 'New Moon';
  if (ageDays < 6.4) return 'Waxing Crescent';
  if (ageDays < 8.4) return 'First Quarter';
  if (ageDays < 13.8) return 'Waxing Gibbous';
  if (ageDays < 15.8) return 'Full Moon';
  if (ageDays < 21.1) return 'Waning Gibbous';
  if (ageDays < 23.1) return 'Last Quarter';
  return 'Waning Crescent';
}

/** Julian centuries since J2000.0. */
export function julianCenturies(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return (jd - 2451545.0) / 36525;
}

/**
 * Greenwich mean sidereal time, in degrees (0..360).
 *
 * This is the right ascension currently over 0 deg longitude, so it anchors a
 * celestial map to the Earth-fixed frame. Meeus, "Astronomical Algorithms",
 * eq. 12.4; accuracy is well under a second of time for this century.
 */
export function greenwichSiderealTime(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const T = d / 36525;
  const gmst =
    280.46061837 +
    360.98564736629 * d +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return norm360(gmst);
}

/** Sidereal rotation rate: 360.9856 deg per solar day, in degrees per second. */
export const SIDEREAL_DEG_PER_SEC = 360.98564736629 / 86400;

export interface EarthLighting {
  /** Geographic latitude of the sub-solar point, degrees (-23.44..23.44). */
  subSolarLat: number;
  /** Geographic longitude of the sub-solar point, degrees (-180..180). */
  subSolarLon: number;
}

/**
 * Where the Sun is overhead on Earth at `date`.
 *
 * Solar declination follows the usual day-of-year approximation, and the
 * sub-solar longitude falls out of UTC: the Sun is over 0 deg longitude at
 * 12:00 UTC. The equation of time (+-16 min) is ignored, which moves the
 * terminator by at most 4 deg of longitude — invisible at this scale.
 */
export function earthLighting(date: Date): EarthLighting {
  const dayOfYear =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getUTCFullYear(), 0, 0)) /
    86400000;

  const subSolarLat = -23.44 * Math.cos((360 / 365.24) * (dayOfYear + 10) * RAD);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const subSolarLon = norm180(180 - utcHours * 15);

  return { subSolarLat, subSolarLon };
}

/**
 * Where the Sun is overhead on the Moon at `date`.
 */
export function moonLighting(date: Date): MoonLighting {
  const T = julianCenturies(date);
  const T2 = T * T;

  // --- Sun (Meeus ch. 25) --------------------------------------------------
  const sunMeanLon = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
  const sunMeanAnomaly = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
  const M = sunMeanAnomaly * RAD;
  const sunCenter =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const sunLon = sunMeanLon + sunCenter;

  // --- Moon (Meeus ch. 47) -------------------------------------------------
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2; // mean elongation
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2; // mean anomaly

  // --- Phase angle (Meeus ch. 48) -----------------------------------------
  // i = 180 - D - corrections. Kept unfolded so its sign carries whether the
  // Moon is waxing or waning, which decides which limb is lit.
  const iRaw =
    180 -
    D -
    6.289 * Math.sin(Mp * RAD) +
    2.1 * Math.sin(M) -
    1.274 * Math.sin((2 * D - Mp) * RAD) -
    0.658 * Math.sin(2 * D * RAD) -
    0.214 * Math.sin(2 * Mp * RAD) -
    0.11 * Math.sin(D * RAD);

  // The sub-solar selenographic longitude is the phase angle measured from the
  // mean sub-Earth point.
  const subSolarLon = norm180(iRaw);

  const illumination = (1 + Math.cos(iRaw * RAD)) / 2;
  const ageDays = (norm360(180 - iRaw) / 360) * SYNODIC_MONTH;

  // --- Sub-solar latitude --------------------------------------------------
  // The Moon's rotation axis is tilted 1.5424 deg to the ecliptic, and the
  // node of its equator regresses with an 18.6-year period, so the sub-solar
  // latitude stays within +-1.5424 deg.
  const node = 125.0445479 - 1934.1362891 * T + 0.0020754 * T2;
  const subSolarLat = 1.5424 * Math.sin((sunLon - node) * RAD);

  return {
    subSolarLat,
    subSolarLon,
    illumination,
    ageDays,
    phaseName: phaseName(ageDays),
  };
}

/* --------------------------------------------------------------------------
 * Mars
 * ------------------------------------------------------------------------ */

export interface MarsLighting {
  /** Areocentric (planetocentric) latitude of the sub-solar point, degrees. */
  subSolarLat: number;
  /** Areographic east longitude of the sub-solar point, degrees (-180..180). */
  subSolarLon: number;
  /** Areocentric solar longitude Ls, 0..360; 0 = northern spring equinox. */
  solarLongitude: number;
  /** Northern-hemisphere season name for that Ls. */
  season: string;
}

/**
 * Perturbers in Mars's orbit, from Allison & McEwen (2000) eq. 18: amplitude
 * (deg), period (Julian years), phase (deg).
 */
const MARS_PERTURBERS: ReadonlyArray<readonly [number, number, number]> = [
  [0.0071, 2.2353, 49.409],
  [0.0057, 2.7543, 168.173],
  [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704],
  [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];

function marsSeason(ls: number): string {
  if (ls < 90) return 'Northern spring';
  if (ls < 180) return 'Northern summer';
  if (ls < 270) return 'Northern autumn';
  return 'Northern winter';
}

/**
 * Where the Sun is overhead on Mars at `date`.
 *
 * Implements NASA GISS's Mars24 algorithm (Allison & McEwen 2000, with the
 * revisions Mars24 documents): areocentric solar longitude from the mean
 * anomaly plus the seven periodic perturbers, the equation of time and the
 * mean solar time at the prime meridian, then the sub-solar point. Mars24
 * quotes the sub-solar longitude as degrees *west*; this returns east, which is
 * the convention of the areographic maps and of `latLonToVec`.
 *
 * Accuracy is a few arcminutes of Ls and a few seconds of Mars time — far
 * inside what a 220 px globe shows. TT - UTC is taken as its post-2017 value
 * (69.184 s); dates before 2017 are off by at most 5 s, i.e. ~0.02 deg of
 * rotation.
 */
export function marsLighting(date: Date): MarsLighting {
  const jdUT = date.getTime() / 86400000 + 2440587.5;
  const jdTT = jdUT + 69.184 / 86400;
  const dt = jdTT - 2451545.0;

  // --- Orbit (Mars24 B-1..B-5) ---------------------------------------------
  const meanAnomaly = 19.3871 + 0.52402073 * dt;
  const fictionMeanSun = 270.3871 + 0.524038496 * dt;

  let perturbers = 0;
  for (const [amplitude, period, phase] of MARS_PERTURBERS) {
    perturbers += amplitude * Math.cos(((0.985626 * dt) / period + phase) * RAD);
  }

  const M = meanAnomaly * RAD;
  const centre =
    (10.691 + 3.0e-7 * dt) * Math.sin(M) +
    0.623 * Math.sin(2 * M) +
    0.05 * Math.sin(3 * M) +
    0.005 * Math.sin(4 * M) +
    0.0005 * Math.sin(5 * M) +
    perturbers;

  const solarLongitude = norm360(fictionMeanSun + centre);

  // --- Time on Mars (Mars24 C-1..C-5) --------------------------------------
  const ls = solarLongitude * RAD;
  const equationOfTime =
    2.861 * Math.sin(2 * ls) - 0.071 * Math.sin(4 * ls) + 0.002 * Math.sin(6 * ls) - centre;

  // Mean solar time at the prime meridian (Airy Mean Time), in hours.
  const mst = (((24 * ((jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626)) % 24) + 24) % 24;

  // Sub-solar longitude, Mars24 (west-positive), then flipped to east.
  const subSolarWest = norm360(mst * 15 + equationOfTime + 180);
  const subSolarLon = norm180(-subSolarWest);

  // --- Solar declination (Mars24 D-1) --------------------------------------
  // Planetographic latitude. Mars is flattened (1/169.8), and the surface map
  // is planetocentric, so convert before handing this to the globe.
  const declinationGraphic =
    Math.asin(0.42565 * Math.sin(ls)) / RAD + 0.25 * Math.sin(ls);
  const subSolarLat = Math.atan(0.98825 * Math.tan(declinationGraphic * RAD)) / RAD;

  return {
    subSolarLat,
    subSolarLon,
    solarLongitude,
    season: marsSeason(solarLongitude),
  };
}
