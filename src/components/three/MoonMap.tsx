import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Prediction } from '../../data-contracts/types';
import { scoreColorHex } from '../../lib/colors';
import { createMoonTexture } from '../../lib/moonTexture';

interface MoonMapProps {
  predictions: Prediction[];
}

interface Marker {
  mesh: THREE.Mesh;
  pulse: THREE.Mesh;
  score: number;
}

/**
 * Interactive three.js Moon globe. Analog candidate sites are plotted on the
 * lunar surface (lon -> azimuth, lat -> polar angle), so the map reads as a
 * Moon base planning view rather than a terrestrial map. Drag to orbit, scroll
 * to zoom, click a marker to inspect its analog-fit score.
 */
export function MoonMap({ predictions }: MoonMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const tip = tipRef.current;
    if (!mount || !tip) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.1, 1000);
    camera.position.set(0, 1.2, 4.6);

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

    // ---- Lighting -----------------------------------------------------------
    const sun = new THREE.DirectionalLight(0xfff6e8, 2.4);
    sun.position.set(5, 1.5, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fb4ff, 0.35);
    fill.position.set(-6, -2, -4);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0x223055, 0.6));

    // ---- Moon ---------------------------------------------------------------
    const moonTexture = createMoonTexture();
    const moonGeometry = new THREE.SphereGeometry(1.5, 96, 96);
    const moonMaterial = new THREE.MeshStandardMaterial({
      map: moonTexture,
      color: 0xdfe3ec,
      roughness: 0.95,
      metalness: 0.02,
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(moon);

    // Faint halo so the globe reads against the dark panel.
    const haloGeometry = new THREE.SphereGeometry(1.62, 48, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(haloGeometry, haloMaterial));

    // ---- Site markers -------------------------------------------------------
    const RADIUS = 1.52;
    const markerGroup = new THREE.Group();
    moon.add(markerGroup);

    const disposable: THREE.BufferGeometry[] = [moonGeometry, haloGeometry];
    const materials: THREE.Material[] = [moonMaterial, haloMaterial];
    const markers: Marker[] = [];

    const latLonToVec = (lat: number, lon: number, radius: number) => {
      const phi = ((90 - lat) * Math.PI) / 180;
      const theta = ((lon + 180) * Math.PI) / 180;
      return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
    };

    const pinGeometry = new THREE.SphereGeometry(0.052, 16, 16);
    disposable.push(pinGeometry);

    predictions.forEach((p) => {
      const position = latLonToVec(p.lat, p.lon, RADIUS);
      const color = scoreColorHex(p.analogScore);

      const material = new THREE.MeshBasicMaterial({ color });
      materials.push(material);
      const mesh = new THREE.Mesh(pinGeometry, material);
      mesh.position.copy(position);
      mesh.userData = {
        siteName: p.siteName,
        label: p.label,
        focusArea: p.focusArea,
        analogScore: p.analogScore,
      };
      markerGroup.add(mesh);

      // Pulsing ring that expands out of the surface.
      const pulseGeometry = new THREE.RingGeometry(0.06, 0.1, 32);
      disposable.push(pulseGeometry);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      materials.push(pulseMaterial);
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.copy(position);
      pulse.lookAt(0, 0, 0);
      markerGroup.add(pulse);

      markers.push({ mesh, pulse, score: p.analogScore });
    });

    // ---- Click / hover interaction -----------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickTargets = markers.map((m) => m.mesh);
    let hovered: THREE.Mesh | null = null;

    const toLocalPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (event: PointerEvent) => {
      toLocalPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickTargets, false)[0];

      if (hit) {
        const data = hit.object.userData as {
          siteName: string;
          label: string;
          focusArea: string;
          analogScore: number;
        };
        tip.style.opacity = '1';
        tip.style.transform = `translate(${event.offsetX + 14}px, ${event.offsetY + 14}px)`;
        tip.innerHTML =
          `<strong>${data.siteName}</strong><br/>` +
          `Analog fit: ${data.label} (${data.analogScore.toFixed(2)})<br/>` +
          `<span class="moon-tip-meta">${data.focusArea.replace(/-/g, ' ')}</span>`;
        renderer.domElement.style.cursor = 'pointer';
      } else {
        tip.style.opacity = '0';
        renderer.domElement.style.cursor = 'grab';
      }

      if (hovered && hovered !== hit?.object) {
        hovered.scale.setScalar(1);
      }
      hovered = (hit?.object as THREE.Mesh) ?? null;
      if (hovered) hovered.scale.setScalar(1.5);
    };

    const onPointerLeave = () => {
      tip.style.opacity = '0';
      if (hovered) hovered.scale.setScalar(1);
      hovered = null;
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    // ---- Post-processing (subtle bloom on the markers) ----------------------
    const composer = new EffectComposer(renderer);
    composer.setSize(width, height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.6,
      0.7,
      0.35,
    );
    composer.addPass(bloom);

    // ---- Resize -------------------------------------------------------------
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // ---- Render loop --------------------------------------------------------
    const clock = new THREE.Clock();
    let frameId = 0;
    const animate = () => {
      const t = clock.getElapsedTime();
      controls.update();

      markers.forEach((m, i) => {
        const phase = (t * 0.9 + i * 0.28) % 1;
        const s = 0.7 + phase * 1.6;
        m.pulse.scale.setScalar(s);
        (m.pulse.material as THREE.MeshBasicMaterial).opacity =
          0.5 * (1 - phase) * (0.4 + m.score * 0.6);
      });

      composer.render();
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      bloom.dispose();
      composer.dispose();
      moonTexture.dispose();
      disposable.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [predictions]);

  return (
    <div className="moon-map">
      <div ref={mountRef} className="three-mount" />
      <div ref={tipRef} className="moon-tip" />
    </div>
  );
}
