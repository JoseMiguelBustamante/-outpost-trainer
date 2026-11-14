// Scanner gameplay in 3D: deposit markers, scan pulse ring, and picking.

import * as THREE from 'three';
import type { Deposit } from '../game';

const COLOR_BY_TYPE: Record<Deposit['type'], string> = {
  oxygen: '#43d17c',
  sodium: '#f7b84f',
  battery: '#4f9df7',
};

export interface ScannerHandle {
  group: THREE.Group;
  /** Animate pulse ring + marker bobbing. dt seconds. */
  update: (dt: number) => void;
  /** Trigger a scan ping from the outpost. */
  pulse: () => void;
  /**
   * Raycast against deposit pick-spheres; returns the deposit id or null.
   * Deposits are pickable only after being revealed by a scan.
   */
  pick: (ndc: THREE.Vector2, camera: THREE.PerspectiveCamera) => Deposit | null;
  /** Collect feedback: shrink marker. Returns false if already harvested. */
  harvest: (deposit: Deposit) => boolean;
}

interface Marker {
  deposit: Deposit;
  mesh: THREE.Group;
  pickMesh: THREE.Mesh;
}

export function createScanner(
  deposits: Deposit[],
  outpostPosition: THREE.Vector3,
): ScannerHandle {
  const group = new THREE.Group();
  group.name = 'scanner';

  const markers: Marker[] = [];
  const pickables: THREE.Mesh[] = [];

  for (const d of deposits) {
    const g = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshStandardMaterial({
        color: COLOR_BY_TYPE[d.type],
        flatShading: true,
        emissive: COLOR_BY_TYPE[d.type],
        emissiveIntensity: 0.35,
        roughness: 0.3,
      }),
    );
    crystal.position.y = 1.0;
    g.add(crystal);

    // Generous invisible pick sphere (kids aim with a mouse, not a hawk).
    const pickMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pickMesh.position.y = 1.0;
    g.add(pickMesh);

    g.position.set(d.x, d.height, d.z);
    g.visible = false; // hidden until scanned
    group.add(g);
    pickables.push(pickMesh);
    markers.push({ deposit: d, mesh: g, pickMesh });
  }

  // Scan pulse: expanding ground ring.
  const pulseGeo = new THREE.RingGeometry(0.9, 1.0, 48);
  pulseGeo.rotateX(-Math.PI / 2);
  const pulseMat = new THREE.MeshBasicMaterial({
    color: '#7fd8ff',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const pulse = new THREE.Mesh(pulseGeo, pulseMat);
  pulse.position.copy(outpostPosition).setY(0.05);
  group.add(pulse);
  let pulseT = -1; // <0 idle

  const update = (dt: number): void => {
    if (pulseT >= 0) {
      pulseT += dt;
      const t = pulseT / 3.5; // 3.5s sweep over ~55 units
      const radius = t * 55;
      pulse.scale.setScalar(Math.max(0.01, radius));
      pulseMat.opacity = Math.max(0, 0.55 * (1 - t));
      if (t >= 1) pulseT = -1;
    }
    // Markers bob gently so kids notice them.
    const time = performance.now() / 1000;
    for (const m of markers) {
      if (!m.mesh.visible) continue;
      m.mesh.children[0].position.y = 1.0 + Math.sin(time * 2 + m.deposit.id) * 0.15;
      m.mesh.children[0].rotation.y += dt * 1.2;
    }
  };

  const markerByPick = new Map<THREE.Mesh, Marker>(markers.map((m) => [m.pickMesh, m]));

  return {
    group,
    update,
    pulse: () => {
      pulseT = 0;
      // Reveal every marker the pulse will have covered (kid-friendly: all).
      for (const m of markers) {
        if (!m.deposit.harvested) m.mesh.visible = true;
      }
    },
    pick: (ndc, camera) => {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables, false);
      const hit = hits.find((h) => {
        const m = markerByPick.get(h.object as THREE.Mesh);
        return m != null && m.mesh.visible && !m.deposit.harvested;
      });
      return hit ? (markerByPick.get(hit.object as THREE.Mesh)!.deposit ?? null) : null;
    },
    harvest: (deposit) => {
      const marker = markers.find((m) => m.deposit.id === deposit.id);
      if (!marker || marker.deposit.harvested) return false;
      marker.deposit.harvested = true;
      // Quick collect animation: sink into the ground, then hide.
      const m = marker.mesh;
      const start = performance.now();
      const anim = (): void => {
        const t = (performance.now() - start) / 400;
        if (t >= 1) {
          m.visible = false;
          return;
        }
        m.scale.setScalar(Math.max(0.01, 1 - t));
        requestAnimationFrame(anim);
      };
      anim();
      return true;
    },
  };
}
