import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadTerrainPatch, TERRAIN_PALETTE, type TerrainPatch, type TerrainSite } from '../../lib/terrain';
import { formatCoords, formatElevation, terrainLabel } from '../../lib/site';

interface SiteTerrainProps {
  /** A model prediction or a researcher's reported site — both are placeable. */
  prediction: TerrainSite;
  onClose: () => void;
}

/**
 * Vertical stretch so a 7 km patch reads as landform rather than a pancake.
 * Flat sites (Atacama's gravel plains, Qaidam's playa) get more stretch than
 * alpine ones, and the factor is always printed in the caption.
 */
function exaggerationFor(patch: TerrainPatch): number {
  const relief = Math.max(1, patch.maxElevation - patch.minElevation);
  return Math.round(Math.min(3.5, Math.max(1.5, 1500 / relief)) * 10) / 10;
}

function paletteFor(prediction: TerrainSite) {
  return TERRAIN_PALETTE[prediction.terrainType ?? 'desert'] ?? TERRAIN_PALETTE.desert;
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Box-blurred copy of the patch, used as the local "average ground" reference.
 * A vertex's height minus this reference is its curvature: positive on ridges
 * and crater rims, negative in hollows and channels. Shading by it is what
 * makes gentle terrain (Kilauea's slopes, the Dry Valleys' floors) legible
 * instead of a grey wash, and it costs one pass over 66k samples.
 */
function blurredHeights(patch: TerrainPatch, radius: number): Float32Array {
  const n = patch.size;
  const out = new Float32Array(n * n);
  const tmp = new Float32Array(n * n);
  const window = radius * 2 + 1;
  for (let y = 0; y < n; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += patch.heights[y * n + Math.min(n - 1, Math.max(0, x))];
    for (let x = 0; x < n; x++) {
      tmp[y * n + x] = sum / window;
      const drop = patch.heights[y * n + Math.min(n - 1, Math.max(0, x - radius))];
      const add = patch.heights[y * n + Math.min(n - 1, Math.max(0, x + radius + 1))];
      sum += add - drop;
    }
  }
  for (let x = 0; x < n; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(n - 1, Math.max(0, y)) * n + x];
    for (let y = 0; y < n; y++) {
      out[y * n + x] = sum / window;
      const drop = tmp[Math.min(n - 1, Math.max(0, y - radius)) * n + x];
      const add = tmp[Math.min(n - 1, Math.max(0, y + radius + 1)) * n + x];
      sum += add - drop;
    }
  }
  return out;
}

