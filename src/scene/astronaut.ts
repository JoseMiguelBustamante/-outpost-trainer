import * as THREE from 'three';

export interface PlayerAstronautOptions {
  terrainHeight: (x: number, z: number) => number;
  /** World-space X/Z direction, with magnitude at most one. */
  movement: () => THREE.Vector2;
  center: THREE.Vector3;
}

/** Terrain-grounded player; the visual bobs independently of its world position. */
export function createPlayerAstronaut(scene: THREE.Scene, opts: PlayerAstronautOptions) {
  const group = new THREE.Group();
  group.name = 'player-astronaut';
  const suit = new THREE.Group();
  group.add(suit);
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });
  const cyan = new THREE.MeshStandardMaterial({
    color: '#b6f6ff', emissive: '#40dce9', emissiveIntensity: 1.5, roughness: 0.3,
  });
  const metal = new THREE.MeshStandardMaterial({ color: '#9cabb8', metalness: 0.55, roughness: 0.45 });
  const orange = new THREE.MeshStandardMaterial({ color: '#e98b36', roughness: 0.55 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    suit.add(mesh);
    return mesh;
  };
  add(new THREE.CapsuleGeometry(0.24, 0.34, 4, 8), white, 0, 0.67, 0);
  add(new THREE.SphereGeometry(0.31, 10, 8), white, 0, 1.29, 0);
  add(new THREE.BoxGeometry(0.45, 0.19, 0.14), cyan, 0, 1.3, 0.25);
  add(new THREE.BoxGeometry(0.4, 0.45, 0.25), metal, 0, 0.75, -0.26);
  const limbs = new THREE.CapsuleGeometry(0.09, 0.28, 3, 6);
  const cuffs = new THREE.BoxGeometry(0.2, 0.11, 0.21);
  for (const side of [-1, 1]) {
    add(limbs, white, side * 0.14, 0.28, 0);
    const arm = add(limbs, white, side * 0.34, 0.71, 0);
    arm.rotation.z = side * 0.15;
    add(cuffs, orange, side * 0.34, 0.56, 0);
  }
  scene.add(group);
  let walkTime = 0;
  const setPosition = (x: number, z: number): void => {
    const offset = new THREE.Vector2(x - opts.center.x, z - opts.center.z).clampLength(0, 28);
    x = opts.center.x + offset.x;
    z = opts.center.z + offset.y;
    group.position.set(x, opts.terrainHeight(x, z), z);
  };
  setPosition(opts.center.x + 0.85, opts.center.z + 2.8);
  return {
    group,
    setPosition,
    getPosition: () => group.position.clone(),
    update: (dt: number): void => {
      const direction = opts.movement().clone().clampLength(0, 1);
      const before = group.position.clone();
      setPosition(before.x + direction.x * 3 * dt, before.z + direction.y * 3 * dt);
      const moving = before.distanceToSquared(group.position) > 0.000001;
      if (moving) {
        group.rotation.y = Math.atan2(direction.x, direction.y);
        walkTime += dt * 9;
      }
      suit.position.y = moving ? Math.sin(walkTime) * 0.045 : 0;
    },
  };
}
