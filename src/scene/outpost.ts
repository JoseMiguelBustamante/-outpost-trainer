import * as THREE from 'three';

export interface OutpostBuild {
  group: THREE.Group;
  /** World-space position of the dome center (used by future camera targeting). */
  center: THREE.Vector3;
}

/** Shared palette: warm ceramic, safety orange, cool instrument lighting. */
function outpostMaterials() {
  return {
    hull: new THREE.MeshStandardMaterial({ color: '#fff1dc', roughness: 0.62, flatShading: true }),
    white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#28313b', roughness: 0.95 }),
    soil: new THREE.MeshStandardMaterial({ color: '#654732', roughness: 1 }),
    plant: new THREE.MeshStandardMaterial({ color: '#68b84b', roughness: 0.9 }),
    led: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2 }),
    greenhouse: new THREE.MeshStandardMaterial({
      color: '#7edee8', transparent: true, opacity: 0.45,
      roughness: 0.25, flatShading: true, depthWrite: false,
    }),
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

/** Faceted panel shell with a glass crown; the smaller shell houses crops. */
function habitatDome(mats: Materials, x: number, z: number, radius: number, greenhouse = false): THREE.Group {
  const g = new THREE.Group();
  g.name = greenhouse ? 'greenhouse-dome' : 'habitat-dome';
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    greenhouse ? mats.greenhouse : mats.hull,
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

  // The rings follow the hemisphere profile, with a small clearance over facets.
  const trimGeometry = new THREE.TorusGeometry(1, 0.018, 6, 48);
  for (const height of [0.25, 0.55, 0.8]) {
    const trim = new THREE.Mesh(trimGeometry, mats.accent);
    trim.rotation.x = -Math.PI / 2;
    trim.scale.setScalar(radius * Math.sqrt(1 - height * height) + 0.025);
    trim.position.y = radius * (0.15 + height);
    g.add(trim);
  }
  const slitGeometry = new THREE.BoxGeometry(radius * 0.24, 0.14, 0.07);
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 12 + i * Math.PI / 3;
    const slit = new THREE.Mesh(slitGeometry, mats.light);
    slit.position.set(Math.sin(angle) * radius * 0.97, radius * 0.32, Math.cos(angle) * radius * 0.97);
    slit.rotation.y = angle;
    g.add(slit);
  }
  if (greenhouse) {
    const soilGeometry = new THREE.BoxGeometry(2, 0.12, 0.42);
    const plantGeometry = new THREE.BoxGeometry(0.28, 0.42, 0.28);
    for (const row of [-0.65, 0, 0.65]) {
      const soil = new THREE.Mesh(soilGeometry, mats.soil);
      soil.position.set(0, 0.28, row);
      g.add(soil);
      for (const column of [-0.65, 0, 0.65]) {
        const plant = new THREE.Mesh(plantGeometry, mats.plant);
        plant.position.set(column, 0.55, row);
        g.add(plant);
      }
    }
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.1), mats.led);
    led.position.y = radius * 1.14;
    g.add(led);
  } else {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.25, 0.16), mats.accent);
    frame.position.set(0, 0.73, radius * 0.98);
    g.add(frame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.05, 0.18), mats.metal);
    door.position.set(0, 0.69, radius * 0.98 + 0.04);
    g.add(door);
  }
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

/** Elliptical rails match the existing pad, with twelve upright posts. */
function railing(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'platform-railing';
  const postGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 6);
  const dotGeometry = new THREE.SphereGeometry(0.085, 8, 6);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const x = 9.25 * Math.cos(angle);
    const z = 9.25 * 0.55 * Math.sin(angle);
    const post = new THREE.Mesh(postGeometry, mats.metal);
    post.position.set(x, 0.48, z);
    g.add(post);
    if (i % 2 === 0) {
      const dot = new THREE.Mesh(dotGeometry, mats.light);
      dot.position.set(x, 0.94, z);
      g.add(dot);
    }
  }
  const railGeometry = new THREE.TorusGeometry(9.25, 0.035, 6, 64);
  for (const y of [0.42, 0.85]) {
    const rail = new THREE.Mesh(railGeometry, mats.accent);
    rail.rotation.x = -Math.PI / 2;
    rail.scale.y = 0.55;
    rail.position.y = y;
    g.add(rail);
  }
  return g;
}

