import * as THREE from 'three';
import { buildTerrain, terrainHeight, type TerrainConfig } from './terrain';
import { buildOutpost, type OutpostBuild } from './outpost';
import { buildLighting, buildStarfield, type LightingBuild } from './lighting';
import { createCameraRig, type CameraRig } from './camera';

export const TERRAIN_CONFIG: TerrainConfig = {
  size: 160,
  segments: 96,
  amplitude: 2.2,
  flatRadius: 12,
  seed: 20261114,
};

export interface GameScene {
  /** Advances the scene one frame (delta in seconds). */
  update: (delta: number) => void;
  handleResize: () => void;
  dispose: () => void;
  terrainConfig: TerrainConfig;
  outpost: OutpostBuild;
  lighting: LightingBuild;
  cameraRig: CameraRig;
  /** The underlying Three.js scene (for gameplay layers like scanner). */
  scene: THREE.Scene;
  /** Deterministic terrain height query for gameplay (deposits, scanner). */
  terrainHeight: (x: number, z: number) => number;
}

/**
 * Assembles the full lunar scene and starts the render loop.
 * Returns handles for future gameplay systems (sim, scanner, DONKI events).
 */
export function createGameScene(canvas: HTMLCanvasElement): GameScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#050508'); // space black; stars provide the sky

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#050508', 90, 240);

  const terrain = buildTerrain(TERRAIN_CONFIG);
  scene.add(terrain);

  const outpost = buildOutpost();
  scene.add(outpost.group);

  const lighting = buildLighting();
  scene.add(lighting.group);

  scene.add(buildStarfield());

  const cameraRig = createCameraRig(canvas, outpost.center);
  scene.add(cameraRig.camera); // required for OrbitControls damping updates

  const handleResize = (): void => {
    cameraRig.handleResize(canvas);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
  };
  handleResize();

  const clock = new THREE.Clock();
  let running = true;
  let raf = 0;

  const update = (_delta: number): void => {
    // Gameplay systems (sim, scanner, events) hook here in T3+.
    cameraRig.update();
    renderer.render(scene, cameraRig.camera);
  };

  const loop = (): void => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    update(clock.getDelta());
  };
  loop();

  const dispose = (): void => {
    running = false;
    cancelAnimationFrame(raf);
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    renderer.dispose();
  };

  return {
    update,
    handleResize,
    dispose,
    terrainConfig: TERRAIN_CONFIG,
    outpost,
    lighting,
    cameraRig,
    scene,
    terrainHeight: (x: number, z: number) => terrainHeight(x, z, TERRAIN_CONFIG),
  };
}
