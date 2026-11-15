import * as THREE from 'three';

export interface OutpostBuild {
  group: THREE.Group;
  /** World-space position of the dome center (used by future camera targeting). */
  center: THREE.Vector3;
}

/** Shared palette: warm ceramic, safety orange, cool instrument lighting. */
function outpostMaterials() {
  return {
    hull: new THREE.MeshStandardMaterial({ color: '#fff1dc', roughness: 0.62 }),
    accent: new THREE.MeshStandardMaterial({ color: '#e98b36', roughness: 0.55 }),
    border: new THREE.MeshStandardMaterial({ color: '#a94f25', roughness: 0.75 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9cabb8', metalness: 0.55, roughness: 0.45 }),
    panel: new THREE.MeshStandardMaterial({ color: '#163666', metalness: 0.35, roughness: 0.32 }),
    cells: new THREE.MeshStandardMaterial({ color: '#719fcb', metalness: 0.3, roughness: 0.5 }),
    light: new THREE.MeshStandardMaterial({ color: '#b6f6ff', emissive: '#40dce9', emissiveIntensity: 1.5, roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#8ce4f3', emissive: '#216779', emissiveIntensity: 0.4,
      roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.55,
    }),
  };
}

type Materials = ReturnType<typeof outpostMaterials>;

/** One smooth ceramic hemisphere with a raised, visible glass crown. */
function habitatDome(mats: Materials, x: number, z: number, radius: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'habitat-dome';
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.hull,
  );
  dome.position.y = radius * 0.15;
  dome.castShadow = true;
  g.add(dome);

  const cupola = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass,
  );
  cupola.position.y = radius * 1.1;
  g.add(cupola);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.06, radius * 0.18, 24), mats.accent);
  ring.position.y = radius * 0.08;
  g.add(ring);
  g.position.set(x, 0, z);
  return g;
}

/** Raised habitat with a framed entry, lit window and orange roof edges. */
function habitatModule(mats: Materials, x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'habitat-module';
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 2.6), mats.hull);
  body.position.y = 1.6;
  body.castShadow = true;
  g.add(body);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.36, 0.06), mats.light);
  windows.position.set(0, 1.95, -1.32);
  g.add(windows);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.85, 0.12), mats.accent);
  doorFrame.position.set(0, 1.43, 1.34);
  g.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.58, 0.08), mats.metal);
  door.position.set(0, 1.38, 1.43);
  g.add(door);

  const longTrim = new THREE.BoxGeometry(4.55, 0.14, 0.14);
  const shortTrim = new THREE.BoxGeometry(0.14, 0.14, 2.6);
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(longTrim, mats.accent);
    edge.position.set(0, 2.72, side * 1.3);
    g.add(edge);
    const end = new THREE.Mesh(shortTrim, mats.accent);
    end.position.set(side * 2.2, 2.72, 0);
    g.add(end);
  }

  const legGeometry = new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8);
  for (const [lx, lz] of [[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]]) {
    const leg = new THREE.Mesh(legGeometry, mats.accent);
    leg.position.set(lx, 0.55, lz);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

/** Two separate framed panels; only the rack tilts, keeping the feet planted. */
function solarArray(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'solar-array';
  const surface = new THREE.BoxGeometry(2.8, 0.1, 2.4);
  const frameGeometry = new THREE.BoxGeometry(2.96, 0.12, 2.56);
  const columnGeometry = new THREE.BoxGeometry(0.025, 0.015, 2.4);
  const rowGeometry = new THREE.BoxGeometry(2.8, 0.015, 0.025);
  const legGeometry = new THREE.CylinderGeometry(0.09, 0.13, 1, 8);
  for (const x of [-1.55, 1.55]) {
    const rack = new THREE.Group();
    rack.position.set(x, 1.65, 0);
    rack.rotation.x = 0.5;
    const panel = new THREE.Mesh(surface, mats.panel);
    panel.castShadow = true;
    rack.add(panel);
    const frame = new THREE.Mesh(frameGeometry, mats.metal);
    frame.position.y = -0.055;
    rack.add(frame);
    for (const offset of [-0.7, 0, 0.7]) {
      const column = new THREE.Mesh(columnGeometry, mats.cells);
      column.position.set(offset, 0.06, 0);
      rack.add(column);
    }
    for (const offset of [-0.4, 0.4]) {
      const row = new THREE.Mesh(rowGeometry, mats.cells);
      row.position.set(0, 0.06, offset);
      rack.add(row);
    }
    g.add(rack);
    // Splayed supports meet the tilted rack at front and back.
    for (const z of [-0.85, 0.85]) {
      const top = new THREE.Vector3(x, 1.65 - Math.sin(0.5) * z - 0.12, Math.cos(0.5) * z);
      const bottom = new THREE.Vector3(x, 0.08, z * 1.2);
      const direction = top.clone().sub(bottom);
      const leg = new THREE.Mesh(legGeometry, mats.metal);
      leg.position.copy(bottom).add(top).multiplyScalar(0.5);
      leg.scale.y = direction.length();
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      g.add(leg);
    }
  }
  g.position.set(-0.25, 0, -5.5);
  return g;
}

/** Open three-post mast with cross braces, dish and static status beacon. */
function antenna(mats: Materials, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'antenna';
  const postGeometry = new THREE.CylinderGeometry(0.055, 0.075, 3.2, 6);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const post = new THREE.Mesh(postGeometry, mats.metal);
    post.position.set(Math.cos(angle) * 0.2, 1.6, Math.sin(angle) * 0.2);
    g.add(post);
  }
  const braceGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6);
  for (let i = 0; i < 3; i++) {
    const brace = new THREE.Mesh(braceGeometry, mats.accent);
    brace.position.set(0, 0.6 + i, 0);
    brace.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.35;
    g.add(brace);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mats.glass);
  dish.position.y = 3.3;
  dish.rotation.x = Math.PI / 2.6;
  g.add(dish);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mats.light);
  beacon.position.set(0, 3.65, 0);
  g.add(beacon);
  g.position.set(x, 0, z);
  return g;
}

