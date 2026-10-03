import * as THREE from 'three';

/**
 * Maps selenographic latitude/longitude to a position on a three.js
 * `SphereGeometry`, matching that geometry's UV convention so markers, the
 * surface textures and the computed sub-solar point all agree.
 *
 * The leading minus on x is easy to get wrong and puts points on the opposite
 * side of the globe; `scripts/verify-moon-lighting.mjs` checks this against
 * THREE's real sphere vertices.
 */
export function latLonToVec(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}
