// Scanner gameplay in 3D: deposit markers, scan pulse ring, and picking.

import * as THREE from 'three';
import type { Deposit } from '../game';

export const SCAN_RADIUS = 55;

const COLOR_BY_TYPE: Record<Deposit['type'], string> = {
  oxygen: '#43d17c',
  sodium: '#f7b84f',
  battery: '#4f9df7',
};

export interface ScannerHandle {
  group: THREE.Group;
  /** Animate pulse ring + marker bobbing. dt seconds. */
  update: (dt: number, camera?: THREE.PerspectiveCamera) => void;
  /** Remove the screen-space layer when replacing the scanner on retry. */
  removeLabels: () => void;
  /** Trigger a scan ping from the outpost. */
  pulse: () => void;
  /** Scale both the visual sweep and horizontal reveal reach (default 1). */
  setRangeMultiplier: (multiplier: number) => void;
  /**
   * Raycast against deposit pick-spheres; returns the deposit id or null.
   * Deposits are pickable only after being revealed by a scan.
   */
  pick: (ndc: THREE.Vector2, camera: THREE.PerspectiveCamera) => Deposit | null;
  /** Revealed, unharvested deposits within the player's horizontal reach. */
  nearby: (position: THREE.Vector3, radius?: number) => Deposit[];
  /** Collect feedback: pop and fade. Returns false if hidden or already harvested. */
  harvest: (deposit: Deposit) => boolean;
}

interface Marker {
  deposit: Deposit;
  mesh: THREE.Group;
  pickMesh: THREE.Mesh;
  collectTime: number;
  label?: HTMLElement;
}

export function createScanner(
  deposits: Deposit[],
  outpostPosition: THREE.Vector3,
  labelContainer?: HTMLElement,
): ScannerHandle {
  const group = new THREE.Group();
  group.name = 'scanner';

  const markers: Marker[] = [];
  const pickables: THREE.Mesh[] = [];
  const layer = labelContainer ? document.createElement('div') : undefined;
  if (layer) {
    layer.className = 'deposit-label-layer';
    layer.setAttribute('aria-hidden', 'true');
    labelContainer!.appendChild(layer);
  }
  // Reuse a single vector and each label node throughout the scanner's lifetime.
  const projected = new THREE.Vector3();

  for (const d of deposits) {
    const g = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshStandardMaterial({
        color: COLOR_BY_TYPE[d.type],
        flatShading: true,
        emissive: COLOR_BY_TYPE[d.type],
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
    );
    crystal.position.y = 1.0;
    g.add(crystal);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.18, 3.6, 8),
      new THREE.MeshBasicMaterial({
        color: COLOR_BY_TYPE[d.type], transparent: true, opacity: 0.55,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    beacon.position.y = 2.4;
    g.add(beacon);

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
    const label = layer ? document.createElement('span') : undefined;
    if (label) {
      label.className = 'deposit-label';
      label.textContent = 'Depósito';
      label.hidden = true;
      layer!.appendChild(label);
    }
    markers.push({ deposit: d, mesh: g, pickMesh, collectTime: -1, label });
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
  let rangeMultiplier = 1;

  const update = (dt: number, camera?: THREE.PerspectiveCamera): void => {
    if (camera) camera.updateMatrixWorld();
    const width = layer?.clientWidth ?? 0;
    const height = layer?.clientHeight ?? 0;
    if (pulseT >= 0) {
      pulseT += dt;
      const t = pulseT / 3.5; // 3.5s sweep over ~55 units
      const radius = t * SCAN_RADIUS * rangeMultiplier;
      pulse.scale.setScalar(Math.max(0.01, radius));
      pulseMat.opacity = Math.max(0, 0.55 * (1 - t));
      if (t >= 1) pulseT = -1;
    }
    // Markers bob gently so kids notice them.
    const time = performance.now() / 1000;
    for (const m of markers) {
      if (m.label) {
        let visible = Boolean(camera && m.mesh.visible && !m.deposit.harvested && m.collectTime < 0);
        if (visible) {
          m.mesh.getWorldPosition(projected);
          projected.y += 4.5;
          projected.project(camera!);
          const x = (projected.x + 1) * width / 2;
          const y = (1 - projected.y) * height / 2;
          // Reserve the top console and bottom controls, including the joystick.
          visible = projected.z >= -1 && projected.z <= 1
            && x >= 34 && x <= width - 34 && y >= 300 && y < height - 220;
          if (visible) m.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        }
        m.label.hidden = !visible;
      }
      if (!m.mesh.visible) continue;
      if (m.collectTime >= 0) {
        m.collectTime += dt;
        const t = Math.min(1, m.collectTime / 0.4);
        m.mesh.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.8);
        for (const child of m.mesh.children) {
          const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
          if (mesh === m.pickMesh) continue;
          mesh.material.transparent = true;
          mesh.material.opacity = (1 - t) * (child === m.mesh.children[1] ? 0.55 : 1);
        }
        if (t >= 1) m.mesh.visible = false;
        continue;
      }
      m.mesh.children[0].position.y = 1.0 + Math.sin(time * 2 + m.deposit.id) * 0.15;
      m.mesh.children[0].rotation.y += dt * 1.2;
    }
  };

  const markerByPick = new Map<THREE.Mesh, Marker>(markers.map((m) => [m.pickMesh, m]));

  return {
    group,
    update,
    removeLabels: () => layer?.remove(),
    setRangeMultiplier: (multiplier) => {
      rangeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    },
    pulse: () => {
      pulseT = 0;
      // Reveal immediately, but only inside the sweep's actual horizontal reach.
      for (const m of markers) {
        if (!m.deposit.harvested && Math.hypot(m.deposit.x - outpostPosition.x,
          m.deposit.z - outpostPosition.z) <= SCAN_RADIUS * rangeMultiplier) m.mesh.visible = true;
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
    nearby: (position, radius = 2.2) => markers
      .filter((m) => m.mesh.visible && !m.deposit.harvested
        && Math.hypot(m.deposit.x - position.x, m.deposit.z - position.z) <= radius)
      .map((m) => m.deposit),
    harvest: (deposit) => {
      const marker = markers.find((m) => m.deposit.id === deposit.id);
      if (!marker || !marker.mesh.visible || marker.deposit.harvested) return false;
      marker.deposit.harvested = true;
      marker.label?.remove();
      marker.label = undefined;
      marker.collectTime = 0;
      return true;
    },
  };
}
