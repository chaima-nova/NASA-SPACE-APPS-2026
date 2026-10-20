import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createStarfield } from '../../lib/starfield';
import { latLonToVec } from '../../lib/globe';
import { greenwichSiderealTime, marsLighting } from '../../lib/astro';

/**
 * Mars globe for the evidence strip, the counterpart of `MoonMap` when Mars is
 * the selected comparison target.
 *
 * Surface data is the NASA/USGS Viking MDIM 2.1 colour mosaic (public domain,
 * ~232 m per pixel at the equator):
 *   -> public/mars/viking-color-2k.jpg
 * The lighting is not decorative: `marsLighting` implements NASA GISS's Mars24
 * algorithm, so the sub-solar point — and therefore the terminator, the polar
 * cap in daylight and the season in the badge — is where it actually is right
 * now. The camera starts 35 deg east of the sub-solar longitude so the globe
 * opens on its day side; drag to orbit, scroll to zoom.
 *
 * Candidates are terrestrial, so unlike `MoonMap` this scene never takes
 * markers.
 */
export function MarsMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  // Frozen per mount: the sun angle is computed once for this render.
  const now = useMemo(() => new Date(), []);
  const lighting = useMemo(() => marsLighting(now), [now]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);

    const scene = new THREE.Scene();

    // The sky is real star map geometry (NASA Deep Star Maps 2020), left at its
    // zero orientation: unlike the Moon there is no Earth-fixed sky to anchor
    // it to, so here it is background depth rather than a claim about Mars.
    const starfield = createStarfield({ siderealDeg: greenwichSiderealTime(now) });
    scene.add(starfield.group);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2000);
    camera.position.copy(latLonToVec(18, lighting.subSolarLon + 35, 4.7));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.45;
    controls.zoomSpeed = 0.7;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 9;

    // ---- Lighting: the real sub-solar point on Mars at this instant ---------
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.4);
    sun.position.copy(latLonToVec(lighting.subSolarLat, lighting.subSolarLon, 10));
    scene.add(sun);

    // Mars has no bright companion to light its night side, so the dark limb is
    // kept barely readable by a trace of ambient light rather than earthshine.
    scene.add(new THREE.AmbientLight(0x1a1210, 0.2));

    // ---- Mars ---------------------------------------------------------------
    const RADIUS = 1.5;
    const marsGeometry = new THREE.SphereGeometry(RADIUS, 160, 96);
    const marsMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
    });
    const mars = new THREE.Mesh(marsGeometry, marsMaterial);
    scene.add(mars);

    // Thin dusty halo so the disc separates from the panel's black.
    const haloGeometry = new THREE.SphereGeometry(RADIUS * 1.06, 48, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9a27a,
      transparent: true,
      opacity: 0.045,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(haloGeometry, haloMaterial));

    let disposed = false;

    new THREE.TextureLoader()
      .loadAsync('/mars/viking-color-2k.jpg')
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        marsMaterial.map = texture;
        marsMaterial.needsUpdate = true;
        marsMaterial.userData.texture = texture;
      })
      .catch(() => {
        // Leave the globe untextured rather than throwing inside the panel.
      });

    // ---- Resize -------------------------------------------------------------
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // ---- Render loop --------------------------------------------------------
    let frameId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      (marsMaterial.userData.texture as THREE.Texture | undefined)?.dispose();
      starfield.dispose();
      marsGeometry.dispose();
      marsMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [now, lighting]);

  return (
    <div className="moon-map">
      <div ref={mountRef} className="three-mount" />
      <div className="moon-phase">
        <span className="moon-phase-dot mars-phase-dot" />
        <span>
          {lighting.season} · Ls {Math.round(lighting.solarLongitude)}°
        </span>
      </div>
    </div>
  );
}
