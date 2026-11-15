import * as THREE from 'three';

/** Stylized storm feedback, not a physical lunar atmosphere; never moves the camera. */
export function createStormVisual(scene: THREE.Scene): {
  group: THREE.Group;
  setActive: (active: boolean, intensity: number) => void;
  update: (dt: number) => void;
} {
  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = reducedMotion ? 250 : 500;
  const motionScale = reducedMotion ? 0.5 : 1;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.random() * 90 - 45;
    positions[i * 3 + 1] = Math.random() * 13 + 3;
    positions[i * 3 + 2] = Math.random() * 64 - 32;
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  // Fixed bounds encompass all wrapped particle positions throughout the storm.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 9.5, 0), 57);
  const material = new THREE.PointsMaterial({
    color: '#bd9275',
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const particles = new THREE.Points(geometry, material);
  particles.name = 'storm-dust';
  const group = new THREE.Group();
  group.name = 'storm-visual';
  group.add(particles);
  group.visible = false;

  // The scene owns its background; keep the original color intact for restoration.
  const background = scene.background instanceof THREE.Color ? scene.background : null;
  const normalBackground = background?.clone();
  const fog = scene.fog;
  const normalFog = fog?.color.clone();
  const stormColor = new THREE.Color('#6b3020');
  let active = false;
  let intensity = 0;
  let blend = 0;
  let elapsed = 0;

  return {
    group,
    setActive(nextActive, nextIntensity): void {
      active = nextActive;
      // Retain the outgoing storm's strength while fading back to normal.
      if (active) intensity = THREE.MathUtils.clamp(nextIntensity, 0, 1);
    },
    update(dt): void {
      const step = Math.max(0, dt);
      blend = THREE.MathUtils.clamp(blend + (active ? step : -step) / 1.5, 0, 1);
      const tint = blend * (0.4 + intensity * 0.6);
      if (background && normalBackground) background.copy(normalBackground).lerp(stormColor, tint);
      if (fog && normalFog) fog.color.copy(normalFog).lerp(stormColor, tint);
      material.opacity = blend * 0.5;
      group.visible = blend > 0;
      if (!group.visible) return;

      elapsed += step * motionScale;
      const wind = (5 + intensity * 12) * motionScale * step;
      const drift = (1 + intensity * 3) * motionScale * step;
      for (let i = 0; i < count; i++) {
        const index = i * 3;
        positions[index] = ((positions[index] + wind + 45) % 90) - 45;
        positions[index + 2] = ((positions[index + 2]
          + drift * (1 + 0.3 * Math.sin(elapsed + i)) + 32) % 64) - 32;
      }
      position.needsUpdate = true;
    },
  };
}
