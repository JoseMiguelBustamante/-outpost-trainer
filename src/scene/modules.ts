import * as THREE from 'three';
import type { ModuleKind } from '../sim';

export interface ModuleSlot {
  position: THREE.Vector3;
  markBuilt(kind: ModuleKind): void;
  reset(): void;
  update(dt: number): void;
}

/** Six hologram meshes plus at most eleven solid meshes across the three slots. */
export function createModuleSlots(scene: THREE.Scene, positions: readonly THREE.Vector3[]): ModuleSlot[] {
  return positions.map((position) => {
    const root = new THREE.Group();
    root.position.copy(position);
    scene.add(root);
    const cyan = new THREE.MeshStandardMaterial({ color: '#75ecff', emissive: '#28dfff', emissiveIntensity: 1,
      transparent: true, opacity: 0.3, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.62, 32), cyan);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 12, 1, true), cyan);
    pillar.position.y = 0.55;
    root.add(ring, pillar);
    const solid = new THREE.Group();
    root.add(solid);
    const grey = new THREE.MeshStandardMaterial({ color: '#86949f', roughness: 0.65, flatShading: true });
    const emitter = new THREE.MeshStandardMaterial({ color: '#70faff', emissive: '#28dfff', emissiveIntensity: 1.4 });
    const green = new THREE.MeshStandardMaterial({ color: '#80ff8a', emissive: '#32df68', emissiveIntensity: 1.2 });
    let built = false;
    let elapsed = 0;
    let rise = 0;
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      solid.add(mesh);
      return mesh;
    };
    return {
      position: root.position,
      markBuilt(kind) {
        if (built) return;
        built = true;
        rise = 0;
        ring.visible = pillar.visible = false;
        // Retain and reuse the slot's geometry on retry.
        if (solid.children.length === 0) {
          if (kind === 'batteryBank') {
            add(new THREE.BoxGeometry(0.9, 1.2, 0.65), grey, 0, 0.6, 0);
            for (const y of [0.3, 0.6, 0.9]) add(new THREE.BoxGeometry(0.65, 0.16, 0.04), green, 0, y, 0.34);
          } else if (kind === 'recycler') {
            add(new THREE.CylinderGeometry(0.4, 0.48, 1.3, 10), grey, 0, 0.65, 0);
            for (const x of [-0.5, 0.5]) add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), emitter, x, 0.45, 0);
            add(new THREE.BoxGeometry(1, 0.12, 0.12), grey, 0, 0.9, 0);
          } else {
            add(new THREE.CylinderGeometry(0.12, 0.22, 2, 6), grey, 0, 1, 0);
            const halo = add(new THREE.TorusGeometry(0.44, 0.06, 6, 24), emitter, 0, 1.7, 0);
            halo.rotation.x = -Math.PI / 2;
            add(new THREE.CylinderGeometry(0.5, 0.55, 0.14, 8), grey, 0, 0.07, 0);
          }
        }
        solid.visible = true;
        solid.scale.y = 0.01;
      },
      reset() {
        built = false;
        rise = elapsed = 0;
        solid.visible = false;
        ring.visible = pillar.visible = true;
      },
      update(dt) {
        elapsed += dt;
        cyan.emissiveIntensity = 0.8 + Math.sin(elapsed * 1.5) * 0.25;
        if (built) {
          rise = Math.min(1, rise + dt);
          solid.scale.y = Math.max(0.01, 1 - Math.pow(1 - rise, 3));
        }
      },
    };
  });
}

/** Local-space overlay follows the existing rover without new lights or textures. */
export function createRoverCondition(rover: THREE.Object3D) {
  const smoke = new THREE.Group();
  const puffs = Array.from({ length: 3 }, (_, i) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5),
      new THREE.MeshBasicMaterial({ color: '#333b45', transparent: true, opacity: 0.4, depthWrite: false }));
    puff.position.x = (i - 1) * 0.16;
    smoke.add(puff);
    return puff;
  });
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.55),
    new THREE.MeshStandardMaterial({ color: '#8cffff', emissive: '#33eeff', emissiveIntensity: 2 }));
  headlight.position.set(0.79, 0.75, 0);
  headlight.visible = false;
  rover.add(smoke, headlight);
  let elapsed = 0;
  return {
    setRepaired(repaired: boolean) { smoke.visible = !repaired; headlight.visible = repaired; },
    update(dt: number) {
      elapsed += dt;
      puffs.forEach((puff, i) => {
        const t = (elapsed * 0.45 + i / 3) % 1;
        puff.position.y = 0.9 + t * 1.3;
        puff.scale.setScalar(0.7 + t);
        puff.material.opacity = (1 - t) * 0.4;
      });
    },
  };
}