/** Four flat arrow outlines lead across the open front apron to the dome door. */
function padChevrons(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'landing-chevrons';
  const shape = new THREE.Shape();
  shape.moveTo(-0.55, -0.3);
  shape.lineTo(0, 0.2);
  shape.lineTo(0.55, -0.3);
  shape.lineTo(0.55, -0.06);
  shape.lineTo(0, 0.44);
  shape.lineTo(-0.55, -0.06);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < 4; i++) {
    const arrow = new THREE.Mesh(geometry, mats.white);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(0, 0.03, 3.05 + i * 0.48);
    g.add(arrow);
  }
  return g;
}

/** Six-wheel survey rover, parked on the free west apron. */
function rover(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rover';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.85), mats.metal);
  body.position.y = 0.65;
  g.add(body);
  const wheelGeometry = new THREE.CylinderGeometry(0.29, 0.29, 0.2, 10);
  const hubGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8);
  for (const x of [-0.58, 0, 0.58]) {
    for (const z of [-0.53, 0.53]) {
      const wheel = new THREE.Mesh(wheelGeometry, mats.rubber);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.32, z);
      g.add(wheel);
      const hub = new THREE.Mesh(hubGeometry, mats.accent);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      g.add(hub);
    }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), mats.metal);
  mast.position.set(0.45, 1.15, 0);
  g.add(mast);
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.18), mats.light);
  headlight.position.set(0.45, 1.46, 0);
  g.add(headlight);
  g.position.set(-6.4, 0, 2.6);
  g.rotation.y = -0.35;
  return g;
}

/** A roughly one-metre suit at the main dome entrance (about 35% of its height). */
function astronaut(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'astronaut';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.24, 4, 8), mats.white);
  body.position.y = 0.47;
  g.add(body);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mats.white);
  helmet.position.y = 0.91;
  g.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.1), mats.light);
  visor.position.set(0, 0.92, 0.18);
  g.add(visor);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.18), mats.metal);
  pack.position.set(0, 0.53, -0.18);
  g.add(pack);
  const limbGeometry = new THREE.CapsuleGeometry(0.065, 0.2, 3, 6);
  const cuffGeometry = new THREE.BoxGeometry(0.14, 0.08, 0.15);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(limbGeometry, mats.white);
    leg.position.set(side * 0.1, 0.2, 0);
    g.add(leg);
    const arm = new THREE.Mesh(limbGeometry, mats.white);
    arm.position.set(side * 0.24, 0.5, 0);
    arm.rotation.z = side * 0.15;
    g.add(arm);
    const cuff = new THREE.Mesh(cuffGeometry, mats.accent);
    cuff.position.set(side * 0.24, 0.4, 0);
    g.add(cuff);
  }
  g.position.set(0.85, 0.04, 2.8);
  return g;
}

/** Low service lines hug the platform, separate from the pressurized corridor. */
function servicePipes(mats: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'service-pipes';
  const routes = [
    [new THREE.Vector3(-3.5, 0.4, -0.55), new THREE.Vector3(-2.9, 0.2, -1.3), new THREE.Vector3(-2, 0.35, -1.45)],
    [new THREE.Vector3(-4.4, 0.4, 2.15), new THREE.Vector3(-3, 0.2, 3.4), new THREE.Vector3(2.5, 0.2, 3.5), new THREE.Vector3(4, 0.4, 2.85)],
  ];
  const jointGeometry = new THREE.TorusGeometry(0.11, 0.045, 6, 12);
  for (const points of routes) {
    const curve = new THREE.CatmullRomCurve3(points);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.1, 8, false), mats.metal);
    g.add(pipe);
    for (const t of [0, 1]) {
      const joint = new THREE.Mesh(jointGeometry, mats.accent);
      joint.position.copy(curve.getPoint(t));
      joint.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(t).normalize());
      g.add(joint);
    }
  }
  return g;
}

/** Presentation-only props; group origin and camera center remain stable. */
export function buildOutpost(): OutpostBuild {
  const mats = outpostMaterials();
  const group = new THREE.Group();
  group.name = 'outpost';
  group.add(habitatDome(mats, 0, 0, 2.6));
  group.add(habitatDome(mats, 4.5, 1.2, 1.8, true));
  group.add(habitatModule(mats, -4.2, 0.8, Math.PI / 2));
  group.add(solarArray(mats));
  group.add(antenna(mats, 6.8, -2.5));
  group.add(connector(mats));
  group.add(platform(mats));
  group.add(railing(mats), padChevrons(mats), rover(mats), astronaut(mats), servicePipes(mats));
  group.position.y = 0.05;
  const center = new THREE.Vector3(0, 1.5, 0);
  return { group, center };
}
