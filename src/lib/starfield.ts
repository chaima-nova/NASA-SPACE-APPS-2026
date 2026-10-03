import * as THREE from 'three';

/**
 * Real star background for the Moon globe.
 *
 * Uses NASA's "Deep Star Maps 2020" (public domain, NASA SVS 4851), which plots
 * the position, brightness and colour of 1.7 billion stars from Hipparcos-2,
 * Tycho-2 and Gaia DR2. So the Milky Way band, the bright galactic centre and
 * the dark dust lanes are where they actually are, rather than decorative.
 *
 * Rendered on a large inverted sphere, so the sky is real scene geometry: it
 * stays put while the globe rotates under the camera.
 *
 * Orientation caveat: the map is in celestial coordinates centred on 0h right
 * ascension, while the globe is freely rotatable with no fixed date, time or
 * observer. The sky is therefore the real one but not pinned to a real epoch
 * or viewing location. The star *content* is accurate; the *orientation* is
 * not anchored.
 */

export interface Starfield {
  group: THREE.Group;
  dispose: () => void;
}

export function createStarfield(
  radius = 60,
  url = '/moon/starmap-4k.jpg',
): Starfield {
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

  new THREE.TextureLoader().loadAsync(url).then((loaded) => {
    if (disposed) {
      loaded.dispose();
      return;
    }
    texture = loaded;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    material.map = texture;
    material.needsUpdate = true;
  }).catch(() => {
    // Leave the sky black rather than breaking the scene.
  });

  return {
    group,
    dispose: () => {
      disposed = true;
      geometry.dispose();
      material.dispose();
      texture?.dispose();
    },
  };
}
