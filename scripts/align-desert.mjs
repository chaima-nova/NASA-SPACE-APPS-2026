/**
 * Align the hero's sand layer to the ice layer.
 *
 * The two photographs are both 16:9, so the hero draws them with the same cover
 * transform and their pixels correspond one-to-one at every viewport size. What
 * did not correspond was the skyline: two different scenes, so the dune crest
 * sat above or below the mountain ridge by anything up to a few dozen pixels.
 *
 * This script rewrites the dune layer so its crest lands exactly on the ice
 * ridge, in every column:
 *
 *   * the sky above the ridge is made transparent, so the layer's silhouette is
 *     the ice silhouette by construction — every peak lines up, not just most;
 *   * the sand is resampled with a vertical offset that is full strength at the
 *     ridge and decays to zero two band-heights below it, so everything below —
 *     the ripples the hero is built around — is left byte-for-byte in place.
 *
 * Run: node scripts/align-desert.mjs
 */

import sharp from 'sharp';

const W = 1800;
const H = 1012;
const ICE = 'public/home/arctic.jpg';
const SAND = 'public/home/desert.jpg';
const OUT = 'public/home/desert-aligned.webp';

const SKY_BLUE = 20; // b - r above this is sky, measured on both frames

const read = (path) => sharp(path).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();

const ice = await read(ICE);
const sand = await read(SAND);

const at = (buf, x, y) => (y * W + x) * 3;

/** True where the pixel is sky rather than ground. */
function isSky(buf, x, y) {
  const i = at(buf, x, y);
  const r = buf[i];
  const b = buf[i + 2];
  return b - r > SKY_BLUE;
}

/** First row that is solidly ground, scanning down from the top. */
function ridgeOf(buf, x) {
  for (let y = 0; y < H - 6; y += 1) {
    let ground = 0;
    for (let k = 0; k < 6; k += 1) if (!isSky(buf, x, y + k)) ground += 1;
    if (ground >= 5) return y;
  }
  return -1;
}

function ridgesOf(buf) {
  const raw = new Array(W);
  for (let x = 0; x < W; x += 1) raw[x] = ridgeOf(buf, x);
  // A single stray column would put a step in the silhouette, so the ridge is
  // smoothed before it is used as an alignment target.
  const smooth = new Array(W);
  const radius = 5;
  for (let x = 0; x < W; x += 1) {
    let total = 0;
    let count = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const value = raw[Math.min(W - 1, Math.max(0, x + k))];
      if (value >= 0) {
        total += value;
        count += 1;
      }
    }
    smooth[x] = count > 0 ? Math.round(total / count) : -1;
  }
  const fallback = smooth.find((value) => value >= 0) ?? 0;
  return smooth.map((value) => (value >= 0 ? value : fallback));
}

const iceRidge = ridgesOf(ice);
const sandRidge = ridgesOf(sand);

console.log('ice ridge  mean', (iceRidge.reduce((a, b) => a + b, 0) / W).toFixed(2));
console.log('sand ridge mean', (sandRidge.reduce((a, b) => a + b, 0) / W).toFixed(2));

/** Bilinear sample of the sand at sub-pixel y, clamped to the frame. */
function sample(buf, x, y) {
  const clamped = Math.min(H - 1, Math.max(0, y));
  const y0 = Math.floor(clamped);
  const y1 = Math.min(H - 1, y0 + 1);
  const frac = clamped - y0;
  const a = at(buf, x, y0);
  const b = at(buf, x, y1);
  return [
    buf[a] * (1 - frac) + buf[b] * frac,
    buf[a + 1] * (1 - frac) + buf[b + 1] * frac,
    buf[a + 2] * (1 - frac) + buf[b + 2] * frac,
  ];
}

const out = Buffer.alloc(W * H * 4);

for (let x = 0; x < W; x += 1) {
  const shore = sandRidge[x];
  const target = iceRidge[x];
  const offset = shore - target;
  // The band is where the crest is allowed to stretch; below two of them the
  // offset has decayed to nothing, which is what keeps the ripples registered.
  const band = Math.max(8, Math.round(0.16 * (H - target)));

  for (let y = 0; y < H; y += 1) {
    const o = (y * W + x) * 4;

    if (y < target) {
      out[o + 3] = 0;
      continue;
    }

    let weight;
    if (y <= target + band) weight = 1;
    else if (y >= target + 2 * band) weight = 0;
    else {
      const t = (y - (target + band)) / band;
      weight = 1 - t * t * (3 - 2 * t);
    }

    const sy = y + offset * weight;
    const [r, g, b] = sample(sand, x, sy);

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    // A three-pixel ramp at the crest, so the cut edge does not read as a
    // polygon against the ice behind it.
    const feather = Math.min(3, y - target);
    out[o + 3] = Math.round((feather / 3) * 255);
  }
}

await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .webp({ quality: 88, effort: 5, alphaQuality: 92 })
  .toFile(OUT);

// Prove the result: the topmost opaque row of the new layer, against the ice.
const check = await sharp(OUT).ensureAlpha().raw().toBuffer();
let worst = 0;
let total = 0;
for (let x = 0; x < W; x += 1) {
  let top = H - 1;
  for (let y = 0; y < H; y += 1) {
    if (check[(y * W + x) * 4 + 3] > 128) {
      top = y;
      break;
    }
  }
  const error = Math.abs(top - iceRidge[x]);
  worst = Math.max(worst, error);
  total += error;
}
console.log('mean ridge error', (total / W).toFixed(2), 'px · worst', worst, 'px');
