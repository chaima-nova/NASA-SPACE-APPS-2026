import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Prediction } from '../../data-contracts/types';
import { scoreColorHex } from '../../lib/colors';

interface UrbanHeatSceneProps {
  predictions: Prediction[];
}

const COLS = 6;
const SPACING = 3.2;
const MAX_CELLS = COLS * COLS;

/**
 * 3D bars over a grid: height and colour encode heat risk. This is the
 * structural placeholder for richer 3D work later (city blocks, terrain, globe)
 * once Farwa's geometry and Harshil's outputs are final.
 */
export function UrbanHeatScene({ predictions }: UrbanHeatSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1020');

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      1000,
    );
    camera.position.set(18, 16, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(12, 22, 10);
    scene.add(keyLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshStandardMaterial({ color: '#16213e' }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const group = new THREE.Group();
    scene.add(group);

    const disposable: THREE.BufferGeometry[] = [ground.geometry];
    const materials: THREE.Material[] = [ground.material as THREE.Material];

    predictions.slice(0, MAX_CELLS).forEach((p, i) => {
      const gx = i % COLS;
      const gz = Math.floor(i / COLS);
      const height = 0.5 + p.heatRisk * 8;

      const geometry = new THREE.BoxGeometry(1.6, height, 1.6);
      const material = new THREE.MeshStandardMaterial({
        color: scoreColorHex(p.heatRisk),
        roughness: 0.6,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (gx - (COLS - 1) / 2) * SPACING,
        height / 2,
        (gz - (COLS - 1) / 2) * SPACING,
      );
      group.add(mesh);
      disposable.push(geometry);
      materials.push(material);
    });

    const resizeObserver = new ResizeObserver(() => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    let frameId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      disposable.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [predictions]);

  return <div ref={mountRef} className="three-mount" />;
}
