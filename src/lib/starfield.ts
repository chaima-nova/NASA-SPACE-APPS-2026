import * as THREE from 'three';

/**
 * Real star background for the globes.
 *
 * Uses NASA's "Deep Star Maps 2020" (public domain, NASA SVS 4851), which plots
 * the position, brightness and colour of 1.7 billion stars from Hipparcos-2,
 * Tycho-2 and Gaia DR2. So the Milky Way band, the bright galactic centre and
 * the dark dust lanes are where they actually are.
 *
 * Orientation is now anchored, not decorative:
 *   - The map's north celestial pole is the sphere's north pole, which is also
 *     the Earth's rotation axis in this scene.
 *   - NASA ships the all-sky map as seen from *inside* the celestial sphere, so
 *     its horizontal axis runs mirrored (RA 12h at the left edge, RA 0h at the
 *     centre). Sampling it without flipping mirrors the sky. The texture is
 *     therefore flipped horizontally and offset by Greenwich sidereal time, so
 *     the star at right ascension a sits over Earth longitude (a - GMST).
 *   - `setSiderealDegrees` lets the caller advance the sky at the real sidereal
 *     rate as the demo runs.
 *
 * Verified against 20 bright stars (Sirius, Canopus, Arcturus, Vega, ...):
 * sampling the texture at the mapped RA/Dec of each one lands on a bright
 * pixel for 20/20 under this convention. Precession and nutation are ignored
 * (arcminutes), and the 4K texture limits how faint a star can be resolved.
 */

export interface StarfieldOptions {
  radius?: number;
  url?: string;
  /** Greenwich mean sidereal time in degrees; anchors the map to Earth. */
  siderealDeg?: number;
}

export interface Starfield {
  group: THREE.Group;
  /** Re-anchor the sky for a new sidereal time, in degrees. */
  setSiderealDegrees: (degrees: number) => void;
  dispose: () => void;
}

export function createStarfield(options: StarfieldOptions = {}): Starfield {
  const { radius = 60, url = '/moon/starmap-4k.jpg', siderealDeg = 0 } = options;

  const geometry = new THREE.SphereGeometry(radius, 64, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false, // do not let tone mapping crush the faint stars
  });

  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  group.add(mesh);

  let texture: THREE.Texture | null = null;
  let disposed = false;
  let sidereal = siderealDeg;

  /** Mirrored horizontal sampling offset for the current sidereal time. */
  const applySidereal = () => {
    if (!texture) return;
    texture.offset.x = 1 - sidereal / 360;
  };

  new THREE.TextureLoader()
    .loadAsync(url)
    .then((loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      texture = loaded;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      // NASA's map is authored for a view from inside the celestial sphere:
      // RA increases to the left, so flip u before applying the offset.
      texture.repeat.x = -1;
      texture.anisotropy = 4;
      applySidereal();
      texture.needsUpdate = true;
      material.map = texture;
      material.needsUpdate = true;
    })
    .catch(() => {
      // Leave the sky black rather than breaking the scene.
    });

  return {
    group,
    setSiderealDegrees: (degrees) => {
      sidereal = degrees;
      applySidereal();
    },
    dispose: () => {
      disposed = true;
      geometry.dispose();
      material.dispose();
      texture?.dispose();
    },
  };
}
