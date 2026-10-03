/**
 * Verification for the computed lunar lighting.
 *
 * Checks the sub-solar point calculation against published 2026 moon phases
 * (Griffith Observatory / timeanddate), plus self-consistency of the phase
 * angle. A wrong sign or a wrong phase-angle convention would light the wrong
 * limb or put the terminator on the wrong side, so these cases matter.
 *
 * Run: node scripts/verify-moon-lighting.mjs
 */
import { moonLighting } from '../src/lib/astro.ts';

/** Published phase dates, 2026, at 12:00 UTC. */
const CASES = [
  { date: '2026-01-03T12:00:00Z', phase: 'Full Moon', illum: [0.95, 1.0] },
  { date: '2026-01-18T12:00:00Z', phase: 'New Moon', illum: [0.0, 0.05] },
  { date: '2026-05-31T12:00:00Z', phase: 'Full Moon', illum: [0.95, 1.0] },
  { date: '2026-09-11T12:00:00Z', phase: 'New Moon', illum: [0.0, 0.05] },
  { date: '2026-10-26T12:00:00Z', phase: 'Full Moon', illum: [0.95, 1.0] },
  // With the full moon on 2026-10-26, last quarter falls around Oct 3-4.
  { date: '2026-10-03T12:00:00Z', phase: 'Last Quarter', illum: [0.45, 0.56] },
];

let pass = 0;
let fail = 0;

console.log('date (UTC)            expected            computed');
console.log('-'.repeat(78));

for (const c of CASES) {
  const d = new Date(c.date);
  const l = moonLighting(d);
  const phaseOk = l.phaseName === c.phase;
  const illumOk = l.illumination >= c.illum[0] && l.illumination <= c.illum[1];
  const ok = phaseOk && illumOk;
  if (ok) pass++;
  else fail++;

  console.log(
    `${c.date.slice(0, 10)}  ${(ok ? 'PASS' : 'FAIL').padEnd(4)} ` +
      `${c.phase.padEnd(17)} ${l.phaseName.padEnd(17)} ` +
      `illum=${(l.illumination * 100).toFixed(1)}% ` +
      `(want ${c.illum[0] * 100}-${c.illum[1] * 100}%) ` +
      `age=${l.ageDays.toFixed(1)}d ` +
      `subsolar=(${l.subSolarLat.toFixed(2)}, ${l.subSolarLon.toFixed(2)})`,
  );
}

console.log('-'.repeat(78));

// Self-consistency: the sub-solar latitude must stay inside the Moon's axial
// tilt, and longitude must be a valid angle.
let latOk = true;
let lonOk = true;
for (let day = 0; day < 400; day++) {
  const d = new Date(Date.UTC(2026, 0, 1) + day * 86400000);
  const l = moonLighting(d);
  if (Math.abs(l.subSolarLat) > 1.5424 + 1e-9) latOk = false;
  if (l.subSolarLon < -180 || l.subSolarLon > 180) lonOk = false;
  if (l.illumination < -1e-9 || l.illumination > 1 + 1e-9) lonOk = false;
}
console.log(`sub-solar latitude within +-1.5424 deg over 400 days: ${latOk ? 'PASS' : 'FAIL'}`);
console.log(`longitude/illumination in range over 400 days:        ${lonOk ? 'PASS' : 'FAIL'}`);
if (!latOk) fail++;
if (!lonOk) fail++;

// The Sun moves westward across the lunar sky, so the sub-solar longitude
// decreases at 360 deg per synodic month: -12.19 deg per Earth day.
const EXPECTED_RATE = -360 / 29.530588853;

// The instantaneous rate genuinely varies (lunar orbital eccentricity makes
// the Moon move faster near perigee), so the robust invariant is the *mean*
// rate over a whole synodic month. The spread is checked separately against
// the physically expected bounds.
const DAYS = 30;
let total = 0;
let minRate = Infinity;
let maxRate = -Infinity;
for (let day = 0; day < DAYS; day++) {
  const a = moonLighting(new Date(Date.UTC(2026, 0, 3) + day * 86400000)).subSolarLon;
  const b = moonLighting(new Date(Date.UTC(2026, 0, 4) + day * 86400000)).subSolarLon;
  const rate = ((b - a + 540) % 360) - 180;
  total += rate;
  if (rate < minRate) minRate = rate;
  if (rate > maxRate) maxRate = rate;
}
const meanRate = total / DAYS;
const meanOk = Math.abs(meanRate - EXPECTED_RATE) < 0.6;
// Eccentricity spreads the instantaneous rate by roughly +-11%.
const spreadOk = minRate > EXPECTED_RATE * 1.16 && maxRate < EXPECTED_RATE * 0.84;
if (!meanOk) fail++;
if (!spreadOk) fail++;
console.log(
  `sub-solar longitude drift: mean ${meanRate.toFixed(2)} deg/day vs ` +
    `expected ${EXPECTED_RATE.toFixed(2)} (${meanOk ? 'PASS' : 'FAIL'}), ` +
    `range ${minRate.toFixed(2)}..${maxRate.toFixed(2)} ` +
    `(${spreadOk ? 'PASS' : 'FAIL'})`,
);

console.log('');
console.log(fail === 0 ? 'RESULT: lighting matches published 2026 moon phases.' : `RESULT: ${fail} check(s) failed.`);
process.exit(fail === 0 ? 0 : 1);
