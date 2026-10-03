import * as THREE from 'three';

/**
 * Procedural star background for the Moon globe.
 *
 * Renders a large inverted sphere with a painted equirectangular star map, so
 * the sky is real geometry (it orbits and scales correctly with the camera)
 * rather than a CSS layer.
 *
 * Star count and brightness follow a rough magnitude distribution: many faint
 * stars, few bright ones. Colours are drawn from approximate stellar classes
 * (blue-white through red), which is what makes a sky read as photographic
 * rather than as uniform white dots.
 *
 * Note on orientation: the globe is freely rotatable and has no fixed date,
 * time or observer, so the sky has no determinate orientation. The Milky Way
 * band is therefore decorative rather than tied to a real epoch.
 */

const STAR_COLORS: [number, number, number][] = [
  [0.66, 0.76, 1.0], // O/B  blue-white
  [0.8, 0.86, 1.0], // A    white-blue
  [1.0, 1.0, 1.0], // F/G  white
  [1.0, 0.96, 0.86], // G   yellow-white
  [1.0, 0.85, 0.66], // K   orange
  [1.0, 0.72, 0.55], // M   red
];

const COLOR_WEIGHTS = [0.02, 0.06, 0.3, 0.34, 0.2, 0.08];

export interface Starfield {
  group: THREE.Group;
  dispose: () => void;
}

export function createStarfield(radius = 60, starCount = 5000): Starfield {
  const width = 2048;
  const height = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable for starfield');

  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const pickWeighted = () => {
    let r = rand();
    for (let i = 0; i < COLOR_WEIGHTS.length; i++) {
      r -= COLOR_WEIGHTS[i];
      if (r <= 0) return STAR_COLORS[i];
    }
    return STAR_COLORS[STAR_COLORS.length - 1];
  };

  // The galactic band: a great circle, which projects to a sinusoid in
  // equirectangular space.
  const bandCenter = (u: number) => 0.5 + 0.3 * Math.sin(2 * Math.PI * u + 0.9);
  const bandWidth = 0.075;

  // Broad, very faint glow along the band (unresolved stars).
  for (let i = 0; i < 900; i++) {
    const u = rand();
    const v = bandCenter(u) + (rand() - 0.5) * bandWidth * 3.2;
    const x = u * width;
    const y = v * height;
    const r = 30 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(150, 170, 220, 0.030)');
    g.addColorStop(1, 'rgba(150, 170, 220, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < starCount; i++) {
    // Bias roughly a third of the stars into the galactic band.
    const inBand = rand() < 0.34;
    const u = rand();
    const v = inBand
      ? bandCenter(u) + (rand() - 0.5) * bandWidth * 2.4
      : rand();
    if (v < 0 || v > 1) continue;

    const x = u * width;
    const y = v * height;

    // Magnitude distribution: most stars faint, a few bright.
    const mag = Math.pow(rand(), 2.6);
    const size = 0.55 + mag * 3.4;
    const alpha = 0.3 + mag * 0.7;
    const [r, g, b] = pickWeighted();

    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b * 255);
    const color = `rgba(${ri}, ${gi}, ${bi}, ${alpha})`;

    if (size > 1.9) {
      // Bright stars get a soft glow so they read as points of light.
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3.4);
      glow.addColorStop(0, color);
      glow.addColorStop(0.28, `rgba(${ri}, ${gi}, ${bi}, ${alpha * 0.35})`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, size * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false, // stars should not be crushed by tone mapping
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;

  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}