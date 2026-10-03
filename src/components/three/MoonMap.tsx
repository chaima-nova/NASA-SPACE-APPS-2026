import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Prediction } from '../../data-contracts/types';
import { scoreColorHex } from '../../lib/colors';

interface MoonMapProps {
  predictions: Prediction[];
}

interface Marker {
  mesh: THREE.Mesh;
  pulse: THREE.Mesh;
  score: number;
}

/**
 * Topographically correct Moon globe.
 *
 * Surface data is the NASA CGI Moon Kit (public domain, LRO):
 *   - colour:  LROC WAC mosaic            -> public/moon/lroc-color-4k.jpg
 *   - terrain: LOLA 16 px/deg elevation   -> public/moon/ldem-4k.png
 * The elevation map drives both the geometric displacement (real crater rims,
 * maria and basins) and a bump map for fine shading detail. Candidate analog
 * sites are plotted on the lunar surface: lon -> azimuth, lat -> polar angle.
 *
 * Drag to orbit, scroll to zoom, hover a marker for its analog-fit score.
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

    // ---- Lighting: hard low-angle sun so relief reads strongly ---------------
    const sun = new THREE.DirectionalLight(0xfff6e8, 2.6);
    sun.position.set(5, 1.2, 4);
    scene.add(sun);
    const earthshine = new THREE.DirectionalLight(0x8fb4ff, 0.25);
    earthshine.position.set(-6, -2, -4);
    scene.add(earthshine);
    scene.add(new THREE.AmbientLight(0x1b2540, 0.5));

    // ---- Moon ---------------------------------------------------------------
    const RADIUS = 1.5;
    const moonGeometry = new THREE.SphereGeometry(RADIUS, 192, 128);
    const moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      displacementScale: 0.045,
      displacementBias: -0.0225,
      bumpScale: 0.012,
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(moon);

    // Faint halo so the globe reads against the dark panel.
    const haloGeometry = new THREE.SphereGeometry(RADIUS * 1.08, 48, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(haloGeometry, haloMaterial));

    const disposable: THREE.BufferGeometry[] = [moonGeometry, haloGeometry];
    const materials: THREE.Material[] = [moonMaterial, haloMaterial];
    const textures: THREE.Texture[] = [];
    let disposed = false;

    // ---- Real lunar surface data --------------------------------------------
    const loader = new THREE.TextureLoader();
    const loadTexture = (url: string, colorSpace: THREE.ColorSpace) =>
      loader.loadAsync(url).then((texture) => {
        texture.colorSpace = colorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.wrapS = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        if (disposed) {
          texture.dispose();
          return;
        }
        textures.push(texture);
        return texture;
      });

    // Both are 2:1 equirectangular and share the same orientation, so they can
    // be applied to the sphere directly without rotation.
    void Promise.all([
      loadTexture('/moon/lroc-color-4k.jpg', THREE.SRGBColorSpace),
      loadTexture('/moon/ldem-4k.png', THREE.NoColorSpace),
    ]).then(([colorMap, heightMap]) => {
      if (disposed || !colorMap || !heightMap) return;
      moonMaterial.map = colorMap;
      moonMaterial.displacementMap = heightMap;
      moonMaterial.bumpMap = heightMap;
      moonMaterial.needsUpdate = true;
    });

    // ---- Site markers -------------------------------------------------------
    const markerGroup = new THREE.Group();
    moon.add(markerGroup);

    const markers: Marker[] = [];

    // Matches THREE.SphereGeometry's UV mapping (and therefore the textures).
    const latLonToVec = (lat: number, lon: number, radius: number) => {
      const phi = ((90 - lat) * Math.PI) / 180;
      const theta = ((lon + 180) * Math.PI) / 180;
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
    };

    const pinGeometry = new THREE.SphereGeometry(0.052, 16, 16);
    disposable.push(pinGeometry);

    predictions.forEach((p) => {
      const position = latLonToVec(p.lat, p.lon, RADIUS + 0.02);
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
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.7, 0.4);
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
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      bloom.dispose();
      composer.dispose();
      textures.forEach((t) => t.dispose());
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
