/**
 * Low-precision lunar astronomy, after Meeus, "Astronomical Algorithms".
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
