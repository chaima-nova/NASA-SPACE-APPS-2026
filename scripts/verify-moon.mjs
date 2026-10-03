/**
 * Verification for the Moon textures.
 *
 * Samples the committed equirectangular textures at the coordinates of
 * well-known lunar features and checks the values against their expected
 * nature. This catches the failure modes that would make the globe subtly
 * wrong: mirrored longitude, a flipped pole, a longitude offset, or the wrong
 * colour/height channel.
 *
 * Run: node scripts/verify-moon.mjs
 */
import path from 'node:path';
import sharp from 'sharp';

const COLOR = path.resolve('public/moon/lroc-color-4k.jpg');
const HEIGHT = path.resolve('public/moon/ldem-4k.png');

/**
 * Known features. `expect` is what the data should show:
 *   dark  = low albedo (mare basalt)
 *   light = high albedo (highland / bright ejecta)
 *   low   = low elevation (basin / mare floor)
 *   high  = high elevation (far-side highlands)
 */
const FEATURES = [
  { name: 'Mare Imbrium', lat: 32.8, lon: -15.6, expect: 'dark', why: 'large near-side mare' },
  { name: 'Mare Serenitatis', lat: 28.0, lon: 17.5, expect: 'dark', why: 'near-side mare' },
  { name: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4, expect: 'dark', why: 'Apollo 11 landing mare' },
  { name: 'Mare Crisium', lat: 17.0, lon: 59.1, expect: 'dark', why: 'isolated eastern mare' },
  { name: 'Oceanus Procellarum', lat: 18.4, lon: -57.4, expect: 'dark', why: 'western mare expanse' },
  { name: 'Mare Moscoviense', lat: 27.0, lon: 147.0, expect: 'dark', why: 'far-side mare (mirror test)' },
  { name: 'Tycho crater', lat: -43.3, lon: -11.4, expect: 'light', why: 'bright rayed crater' },
  { name: 'Far-side highlands', lat: 5.0, lon: 180.0, expect: 'light', why: 'bright anorthositic highlands' },
  { name: 'Mare Imbrium floor', lat: 32.8, lon: -15.6, expect: 'low', why: 'impact basin floor' },
  { name: 'Mare Serenitatis floor', lat: 28.0, lon: 17.5, expect: 'low', why: 'mare-filled basin' },
  { name: 'South Pole-Aitken basin', lat: -53.0, lon: -169.0, expect: 'low', why: 'largest known impact basin' },
  { name: 'Far-side highlands (elev)', lat: 5.0, lon: 180.0, expect: 'high', why: 'thick highland crust' },
  { name: 'Near-side highlands (elev)', lat: -20.0, lon: 10.0, expect: 'high', why: 'southern highland terrain' },
];

/** Average luminance in a small window, to avoid single-pixel noise. */
function sampleMean(arr, w, h, x, y, half = 6) {
  let sum = 0;
  let n = 0;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const px = ((x + dx) % w + w) % w;
      const py = Math.max(0, Math.min(h - 1, y + dy));
      sum += arr[py * w + px];
      n++;
    }
  }
  return sum / n;
}

async function loadGray(file, w, h) {
  const { data } = await sharp(file, { limitInputPixels: false })
    .resize(w, h, { fit: 'fill' })
    .toColourspace('b-w')
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, w * h);
}

async function loadHeightRaw(file, w, h) {
  const { data, info } = await sharp(file, { limitInputPixels: false })
    .resize(w, h, { fit: 'fill' })
    .toColourspace('b-w')
    .raw({ depth: 'ushort' })
    .toBuffer({ resolveWithObject: true });
  if (info.depth !== 'ushort') throw new Error('height map is not 16-bit');
  return new Uint16Array(data.buffer, data.byteOffset, w * h);
}

const W = 1024;
const H = 512;

const color = await loadGray(COLOR, W, H);
const height = await loadHeightRaw(HEIGHT, W, H);

// Reference stats for relative comparisons.
let cMin = 255, cMax = 0, cSum = 0;
for (const v of color) { if (v < cMin) cMin = v; if (v > cMax) cMax = v; cSum += v; }
const cMean = cSum / color.length;

let hMin = Infinity, hMax = -Infinity, hSum = 0;
for (const v of height) { if (v < hMin) hMin = v; if (v > hMax) hMax = v; hSum += v; }
const hMean = hSum / height.length;

console.log(`colour   min/mean/max = ${cMin}/${cMean.toFixed(1)}/${cMax}`);
console.log(`height   min/mean/max = ${hMin}/${hMean.toFixed(1)}/${hMax}`);
console.log('');

/**
 * Standard equirectangular convention: longitude -180 at the left edge,
 * +180 at the right; latitude +90 at the top.
 */
const toPixel = (lat, lon) => {
  const x = Math.round(((lon + 180) / 360) * W);
  const y = Math.round(((90 - lat) / 180) * H);
  return { x: Math.min(W - 1, Math.max(0, x)), y: Math.min(H - 1, Math.max(0, y)) };
};

let pass = 0;
let fail = 0;

for (const f of FEATURES) {
  const { x, y } = toPixel(f.lat, f.lon);
  const isHeight = f.expect === 'low' || f.expect === 'high';
  const value = isHeight
    ? sampleMean(height, W, H, x, y)
    : sampleMean(color, W, H, x, y);
  const mean = isHeight ? hMean : cMean;

  let ok;
  if (f.expect === 'dark') ok = value < mean;
  else if (f.expect === 'light') ok = value > mean;
  else if (f.expect === 'low') ok = value < mean;
  else ok = value > mean;

  const delta = value - mean;
  const tag = ok ? 'PASS' : 'FAIL';
  if (ok) pass++; else fail++;
  console.log(
    `${tag}  ${f.name.padEnd(28)} ${f.expect.padEnd(5)} ` +
      `value=${value.toFixed(1)} mean=${mean.toFixed(1)} delta=${delta >= 0 ? '+' : ''}${delta.toFixed(1)}  (${f.why})`,
  );
}

console.log('');

// Mirror test: if longitude were mirrored, the mare/highland checks would
// instead align at (180 - lon). Report how many would pass that way.
let mirrorPass = 0;
for (const f of FEATURES) {
  const { x, y } = toPixel(f.lat, 180 - f.lon);
  const isHeight = f.expect === 'low' || f.expect === 'high';
  const value = isHeight ? sampleMean(height, W, H, x, y) : sampleMean(color, W, H, x, y);
  const mean = isHeight ? hMean : cMean;
  if (f.expect === 'dark' || f.expect === 'low') { if (value < mean) mirrorPass++; }
  else if (value > mean) mirrorPass++;
}
console.log(`mirrored-longitude hypothesis would pass ${mirrorPass}/${FEATURES.length}`);
console.log(`standard-longitude hypothesis passes      ${pass}/${FEATURES.length}`);
console.log(fail === 0 ? '\nRESULT: textures match known lunar geography.' : `\nRESULT: ${fail} feature(s) did not match.`);
process.exit(fail === 0 ? 0 : 1);
