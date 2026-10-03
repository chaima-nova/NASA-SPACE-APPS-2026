/**
 * One-off asset build: convert NASA's Deep Star Maps 2020 into a web-ready sky
 * texture committed under public/moon/.
 *
 * Source: NASA SVS "Deep Star Maps 2020" (public domain)
 *   https://svs.gsfc.nasa.gov/4851/
 *   Plots the position, brightness and colour of 1.7 billion stars from
 *   Hipparcos-2, Tycho-2 and Gaia DR2. Equirectangular, celestial coordinates,
 *   centred at 0h right ascension.
 *
 * The published master is a 32768x16384 JPEG (~540 MB) or an EXR, both far too
 * large to ship. This downsamples to a texture the browser can actually load.
 *
 * Run: node scripts/build-starmap.mjs <sourceImage> [outWidth]
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2];
const OUT_WIDTH = Number(process.argv[3] ?? 8192);

if (!SRC) {
  console.error('usage: node scripts/build-starmap.mjs <sourceImage> [outWidth]');
  process.exit(1);
}

const OUT = path.resolve('public/moon');
const OUT_HEIGHT = OUT_WIDTH / 2;
const OUT_NAME = `starmap-${Math.round(OUT_WIDTH / 1024)}k.jpg`;

await mkdir(OUT, { recursive: true });

// Downsampling averages neighbouring pixels, which dims the smallest stars.
// Boost brightness back afterwards so the sky still reads as a starfield
// rather than a faint grey haze. `gamma` lifts midtones without clipping the
// bright stars into flat white.
await sharp(SRC, { limitInputPixels: false })
  .resize(OUT_WIDTH, OUT_HEIGHT, { fit: 'fill', kernel: 'lanczos3' })
  .gamma(1.35)
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(path.join(OUT, OUT_NAME));

console.log(`starmap -> ${OUT_NAME} (${OUT_WIDTH}x${OUT_HEIGHT})`);
