import * as THREE from 'three';

export interface LightingBuild {
  group: THREE.Group;
  /** Directional sun light, exposed so the day/night cycle can animate it. */
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
}

/**
 * Builds lunar lighting: a strong directional "sun" with no atmospheric
 * scattering, plus a very soft hemisphere fill so shadows are not pitch black
 * (stylized choice for kid-friendly readability, not physical accuracy).
 */
export function buildLighting(): LightingBuild {
  const group = new THREE.Group();
  group.name = 'lighting';

  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(40, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 120;
  group.add(sun);

  const ambient = new THREE.HemisphereLight('#5a5a72', '#1c1c22', 0.5);
  group.add(ambient);

  return { group, sun, ambient };
}

/**
 * Starfield: static points on a large sphere around the scene.
 * Visible even during lunar "day" thanks to the black sky.
 */
export function buildStarfield(rngSeed = 42, count = 900): THREE.Points {
  const positions = new Float32Array(count * 3);
  let seed = rngSeed >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    // Uniform-ish points on a sphere shell.
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const R = 480;
    positions[i * 3] = R * r * Math.cos(theta);
    positions[i * 3 + 1] = R * Math.abs(u) * 0.9 + 8;
    positions[i * 3 + 2] = R * r * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false, fog: false });
  const points = new THREE.Points(geo, mat);
  points.name = 'starfield';
  return points;
}