/** Bilinear height lookup on the patch grid, in metres. */
function sampleHeight(patch: TerrainPatch, u: number, v: number): number {
  const n = patch.size;
  const x = Math.max(0, Math.min(n - 1.001, u * (n - 1)));
  const y = Math.max(0, Math.min(n - 1.001, v * (n - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (cx: number, cy: number) => patch.heights[cy * n + cx];
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Immersive local view for one analog site.
 *
 * Geometry is a real elevation patch (SRTM/ASTER mosaic, ~7 km across) with the
 * site's terrain family driving colour, rock scatter and lighting. The camera
 * descends from a bird's-eye view on mount; drag/scroll takes over after.
 */
export function SiteTerrain({ prediction, onClose }: SiteTerrainProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  /** DOM caption for the site ring, positioned from its projected centre. */
  const labelRef = useRef<HTMLSpanElement>(null);
  const [patch, setPatch] = useState<TerrainPatch | null>(null);
  const [failed, setFailed] = useState(false);

  // Escape returns to the globe, matching the Back button.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reload whenever the site changes; the view is tied to one site at a time.
  useEffect(() => {
    let alive = true;
    setPatch(null);
    setFailed(false);
    loadTerrainPatch(prediction, { sizeMeters: 7000, resolution: 257 })
      .then((next) => {
        if (alive) setPatch(next);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [prediction]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !patch) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const SIZE = patch.widthMeters;
    const EXAGGERATION = exaggerationFor(patch);
    const palette = paletteFor(prediction);

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, SIZE * 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = SIZE * 0.08;
    controls.maxDistance = SIZE * 1.25;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.target.set(0, 0, 0);

    // ---- Sky ----------------------------------------------------------------
    const snow = (prediction.terrainType ?? 'desert') === 'polar';
    const horizon = new THREE.Color(snow ? 0x6f8aa6 : 0x8a6a4c);
    const zenith = new THREE.Color(0x04070d);
    // Sun fairly high so flat ground still reads: slope shading is what should
    // separate the landforms, not a raking light that flattens whole patches.
    const sunDirection = new THREE.Vector3(0.44, 0.64, 0.33).normalize();

    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uHorizon: { value: horizon },
        uZenith: { value: zenith },
        uSunDir: { value: sunDirection },
        uSunColor: { value: new THREE.Color(snow ? 0xdfe9ff : 0xffd9a3) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 1.6 + 0.06, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
          float sun = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 240.0);
          col += uSunColor * sun * 1.6;
          float haze = pow(1.0 - clamp(vDir.y, 0.0, 1.0), 3.0);
          col += uHorizon * haze * 0.22;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(SIZE * 5.5, 32, 16), skyMaterial);
    scene.add(sky);
    scene.fog = new THREE.Fog(horizon.getHex(), SIZE * 1.35, SIZE * 3.6);

    // ---- Lights -------------------------------------------------------------
    const sun = new THREE.DirectionalLight(snow ? 0xdce8ff : 0xffe0b8, 2.8);
    sun.position.copy(sunDirection).multiplyScalar(SIZE * 1.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadowSpan = SIZE * 0.62;
    sun.shadow.camera.left = -shadowSpan;
    sun.shadow.camera.right = shadowSpan;
    sun.shadow.camera.top = shadowSpan;
    sun.shadow.camera.bottom = -shadowSpan;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = SIZE * 3;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(snow ? 0x9dbadd : 0x7f9fc4, 0x241a12, 0.55));
    scene.add(new THREE.AmbientLight(0x0b1018, 0.4));

    // ---- Geometry -----------------------------------------------------------
    const n = patch.size;
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, n - 1, n - 1);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position as THREE.BufferAttribute;
    const meanElevation = (patch.minElevation + patch.maxElevation) / 2;
    const relief = Math.max(1, patch.maxElevation - patch.minElevation);
    const colors = new Float32Array(n * n * 3);
    const low = new THREE.Color().setRGB(palette.low[0] / 255, palette.low[1] / 255, palette.low[2] / 255, THREE.SRGBColorSpace);
    const high = new THREE.Color().setRGB(palette.high[0] / 255, palette.high[1] / 255, palette.high[2] / 255, THREE.SRGBColorSpace);
    const rock = new THREE.Color().setRGB(palette.rock[0] / 255, palette.rock[1] / 255, palette.rock[2] / 255, THREE.SRGBColorSpace);
    const tint = new THREE.Color();
    const dither = seeded(hash(prediction.id));
    const averaged = blurredHeights(patch, 4);

    const step = SIZE / (n - 1);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const index = row * n + col;
        const h = patch.heights[index];
        position.setY(index, (h - meanElevation) * EXAGGERATION);

        const left = patch.heights[row * n + Math.max(0, col - 1)];
        const right = patch.heights[row * n + Math.min(n - 1, col + 1)];
        const up = patch.heights[Math.max(0, row - 1) * n + col];
        const down = patch.heights[Math.min(n - 1, row + 1) * n + col];
        // Slope from the *real* heights, before exaggeration.
        const slope = Math.atan(Math.hypot((right - left) / (2 * step), (down - up) / (2 * step)));

        const t = Math.min(1, Math.max(0, (h - patch.minElevation) / relief));
        tint.copy(low).lerp(high, Math.pow(t, 0.7));
        tint.lerp(rock, Math.min(0.85, slope * 2.2));

        // Curvature shading: ridges and rims catch light, hollows sit back.
        // Normalised by relief so the effect reads the same on a 30 m playa
        // as on a 1,200 m valley wall.
        const curvature = (h - averaged[index]) / relief;
        const shade = 1 + Math.max(-0.42, Math.min(0.5, curvature * 3.6));
        const grain = (0.94 + dither() * 0.12) * shade;
        colors[index * 3] = tint.r * grain;
        colors[index * 3 + 1] = tint.g * grain;
        colors[index * 3 + 2] = tint.b * grain;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(geometry, groundMaterial);
    ground.receiveShadow = true;
    ground.castShadow = true;
    scene.add(ground);

    // ---- Rocks --------------------------------------------------------------
    const rockCount = 220;
    const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.03, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const random = seeded(hash(prediction.id + 'rocks'));
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3();
    const rockColor = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < rockCount && guard < rockCount * 12) {
      guard++;
      const u = 0.06 + random() * 0.88;
      const v = 0.06 + random() * 0.88;
      const h = sampleHeight(patch, u, v);
      const hx = sampleHeight(patch, u + 0.004, v);
      const hz = sampleHeight(patch, u, v + 0.004);
      const slope = Math.hypot(hx - h, hz - h) / (0.004 * SIZE);
      if (slope > 0.55) continue;
      const x = (u - 0.5) * SIZE;
      const z = (v - 0.5) * SIZE;
      const size = 2 + random() * (snow ? 9 : 14);
      quaternion.setFromEuler(
        new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      );
      scaleVec.set(size, size * (0.45 + random() * 0.5), size * (0.7 + random() * 0.6));
      matrix.compose(
        new THREE.Vector3(x, (h - meanElevation) * EXAGGERATION + size * 0.25, z),
        quaternion,
        scaleVec,
      );
      rocks.setMatrixAt(placed, matrix);
      rockColor
        .setRGB(palette.rock[0] / 255, palette.rock[1] / 255, palette.rock[2] / 255, THREE.SRGBColorSpace)
        .offsetHSL(0, 0, (random() - 0.5) * 0.12);
      rocks.setColorAt(placed, rockColor);
      placed++;
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    scene.add(rocks);

    // ---- Site marker --------------------------------------------------------
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(SIZE * 0.012, SIZE * 0.015, 64),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 3;
    scene.add(marker);

    // The caption is DOM rather than a texture: text stays crisp at any zoom
    // and matches the rest of the interface. It is projected onto the ring
    // every frame below, clearing the ring's own screen footprint.
    const markerOnScreen = new THREE.Vector3();
    const ringEdge = new THREE.Vector3();
    const RING_OUTER = SIZE * 0.015;

    // ---- Camera intro -------------------------------------------------------
    const startPos = new THREE.Vector3(SIZE * 0.72, SIZE * 1.05, SIZE * 0.8);
    const endPos = new THREE.Vector3(SIZE * 0.3, SIZE * 0.2, SIZE * 0.36);
    camera.position.copy(reduceMotion ? endPos : startPos);
    camera.lookAt(0, 0, 0);
    controls.update();

    let intro = reduceMotion ? 1 : 0;
    const introDuration = 1.7;
    const cancelIntro = () => {
      intro = 1;
    };
    renderer.domElement.addEventListener('pointerdown', cancelIntro);
    renderer.domElement.addEventListener('wheel', cancelIntro, { passive: true });

    // ---- Resize -------------------------------------------------------------
    // Screen size is tracked for the caption's projection, so a resize does not
    // leave the label pinned to the old viewport.
    let viewW = width;
    let viewH = height;
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      viewW = w;
      viewH = h;
    });
    resizeObserver.observe(mount);

    // ---- Loop ---------------------------------------------------------------
    const clock = new THREE.Clock();
    let frameId = 0;
    const animate = () => {
      const delta = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;

      if (intro < 1) {
        intro = Math.min(1, intro + delta / introDuration);
        const t = intro * intro * (3 - 2 * intro);
        camera.position.lerpVectors(startPos, endPos, t);
        camera.lookAt(0, 0, 0);
      }

      marker.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.12);

      // Keep the coordinates caption above the ring. Its clearance comes from
      // the ring's projected size, not a fixed number of pixels, so zooming in
      // until the ring fills more of the screen does not bury the caption.
      const label = labelRef.current;
      if (label) {
        markerOnScreen.copy(marker.position).project(camera);
        const x = (markerOnScreen.x * 0.5 + 0.5) * viewW;
        const y = (-markerOnScreen.y * 0.5 + 0.5) * viewH;

        let ringRise = 0;
        for (const [dx, dz] of [
          [RING_OUTER, 0],
          [-RING_OUTER, 0],
          [0, RING_OUTER],
          [0, -RING_OUTER],
        ]) {
          ringEdge
            .set(marker.position.x + dx, marker.position.y, marker.position.z + dz)
            .project(camera);
          const edgeY = (-ringEdge.y * 0.5 + 0.5) * viewH;
          ringRise = Math.max(ringRise, Math.abs(y - edgeY));
        }

        const bottom = y - ringRise * marker.scale.x - 12;
        const onScreen =
          markerOnScreen.z < 1 && x > 0 && x < viewW && bottom > 0 && y < viewH;
        label.style.opacity = onScreen ? '1' : '0';
        if (onScreen) {
          label.style.transform = `translate(${x}px, ${bottom}px) translate(-50%, -100%)`;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', cancelIntro);
      renderer.domElement.removeEventListener('wheel', cancelIntro);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose?.();
      });
      skyMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [patch, prediction]);

  const reliefM = patch ? Math.round(patch.maxElevation - patch.minElevation) : 0;

  return (
    <div className="terrain-view">
      <div ref={mountRef} className="terrain-canvas">
        {/* Duplicated in the header for readers, so it is visual-only. */}
        <span ref={labelRef} className="terrain-site-label" aria-hidden="true">
          {formatCoords(prediction.lat, prediction.lon)}
        </span>
      </div>

      {!patch ? (
        <div className={`terrain-loading${failed ? ' is-failed' : ''}`}>
          <span className="terrain-spinner" aria-hidden="true" />
          <p>{failed ? 'Terrain unavailable' : 'Building terrain from elevation tiles'}</p>
          <span className="terrain-loading-sub">
            {failed ? 'The site view could not start.' : `${prediction.siteName}`}
          </span>
        </div>
      ) : null}

      <div className="terrain-top">
        <div className="terrain-title">
          <span className="kicker">Site terrain · 3D</span>
          <h3>{prediction.siteName}</h3>
          <p>
            {formatCoords(prediction.lat, prediction.lon)} · {terrainLabel(prediction)} ·{' '}
            {formatElevation(prediction.elevationM)}
          </p>
        </div>
        <button type="button" className="terrain-back" onClick={onClose}>
          <span aria-hidden="true">←</span> Back to Globe
        </button>
      </div>

      <div className="terrain-stats">
        <div>
          <span>Relief</span>
          <strong>{patch ? `${reliefM.toLocaleString('en-US')} m` : '—'}</strong>
        </div>
        <div>
          <span>Mean slope</span>
          <strong>{patch ? `${patch.meanSlopeDeg.toFixed(1)}°` : '—'}</strong>
        </div>
        <div>
          <span>Elevation</span>
          <strong>
            {patch
              ? `${Math.round(patch.minElevation).toLocaleString('en-US')}–${Math.round(
                  patch.maxElevation,
                ).toLocaleString('en-US')} m`
              : '—'}
          </strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{patch?.source === 'dem' ? 'SRTM 30 m' : patch ? 'Procedural' : '—'}</strong>
        </div>
      </div>

      <p className="terrain-hint">
        {patch?.attribution ?? 'Elevation tiles'} · vertical exaggeration ×
        {patch ? exaggerationFor(patch).toFixed(1) : '—'} · drag to orbit, scroll to zoom
      </p>
    </div>
  );
}
