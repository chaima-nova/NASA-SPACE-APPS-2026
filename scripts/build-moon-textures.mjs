/**
 * One-off asset build: convert the NASA CGI Moon Kit TIFFs into web-ready
 * textures committed under public/moon/.
 *
 * Source (public domain, NASA SVS / LRO):
 *   https://svs.gsfc.nasa.gov/4720
 *     lroc_color_poles_8k.tif  LROC WAC colour mosaic
 *     ldem_16_uint.tif         LOLA 16 px/degree elevation (uint16)
 *
 * Run: node scripts/build-moon-textures.mjs [sourceDir]
 * Default sourceDir is /tmp/moon-kit.
 *
 * Outputs (both equirectangular, 2:1):
 *   lroc-color-4k.jpg   surface colour
 *   ldem-4k.png         elevation, grayscale (used as both displacement and bump)
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] ?? '/tmp/moon-kit';
const OUT = path.resolve('public/moon');

const COLOR_SRC = path.join(SRC, 'lroc_color_poles_8k.tif');
const DEM_SRC = path.join(SRC, 'ldem_16_uint.tif');

const COLOR_W = 4096;
const COLOR_H = 2048;
const DEM_W = 4096;
const DEM_H = 2048;

async function buildColor() {
  await sharp(COLOR_SRC, { limitInputPixels: false })
    .resize(COLOR_W, COLOR_H, { fit: 'fill' })
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    .toFile(path.join(OUT, 'lroc-color-4k.jpg'));
  console.log(`colour  -> lroc-color-4k.jpg (${COLOR_W}x${COLOR_H})`);
}

async function readDem(width, height) {
  const { data, info } = await sharp(DEM_SRC, { limitInputPixels: false })
    .resize(width, height, { fit: 'fill' })
    .toColourspace('b-w')
    .raw({ depth: 'ushort' })
    .toBuffer({ resolveWithObject: true });

  if (info.depth !== 'ushort' || info.channels !== 1) {
    throw new Error(`Unexpected DEM raw output: ${info.depth}/${info.channels}ch`);
  }
  return new Uint16Array(data.buffer, data.byteOffset, width * height);
}

/**
 * The kit ships the DEM as raw uint16 "counts" rather than metres, so we
 * normalise to the observed range instead of assuming a physical scale.
 */

async function buildDem() {
  const dem = await readDem(DEM_W, DEM_H);

  let min = Infinity;
  let max = -Infinity;
  for (const v of dem) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  console.log(`DEM raw range: ${min} .. ${max} (16-bit counts)`);

  // Normalise to full 8-bit range so the displacement map uses the whole ramp.
  const out = Buffer.allocUnsafe(DEM_W * DEM_H);
  const span = Math.max(1, max - min);
  for (let i = 0; i < dem.length; i++) {
    out[i] = Math.round(((dem[i] - min) / span) * 255);
  }

  await sharp(out, { raw: { width: DEM_W, height: DEM_H, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'ldem-4k.png'));
  console.log(`height  -> ldem-4k.png (${DEM_W}x${DEM_H})`);
}

await mkdir(OUT, { recursive: true });
await buildColor();
await buildDem();
console.log('done');
