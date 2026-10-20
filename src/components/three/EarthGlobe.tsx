import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Prediction } from '../../data-contracts/types';
import { scoreColorHex } from '../../lib/colors';
import { reducedMotion } from '../../lib/accessibility';
import { createStarfield } from '../../lib/starfield';
import { latLonToVec } from '../../lib/globe';
import { trueColorUrl } from '../../lib/earthImagery';
import {
  earthLighting,
  greenwichSiderealTime,
  SIDEREAL_DEG_PER_SEC,
} from '../../lib/astro';
import {
  fitFor,
  formatScore,
  TARGET_LABELS,
  terrainLabel,
  type Target,
} from '../../lib/site';

/** What the globe reports after each NASA imagery request. */
export interface ImageryState {
  date: string;
  live: boolean;
}

interface EarthGlobeProps {
  predictions: Prediction[];
  selectedId: string | null;
  target: Target;
  onSelect: (id: string) => void;
  /** UTC day of NASA VIIRS true-colour imagery to show on the globe. */
  imageryDate: string;
  onImagery: (state: ImageryState) => void;
  /** Live cloud cover layer, off by default so the surface reads cleanly. */
  showClouds: boolean;
  onToggleClouds: () => void;
  /** Fired after the camera has dived onto a beacon, so the terrain can open. */
  onOpenSite: (id: string) => void;
  /** Researcher-reported candidates, drawn as rings rather than beacons. */
  reportedSites: ReportedMarker[];
  /** Increment to pull the camera back out to the default view. */
  homeSignal: number;
}

/** A reported site, pre-flattened for the marker layer. */
export interface ReportedMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  terrain: string;
  targets: string;
}

/** Amber, the one accent no score band uses, so a report never reads as a fit. */
const REPORTED_COLOR = 0xfbbf24;

/**
 * Default framing.
 *
 * The old framing sat at 5.53 units from a sphere of radius 1.55, which left
 * the limb almost touching the panel edges. Pulling back to 6.81 makes the
 * globe subtend 0.8x what it did — the apparent size of a sphere falls off as
 * R / sqrt(d^2 - R^2), so this is exactly 20% smaller on screen — while keeping
 * the same direction, so the default longitude is unchanged.
 */
const HOME_DISTANCE = 6.81;
const HOME = new THREE.Vector3(0.9, 1.3, 5.3).setLength(HOME_DISTANCE);

/**
 * How close, in CSS pixels, the pointer has to get to a beacon's centre.
 *
 * Picking used to be a raycast against the sprite, which tests the whole quad
 * including its glow: measured in the running globe that came to a ~34 px
 * radius, so three sites a few degrees apart all answered with whichever
 * sprite happened to be nearest the camera — one name for the whole cluster.
 * 14 px keeps a 28 px target around each dot, close enough to the visible core
 * that neighbouring beacons resolve to themselves.
 */
const PICK_RADIUS_PX = 14;

interface GlobeApi {
  rebuild: (items: MarkerItem[]) => void;
  select: (id: string | null) => void;
  reset: () => void;
  returnHome: () => void;
  setImagery: (date: string) => void;
  setClouds: (on: boolean) => void;
}

/** Camera move used for the dive into a site and the pull back out. */
interface Tween {
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  duration: number;
  onDone?: () => void;
}

interface MarkerItem {
  id: string;
  name: string;
  lat: number;
  lon: number;
  fit: number;
  label: string;
  terrain: string;
  /** Model-scored beacon, or an unscored researcher report. */
  kind: 'model' | 'reported';
  /** Tooltip detail line; built by the caller so each kind reads correctly. */
  meta: string;
}

/** Soft radial dot: white core, coloured halo. Generated once, shared. */
function createMarkerTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.16, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.35)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Hollow ring: the marker for a researcher-reported site. Deliberately a
 * different shape from the model beacons — an unscored candidate must not look
 * like a scored one — and still readable at a glance against bright ground.
 */
function createRingTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Hero Earth globe.
 *
 * The base surface is NASA's cloud-free Blue Marble. A "Clouds" toggle fades
 * in the actual VIIRS true-colour mosaic for the chosen UTC day, streamed from
 * NASA GIBS — the real weather over the real land, and nothing when the
 * network is unavailable.
 * The terminator comes from the real sub-solar point for the current instant,
 * and candidate sites are drawn as fit-coloured beacons on the actual Earth —
 * they are terrestrial sites, so they belong on this globe and not on the Moon.
 *
 * Drag to orbit, scroll to zoom, click a beacon to open its dossier.
 */
export function EarthGlobe({
  predictions,
  selectedId,
  target,
  onSelect,
  imageryDate,
  onImagery,
  showClouds,
  onToggleClouds,
  onOpenSite,
  reportedSites,
  homeSignal,
}: EarthGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GlobeApi | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onOpenSiteRef = useRef(onOpenSite);
  onOpenSiteRef.current = onOpenSite;
  const onImageryRef = useRef(onImagery);
  onImageryRef.current = onImagery;
  // Read inside the long-lived scene handlers without rebuilding the scene.
  const targetRef = useRef(target);
  targetRef.current = target;

  // Scene is built once; markers are rebuilt when filters or the target change.
  useEffect(() => {
    const mount = mountRef.current;
    const tip = tipRef.current;
    if (!mount || !tip) return;

    const reduceMotion = reducedMotion();
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);

    const scene = new THREE.Scene();

    // The sky is anchored to the real sidereal time, so the Milky Way and the
    // bright stars sit over the longitudes they actually sit over right now.
    const now = new Date();
    const gmst = greenwichSiderealTime(now);
    const starfield = createStarfield({
      radius: 90,
      url: '/moon/starmap-4k.jpg',
      siderealDeg: gmst,
    });
    scene.add(starfield.group);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 400);
    // Far enough back that the whole limb is visible with margin; the focus
    // animation keeps this distance, it only changes the viewing longitude.
    camera.position.copy(HOME);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Colours are authored in the score ramp, so skip tone mapping: the
    // beacons stay exactly the colours the rest of the UI uses.
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.7;
    controls.enablePan = false;
    controls.minDistance = 2.7;
    // Same headroom above the default framing as before (7.5 at the old
    // 5.53), so a visitor can still push the globe away as far as they could.
    controls.maxDistance = 9.4;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.32;

    // The camera stops drifting as soon as the visitor takes control.
    const stopSpin = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopSpin);

    // ---- Earth -------------------------------------------------------------
    // Unlit day/night shader with real data:
    //   - Blue Marble albedo (day) — the cloud-free base
    //   - VIIRS true colour (optional) — the same Earth with that day's clouds
    //   - Black Marble city lights (night)
    //   - a terrain normal map, which gives mountains real relief at the limb
    // Deliberately no specular glint: a shiny ocean reads as glass, not rock.
    // The terminator still comes from the live sub-solar point; the night side
    // keeps a readable floor so sites on the dark hemisphere stay visible.
    const RADIUS = 1.55;
    const earthGeometry = new THREE.SphereGeometry(RADIUS, 192, 128);

    const makePlaceholder = (rgba: [number, number, number, number], srgb = false) => {
      const texture = new THREE.DataTexture(
        new Uint8Array(rgba),
        1,
        1,
        THREE.RGBAFormat,
      );
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      return texture;
    };

    // Ocean-blue, black and a flat normal, until the real maps land.
    const dayPlaceholder = makePlaceholder([18, 48, 78, 255], true);
    const cloudsPlaceholder = makePlaceholder([18, 48, 78, 255], true);
    const nightPlaceholder = makePlaceholder([0, 0, 0, 255]);
    const normalPlaceholder = makePlaceholder([128, 128, 255, 255]);

    const lighting = earthLighting(now);
    const sunDirection = latLonToVec(lighting.subSolarLat, lighting.subSolarLon, 1).normalize();

    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: dayPlaceholder },
        uClouds: { value: cloudsPlaceholder },
        uCloudsMix: { value: 0 },
        uNight: { value: nightPlaceholder },
        uNormal: { value: normalPlaceholder },
        uSunDir: { value: sunDirection },
        uNormalStrength: { value: 0.55 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform sampler2D uClouds;
        uniform float uCloudsMix;
        uniform sampler2D uNight;
        uniform sampler2D uNormal;
        uniform vec3 uSunDir;
        uniform float uNormalStrength;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 N = normalize(vWorldNormal);

          // Analytic tangent frame on the sphere: +u is east, +v is north.
          // The fallback keeps the poles finite where the cross product dies.
          vec3 east = cross(vec3(0.0, 1.0, 0.0), N);
          float eastLength = length(east);
          east = eastLength > 1e-4 ? east / eastLength : vec3(1.0, 0.0, 0.0);
          vec3 north = normalize(cross(N, east));

          vec3 normalSample = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
          N = normalize(
            N + (east * normalSample.x + north * normalSample.y) * uNormalStrength
          );

          vec3 sunDir = normalize(uSunDir);
          vec3 V = normalize(cameraPosition - vWorldPos);

          // Cloud-free mosaic by default; the live satellite pass fades in on
          // top when the Clouds toggle is on.
          vec3 base = texture2D(uMap, vUv).rgb;
          vec3 pass = texture2D(uClouds, vUv).rgb;
          // The daily pass has no data near the poles and in a few swath gaps;
          // those texels are pure black. Keep the base map there, and feather
          // the pass out before its coverage ends (about 72 degrees), so the
          // mosaic edge never draws a hard circle on the globe.
          float passCoverage = smoothstep(0.002, 0.02, max(max(pass.r, pass.g), pass.b));
          passCoverage *= 1.0 - smoothstep(0.88, 0.95, abs(N.y));
          vec3 albedo = mix(base, pass, uCloudsMix * passCoverage);
          float ndl = dot(N, sunDir);
          float day = smoothstep(-0.16, 0.24, ndl);

          vec3 color = albedo * (0.13 + 1.02 * day);

          // City lights, fading out through twilight.
          vec3 night = texture2D(uNight, vUv).rgb;
          float nightMask = pow(1.0 - day, 2.2);
          color += night * vec3(1.0, 0.84, 0.58) * nightMask * 1.9;

          // Only a whisper of cool fill on the night side: a strong fill turns
          // the polar night into a flat blue disc with a hard edge. Night is
          // carried by the city lights and the dim surface instead.
          color += vec3(0.004, 0.011, 0.024) * (1.0 - day);

          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          color *= 1.0 - fresnel * 0.3;

          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // ---- Surface layers ----------------------------------------------------
    // Each map swaps in as soon as it decodes; the placeholders keep the globe
    // presentable if one of them fails to load.
    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    let disposed = false;

    /** The live GIBS mosaic, once it has decoded. Null until clouds are asked for. */
    let liveTexture: THREE.Texture | null = null;
    /** Which UTC day `liveTexture` holds, so re-toggling does not re-download. */
    let liveDate: string | null = null;
    /** Fade target for the cloud layer; the render loop eases toward it. */
    let cloudsTarget = 0;
    // Bumped on every date change so a slow earlier request cannot overwrite a
    // newer one.
    let imageryToken = 0;

    const prepare = (texture: THREE.Texture, colorSpace: THREE.ColorSpace) => {
      texture.colorSpace = colorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.wrapS = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      textures.push(texture);
    };

    const loadLayer = (url: string, colorSpace: THREE.ColorSpace, uniform: string) =>
      loader
        .loadAsync(url)
        .then((texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          prepare(texture, colorSpace);
          earthMaterial.uniforms[uniform].value = texture;
        })
        .catch(() => {
          // Keep the placeholder layer rather than breaking the scene.
        });

    /**
     * Detail of the global mosaic. VIIRS itself resolves ~375 m, but one
     * equirectangular texture is what the sphere can hold: 6144 px doubles the
     * linear detail of the old 3072 request, while touch devices and GPUs with
     * a 4096 texture limit stay at 4096 so the layer still fits in memory.
     */
    const imageryWidth = Math.min(
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720 ? 4096 : 6144,
      renderer.capabilities.maxTextureSize,
    );

    /**
     * Pulls that day's clouds from NASA GIBS. One WMS request returns the whole
     * 2:1 mosaic, so this is a single texture download.
     */
    const setImagery = (date: string) => {
      if (date === liveDate && liveTexture) {
        onImageryRef.current({ date, live: true });
        return;
      }
      const token = ++imageryToken;
      loader
        .loadAsync(trueColorUrl(date, imageryWidth))
        .then((texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          if (token !== imageryToken) {
            texture.dispose();
            return;
          }
          prepare(texture, THREE.SRGBColorSpace);
          const previous = liveTexture;
          liveTexture = texture;
          liveDate = date;
          earthMaterial.uniforms.uClouds.value = texture;
          if (previous) {
            const index = textures.indexOf(previous);
            if (index !== -1) textures.splice(index, 1);
            previous.dispose();
          }
          onImageryRef.current({ date, live: true });
        })
        .catch(() => {
          // Offline or blocked: the cloud-free base stays, and the UI says so.
          if (!disposed && token === imageryToken) {
            onImageryRef.current({ date, live: false });
          }
        });
    };

    const setClouds = (on: boolean) => {
      cloudsTarget = on ? 1 : 0;
    };

    // Blue Marble is local, so the globe is complete in milliseconds. The
    // satellite pass is fetched only when the visitor asks for clouds.
    void loadLayer('/earth/blue-marble-ice-4k.jpg', THREE.SRGBColorSpace, 'uMap');
    void loadLayer('/earth/night-lights-3600.jpg', THREE.SRGBColorSpace, 'uNight');
    void loadLayer('/earth/terrain-normal-2k.jpg', THREE.NoColorSpace, 'uNormal');

    // ---- Markers -----------------------------------------------------------
    const markerTexture = createMarkerTexture();
    const ringTexture = createRingTexture();
    const markerGroup = new THREE.Group();
    earth.add(markerGroup);

    const markers = new Map<string, THREE.Sprite>();
    let activeId: string | null = null;
    let focusPoint: THREE.Vector3 | null = null;
    let tween: Tween | null = null;

    /** Eases the camera to `to`, keeping the controls out of the way. */
    const startTween = (to: THREE.Vector3, duration: number, onDone?: () => void) => {
      focusPoint = null;
      controls.enabled = false;
      controls.autoRotate = false;
      tween = { from: camera.position.clone(), to, t: 0, duration, onDone };
    };

    /**
     * A new press on the globe means the visitor has taken the camera back:
     * drop a glide or a dive already in flight so nothing keeps pulling the
     * view toward a site, and so a cancelled dive does not open that site's
     * terrain when it lands.
     */
    const takeCameraBack = () => {
      focusPoint = null;
      if (tween) {
        tween = null;
        controls.enabled = true;
      }
    };

    /** Dives onto a site, then hands off to the local terrain view. */
    const diveToSite = (id: string, lat: number, lon: number) => {
      const target = latLonToVec(lat, lon, 1.92);
      if (reduceMotion) {
        camera.position.copy(target);
        controls.update();
        onOpenSiteRef.current(id);
        return;
      }
      startTween(target, 0.9, () => onOpenSiteRef.current(id));
    };

    const rebuild = (items: MarkerItem[]) => {
      markers.forEach((sprite) => {
        markerGroup.remove(sprite);
        sprite.material.dispose();
      });
      markers.clear();

      // Additive sprites read better when the low end is not pitch black.
      for (const item of items) {
        const reported = item.kind === 'reported';
        const material = new THREE.SpriteMaterial({
          map: reported ? ringTexture : markerTexture,
          color: new THREE.Color(reported ? REPORTED_COLOR : scoreColorHex(item.fit)),
          transparent: true,
          opacity: reported ? 0.9 : 0.95,
          depthTest: true,
          depthWrite: false,
          blending: reported ? THREE.NormalBlending : THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(material);
        const base = reported ? 0.24 : 0.2 + item.fit * 0.16;
        sprite.scale.setScalar(base);
        sprite.position.copy(latLonToVec(item.lat, item.lon, RADIUS + 0.015));
        sprite.userData = { ...item, base };
        markerGroup.add(sprite);
        markers.set(item.id, sprite);
      }

      if (activeId) {
        const active = markers.get(activeId);
        if (active) active.scale.setScalar(active.userData.base * 1.75);
      }
    };

    const select = (id: string | null) => {
      activeId = id;
      markers.forEach((sprite, key) => {
        sprite.scale.setScalar(sprite.userData.base * (key === id ? 1.75 : 1));
      });
      const selected = id ? markers.get(id) : null;
      if (selected && !reduceMotion) {
        const distance = Math.max(5.2, camera.position.length());
        focusPoint = latLonToVec(selected.userData.lat, selected.userData.lon, distance);
        controls.autoRotate = false;
      }
    };

    const reset = () => {
      focusPoint = null;
      tween = null;
      controls.enabled = true;
      controls.autoRotate = !reduceMotion;
      camera.position.copy(HOME);
      controls.update();
    };

    /** Smooth pull-back used when the terrain view closes. */
    const returnHome = () => {
      if (reduceMotion) {
        reset();
        return;
      }
      controls.autoRotate = false;
      startTween(HOME.clone(), 0.95, () => {
        controls.autoRotate = !reduceMotion;
      });
    };

    // ---- Picking -----------------------------------------------------------
    const markerWorld = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    let hovered: string | null = null;

    /**
     * The beacon nearest the pointer, or null.
     *
     * Measured in screen space rather than raycast: distance to each beacon's
     * centre decides, so the tooltip belongs to the dot you are actually over
     * and the closest centre breaks ties inside a cluster. Beacons around the
     * back of the globe are skipped the way the sphere already hides them.
     */
    const pickBeacon = (event: MouseEvent | PointerEvent): THREE.Sprite | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best: THREE.Sprite | null = null;
      let bestDistance = PICK_RADIUS_PX;
      markers.forEach((sprite) => {
        sprite.getWorldPosition(markerWorld);
        toCamera.subVectors(camera.position, markerWorld);
        // Behind the horizon: the tangent test, not just the projected depth.
        if (toCamera.dot(markerWorld) <= 0) return;
        projected.copy(markerWorld).project(camera);
        if (projected.z > 1) return;
        const sx = (projected.x * 0.5 + 0.5) * rect.width;
        const sy = (-projected.y * 0.5 + 0.5) * rect.height;
        const distance = Math.hypot(sx - x, sy - y);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = sprite;
        }
      });
      return best;
    };

    /**
     * Tap, not drag.
     *
     * A browser fires `click` whenever press and release land on the same
     * element, no matter how far the pointer travelled in between — and a
     * sprite's pick radius is bigger than the dot you can see. That made
     * starting an orbit on the edge of a beacon select that site and dive to
     * it the moment the button came up. Anything that moves further than this
     * is an orbit, and the release that ends it is not a click.
     */
    const DRAG_SLOP_PX = 6;
    /** Where the current press began, and which pointer owns it. */
    let press: { id: number; x: number; y: number } | null = null;
    /** True once the current press has travelled far enough to be a drag. */
    let dragging = false;
    /** Latched on release so the `click` that follows is ignored. */
    let suppressClick = false;
    /** Live pointers, so the second finger of a pinch is never a tap. */
    const activePointers = new Set<number>();

    const onPointerDown = (event: PointerEvent) => {
      activePointers.add(event.pointerId);
      // A fresh gesture always clears the previous verdict.
      suppressClick = false;
      dragging = false;
      if (event.button !== 0) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (activePointers.size > 1) suppressClick = true;
      takeCameraBack();
    };

    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (!press || press.id !== event.pointerId) return;
      const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      suppressClick = suppressClick || dragging || travelled > DRAG_SLOP_PX;
      press = null;
      dragging = false;
      tip.style.opacity = '0';
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };

    // A cancelled gesture (pointer lost, gesture stolen) must not click either.
    const onPointerCancel = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (press && press.id === event.pointerId) {
        press = null;
        dragging = false;
        suppressClick = true;
        tip.style.opacity = '0';
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      // While a press is down, the travel decides whether this is a drag.
      if (press) {
        if (
          !dragging &&
          Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_SLOP_PX
        ) {
          dragging = true;
          hovered = null;
          tip.style.opacity = '0';
          renderer.domElement.style.cursor = 'grabbing';
        }
        // No hover-picking mid-orbit: the beacons are sliding under the
        // cursor, so any tooltip would chase them across the globe.
        if (dragging) return;
      }

      const hit = pickBeacon(event);

      if (hit) {
        const data = hit.userData as MarkerItem;
        tip.style.opacity = '1';
        tip.style.transform = `translate(${event.offsetX + 16}px, ${event.offsetY + 16}px)`;
        tip.innerHTML =
          `<span class="tip-name">${data.name}</span>` +
          (data.kind === 'reported'
            ? `<span class="tip-score tip-score-report">Reported</span>`
            : `<span class="tip-score">${formatScore(data.fit)}</span>`) +
          `<span class="tip-meta">${data.meta}</span>`;
        renderer.domElement.style.cursor = 'pointer';
        hovered = data.id;
      } else {
        tip.style.opacity = '0';
        renderer.domElement.style.cursor = 'grab';
        hovered = null;
      }
    };

    const onPointerLeave = () => {
      tip.style.opacity = '0';
      hovered = null;
    };

    const onClick = (event: MouseEvent) => {
      // The release that ended an orbit: whatever beacon the cursor happens to
      // be over now is not what the visitor asked for.
      if (suppressClick) {
        suppressClick = false;
        return;
      }

      const hit = pickBeacon(event);
      if (!hit) return;
      const data = hit.userData as MarkerItem;
      onSelectRef.current(data.id);
      // Selecting a beacon is a commitment: fly all the way in.
      diveToSite(data.id, data.lat, data.lon);
    };

    // Capture, so this runs before OrbitControls' own pointerdown handler and
    // can hand the controls back to the visitor on that same gesture.
    mount.addEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    // ---- Resize ------------------------------------------------------------
    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // ---- Loop --------------------------------------------------------------
    const clock = new THREE.Clock();
    let frameId = 0;
    let elapsed = 0;
    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());
      elapsed += dt;
      const t = elapsed;

      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.duration);
        const eased = tween.t * tween.t * (3 - 2 * tween.t);
        camera.position.lerpVectors(tween.from, tween.to, eased);
        if (tween.t >= 1) {
          const done = tween.onDone;
          tween = null;
          controls.enabled = true;
          controls.update();
          done?.();
        }
      }

      if (focusPoint) {
        camera.position.lerp(focusPoint, 0.085);
        if (camera.position.distanceTo(focusPoint) < 0.01) {
          camera.position.copy(focusPoint);
          focusPoint = null;
        }
      }

      // Ease the cloud layer in or out instead of popping it on.
      const mix = earthMaterial.uniforms.uCloudsMix.value as number;
      if (mix !== cloudsTarget) {
        const next = mix + (cloudsTarget - mix) * 0.16;
        earthMaterial.uniforms.uCloudsMix.value =
          Math.abs(next - cloudsTarget) < 0.002 ? cloudsTarget : next;
      }

      // Selected beacon breathes; hovered one brightens slightly.
      markers.forEach((sprite, key) => {
        const base = sprite.userData.base as number;
        const isActive = key === activeId;
        const isHovered = key === hovered;
        const pulse = isActive ? 1 + Math.sin(t * 2.6) * 0.08 : 1;
        sprite.scale.setScalar(base * (isActive ? 1.75 : isHovered ? 1.3 : 1) * pulse);
      });

      // The sky rotates at the real sidereal rate while the Earth stays fixed
      // in its drawn orientation, so the map keeps matching the clock.
      starfield.setSiderealDegrees(gmst + SIDEREAL_DEG_PER_SEC * t);

      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    apiRef.current = { rebuild, select, reset, returnHome, setImagery, setClouds };

    return () => {
      disposed = true;
      apiRef.current = null;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', stopSpin);
      mount.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      markers.forEach((sprite) => sprite.material.dispose());
      markerTexture.dispose();
      ringTexture.dispose();
      textures.forEach((texture) => texture.dispose());
      dayPlaceholder.dispose();
      cloudsPlaceholder.dispose();
      nightPlaceholder.dispose();
      normalPlaceholder.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      starfield.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild beacons whenever the visible set, the target or the reported
  // candidates change. Reported sites carry no score, so their marker is a
  // ring with "Reported" instead of a fit number.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.rebuild([
      ...predictions.map((p) => ({
        id: p.id,
        name: p.siteName,
        lat: p.lat,
        lon: p.lon,
        fit: fitFor(p, target),
        label: p.label,
        terrain: terrainLabel(p),
        kind: 'model' as const,
        meta: `${terrainLabel(p)} · ${TARGET_LABELS[target]} fit · ${p.label}`,
      })),
      ...reportedSites.map((site) => ({
        id: site.id,
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        fit: 0,
        label: 'Unreviewed',
        terrain: site.terrain,
        kind: 'reported' as const,
        meta: `${site.terrain} · unscored · ${site.targets}`,
      })),
    ]);
  }, [predictions, reportedSites, target]);

  useEffect(() => {
    apiRef.current?.select(selectedId);
  }, [selectedId, predictions, reportedSites, target]);

  // Fetch the satellite pass only while clouds are on, and swap it when the
  // date changes. Turning clouds off keeps the texture cached for an instant
  // re-toggle.
  useEffect(() => {
    apiRef.current?.setClouds(showClouds);
    if (showClouds) apiRef.current?.setImagery(imageryDate);
  }, [showClouds, imageryDate]);

  // Pull back out after the terrain view closes.
  useEffect(() => {
    if (homeSignal > 0) apiRef.current?.returnHome();
  }, [homeSignal]);

  return (
    <div className="globe">
      {/* Decoration: every beacon on it is also a row in the ranked list, so the
          canvas is kept out of the accessibility tree rather than read as an
          unlabelled graphic. */}
      <div ref={mountRef} className="globe-canvas" aria-hidden="true" />
      <div ref={tipRef} className="globe-tip" />
      <div className="globe-actions">
        <button
          type="button"
          className={showClouds ? 'globe-toggle is-on' : 'globe-toggle'}
          aria-pressed={showClouds}
          onClick={onToggleClouds}
          title="Show NASA's live cloud cover for the chosen day"
        >
          <span className="cloud-dot" aria-hidden="true" />
          Live Cloud Layer
        </button>
        <button
          type="button"
          className="globe-reset"
          onClick={() => apiRef.current?.reset()}
          title="Reset the orbit"
        >
          Reset view
        </button>
      </div>
    </div>
  );
}
