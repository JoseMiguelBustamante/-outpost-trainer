import * as THREE from 'three';

export interface OutpostBuild {
  group: THREE.Group;
  /** World-space position of the dome center (used by future camera targeting). */
  center: THREE.Vector3;
}

/** Materials shared by outpost structures (stylized, low-poly, no textures). */
function outpostMaterials(): { hull: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial } {
  return {
    hull: new THREE.MeshStandardMaterial({ color: '#e8e8ee', flatShading: true, roughness: 0.6 }),
    accent: new THREE.MeshStandardMaterial({ color: '#d97b29', flatShading: true, roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#9fd8ff',
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.55,
    }),
  };
}

/** One habitat dome with a small glass cupola. */
function habitatDome(mats: ReturnType<typeof outpostMaterials>, x: number, z: number, radius: number): THREE.Group {
  const g = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.hull,
  );
  dome.position.y = radius * 0.15;
  dome.castShadow = true;
  g.add(dome);

  const cupola = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass);
  cupola.position.y = radius * 0.95;
  g.add(cupola);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.06, radius * 0.18, 12), mats.accent);
  ring.position.y = radius * 0.08;
  g.add(ring);

  g.position.set(x, 0, z);
  return g;
}

/** A rectangular habitat module with legs and a window strip. */
function habitatModule(mats: ReturnType<typeof outpostMaterials>, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 2.6), mats.hull);
  body.position.y = 1.6;
  body.castShadow = true;
  g.add(body);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.5, 2.7), mats.glass);
  windows.position.y = 1.9;
  g.add(windows);

  for (const [lx, lz] of [[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), mats.accent);
    leg.position.set(lx, 0.55, lz);
    g.add(leg);
  }

  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

/** Solar panel array on a tilted stand (visual prop for the power system). */
function solarArray(mats: ReturnType<typeof outpostMaterials>, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();

  const panelMat = new THREE.MeshStandardMaterial({
    color: '#2a4ea0',
    flatShading: true,
    roughness: 0.35,
    metalness: 0.4,
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2.4), panelMat);
  panel.position.y = 1.5;
  panel.castShadow = true;
  g.add(panel);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.06, 0.15), mats.hull);
  frame.position.y = 1.44;
  g.add(frame);

  for (const sx of [-1.6, 1.6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.5, 8), mats.accent);
    leg.position.set(sx, 0.75, 0);
    g.add(leg);
  }

  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.rotation.x = 0.5; // tilt toward the sun
  return g;
}

/** Antenna mast with dish (visual prop for comms). */
function antenna(mats: ReturnType<typeof outpostMaterials>, x: number, z: number): THREE.Group {
  const g = new THREE.Group();

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.2, 8), mats.hull);
  mast.position.y = 1.6;
  g.add(mast);

  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mats.glass);
  dish.position.y = 3.3;
  dish.rotation.x = Math.PI / 2.6;
  g.add(dish);

  g.position.set(x, 0, z);
  return g;
}

/**
 * Builds the whole outpost: two habitat domes, a module, solar arrays,
 * an antenna, and a connecting path. Returns the group plus its center.
 */
export function buildOutpost(): OutpostBuild {
  const mats = outpostMaterials();
  const group = new THREE.Group();
  group.name = 'outpost';

  group.add(habitatDome(mats, 0, 0, 2.6));
  group.add(habitatDome(mats, 4.5, 1.2, 1.8));
  group.add(habitatModule(mats, -4.2, 0.8, Math.PI / 2));
  group.add(solarArray(mats, 1.5, -5.5, 0));
  group.add(solarArray(mats, -2.0, -5.5, 0));
  group.add(antenna(mats, 6.8, -2.5));

  // Simple ground pad so structures read as "planted".
  const pad = new THREE.Mesh(new THREE.CircleGeometry(9.5, 24), mats.accent);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  pad.scale.y = 0.55; // flatten circle into an ellipse pad
  group.add(pad);

  group.position.y = 0.05;
  const center = new THREE.Vector3(0, 1.5, 0);
  return { group, center };
}