/** Short pressurized corridor from the large dome to the module's east door. */
function connector(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'connector';
  const start = new THREE.Vector3(-2.2, 1.38, 0.4);
  const end = new THREE.Vector3(-2.85, 1.38, 0.8);
  const direction = end.clone().sub(start);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, direction.length(), 12), mats.metal);
  tube.position.copy(start).add(end).multiplyScalar(0.5);
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  g.add(tube);
  const ringGeometry = new THREE.TorusGeometry(0.62, 0.08, 6, 16);
  for (const point of [start, end]) {
    const ring = new THREE.Mesh(ringGeometry, mats.accent);
    ring.position.copy(point);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    g.add(ring);
  }
  return g;
}

/** Orange landing pad with a broken perimeter band and six inset markers. */
function platform(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'platform';
  const pad = new THREE.Mesh(new THREE.CircleGeometry(9.5, 48), mats.accent);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  pad.scale.y = 0.55;
  g.add(pad);
  // Rotate arcs in a circular local plane, then squash the entire border.
  const border = new THREE.Group();
  border.rotation.x = -Math.PI / 2;
  border.scale.y = 0.55;
  border.position.y = 0.035;
  const segmentGeometry = new THREE.RingGeometry(9.05, 9.5, 3, 1, 0, Math.PI * 2 / 16 * 0.85);
  for (let i = 0; i < 16; i++) {
    const segment = new THREE.Mesh(segmentGeometry, mats.border);
    segment.rotation.z = i * Math.PI * 2 / 16;
    border.add(segment);
  }
  g.add(border);
  const stripGeometry = new THREE.BoxGeometry(0.7, 0.045, 0.12);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const light = new THREE.Mesh(stripGeometry, mats.light);
    light.position.set(9.2 * Math.cos(angle), 0.07, 9.2 * 0.55 * Math.sin(angle));
    light.rotation.y = Math.atan2(-0.55 * Math.cos(angle), -Math.sin(angle));
    g.add(light);
  }
  return g;
}

/** Presentation-only props; group origin and camera center remain stable. */
export function buildOutpost(): OutpostBuild {
  const mats = outpostMaterials();
  const group = new THREE.Group();
  group.name = 'outpost';
  group.add(habitatDome(mats, 0, 0, 2.6));
  group.add(habitatDome(mats, 4.5, 1.2, 1.8));
  group.add(habitatModule(mats, -4.2, 0.8, Math.PI / 2));
  group.add(solarArray(mats));
  group.add(antenna(mats, 6.8, -2.5));
  group.add(connector(mats));
  group.add(platform(mats));
  group.position.y = 0.05;
  const center = new THREE.Vector3(0, 1.5, 0);
  return { group, center };
}
