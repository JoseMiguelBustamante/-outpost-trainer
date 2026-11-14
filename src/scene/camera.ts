import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  update: () => void;
  /** Call on window resize. */
  handleResize: (canvas: HTMLCanvasElement) => void;
}

/**
 * Orbit camera focused on the outpost center: drag to rotate, wheel to zoom.
 * Clamped so kids cannot clip through the terrain or fly away.
 */
export function createCameraRig(canvas: HTMLCanvasElement, target: THREE.Vector3): CameraRig {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  camera.position.set(18, 10, 18);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2.15; // keep above the horizon
  controls.enablePan = false; // simpler for young players
  controls.update();

  const handleResize = (c: HTMLCanvasElement): void => {
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  return {
    camera,
    controls,
    update: () => controls.update(),
    handleResize,
  };
}
