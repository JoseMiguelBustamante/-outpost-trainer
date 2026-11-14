import * as THREE from 'three';

// Deterministic value-noise terrain height sampling (no external assets).
// Shared by terrain generation and future features (deposit placement, scanner).

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a 2D lattice point into [0, 1). */
function latticeHash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 69069) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth 2D value noise in [0, 1). */
function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);
  const a = latticeHash(ix, iz, seed);
  const b = latticeHash(ix + 1, iz, seed);
  const c = latticeHash(ix, iz + 1, seed);
  const d = latticeHash(ix + 1, iz + 1, seed);
  return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
}

export interface TerrainConfig {
  /** World-space size of the square terrain (both axes). */
  size: number;
  /** Grid segments per axis. */
  segments: number;
  /** Max terrain height amplitude. */
  amplitude: number;
  /** Flattened radius around origin so the outpost sits on level ground. */
  flatRadius: number;
  seed: number;
}

/**
 * Terrain height at a world position. Deterministic for a given config seed,
 * so other systems can query ground height without reading mesh data.
 */
export function terrainHeight(x: number, z: number, cfg: TerrainConfig): number {
  const s = 4 / cfg.size; // ~4 noise cells across the map
  let h =
    0.6 * valueNoise(x * s, z * s, cfg.seed) +
    0.25 * valueNoise(x * s * 2.3, z * s * 2.3, cfg.seed + 17) +
    0.15 * valueNoise(x * s * 5.1, z * s * 5.1, cfg.seed + 43);
  h = (h - 0.5) * 2; // [-1, 1]
  const dist = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (dist - cfg.flatRadius) / (cfg.flatRadius * 0.8)));
  return h * cfg.amplitude * flat;
}

/**
 * Builds the low-poly lunar surface: a displaced plane with flat shading and
 * a light-gray vertex-color palette. Craters are approximated with noise dips.
 */
export function buildTerrain(cfg: TerrainConfig): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(cfg.size, cfg.size, cfg.segments, cfg.segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#9a9aa2');
  const dark = new THREE.Color('#6f6f78');
  const light = new THREE.Color('#c4c4cc');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z, cfg));

    // Subtle per-vertex tint variation for a stylized, readable surface.
    const t = (terrainHeight(x, z, cfg) / cfg.amplitude + 1) / 2; // 0..1
    const c = base.clone().lerp(t > 0.5 ? light : dark, Math.abs(t - 0.5) * 1.2);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lunarTerrain';
  mesh.receiveShadow = true;
  return mesh;
}
