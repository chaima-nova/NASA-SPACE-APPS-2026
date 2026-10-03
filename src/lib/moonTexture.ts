import * as THREE from 'three';

/**
 * Procedurally paints an equirectangular lunar surface texture (maria, craters
 * with bright ejecta rims, fine regolith noise) so the Moon globe needs no
 * external image assets. Returned as a THREE.CanvasTexture ready to dispose.
 */
export function createMoonTexture(width = 2048, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable for Moon texture');

  // Deterministic pseudo-random so the Moon looks the same on every mount.
  let seed = 20261003;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Base regolith tone.
  ctx.fillStyle = '#c9ccd3';
  ctx.fillRect(0, 0, width, height);

  // Broad maria: dark basalt plains, clustered in the northern hemisphere.
  const maria: { x: number; y: number; r: number; a: number }[] = [
    { x: 0.28, y: 0.32, r: 0.11, a: 0.55 },
    { x: 0.36, y: 0.28, r: 0.08, a: 0.5 },
    { x: 0.22, y: 0.4, r: 0.07, a: 0.45 },
    { x: 0.52, y: 0.3, r: 0.06, a: 0.4 },
    { x: 0.63, y: 0.36, r: 0.09, a: 0.5 },
    { x: 0.72, y: 0.3, r: 0.06, a: 0.42 },
    { x: 0.46, y: 0.44, r: 0.05, a: 0.35 },
    { x: 0.86, y: 0.42, r: 0.05, a: 0.3 },
  ];
  maria.forEach(({ x, y, r, a }) => {
    const cx = x * width;
    const cy = y * height;
    const rad = r * width;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, `rgba(74, 80, 96, ${a})`);
    grad.addColorStop(0.7, `rgba(90, 96, 112, ${a * 0.55})`);
    grad.addColorStop(1, 'rgba(90, 96, 112, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  });

  // Craters: darker floor, brighter rim and a soft ejecta blanket.
  const craterCount = 260;
  for (let i = 0; i < craterCount; i++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const r = 3 + Math.pow(rand(), 3) * 34;

    const ejecta = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.4);
    ejecta.addColorStop(0, 'rgba(236, 238, 242, 0.28)');
    ejecta.addColorStop(1, 'rgba(236, 238, 242, 0)');
    ctx.fillStyle = ejecta;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(104, 110, 124, ${0.16 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(244, 246, 250, ${0.2 + rand() * 0.25})`;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fine regolith grain, applied straight to the pixels for speed.
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
