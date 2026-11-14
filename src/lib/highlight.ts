import * as THREE from 'three';
import type { TargetSite } from '../data-contracts/types';
import { latLonToVec } from './globe';

/**
 * The lit marker that answers "where on the target body does this terrestrial
 * site correspond to?".
 *
 * Built once per scene and reused as the selection changes: moving a dot is
 * cheap, rebuilding a textured globe is not. The group is parented to the body
 * mesh by the caller, so a rotation of the body carries the marker with it.
 */
export interface TargetMarker {
  group: THREE.Group;
  /** Place the marker at a target-body location, or hide it with null. */
  set(site: TargetSite | null): void;
  /** Animate the ring; call once per frame with elapsed seconds. */
  tick(elapsed: number): void;
  dispose(): void;
}

export function createTargetMarker(radius: number): TargetMarker {
  const group = new THREE.Group();
  group.visible = false;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // The dot itself: near-white so it reads as lit rather than painted on.
  const dotGeometry = new THREE.SphereGeometry(0.05, 20, 20);
  geometries.push(dotGeometry);
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xbdf3ff });
  materials.push(dotMaterial);
  group.add(new THREE.Mesh(dotGeometry, dotMaterial));

  // Soft halo, so the dot glows against the dark limb.
  const glowGeometry = new THREE.SphereGeometry(0.105, 24, 24);
  geometries.push(glowGeometry);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x7fd8ff,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(glowMaterial);
  group.add(new THREE.Mesh(glowGeometry, glowMaterial));

  // Expanding ring, the same visual language as the candidate pins.
  const ringGeometry = new THREE.RingGeometry(0.1, 0.135, 48);
  geometries.push(ringGeometry);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x9beaff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  materials.push(ringMaterial);
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  group.add(ring);

  let phase = 0;

  return {
    group,

    set(site) {
      if (!site) {
        group.visible = false;
        return;
      }
      group.visible = true;
      group.position.copy(latLonToVec(site.lat, site.lon, radius + 0.04));
      // +Z faces the body centre, so the ring lies flat on the surface.
      group.lookAt(0, 0, 0);
      phase = 0;
    },

    tick(elapsed) {
      if (!group.visible) return;
      phase = (elapsed * 0.55) % 1;
      ring.scale.setScalar(1 + phase * 2.4);
      ringMaterial.opacity = 0.65 * (1 - phase);
    },

    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
