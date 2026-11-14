// Resource deposits scattered on the lunar surface (scanner gameplay).
// Pure generation logic: deterministic from a seed, testable without Three.js.

export interface Deposit {
  id: number;
  /** World XZ position. */
  x: number;
  z: number;
  /** Terrain height at that position (Y). */
  height: number;
  type: DepositType;
  harvested: boolean;
}

export type DepositType = 'oxygen' | 'sodium' | 'battery';

export const DEPOSIT_TYPES: readonly DepositType[] = ['oxygen', 'sodium', 'battery'] as const;

/** Visual/gameplay radius of one deposit marker. */
export const DEPOSIT_RADIUS = 1.2;

/** Amount a single harvest refills on its resource (0..MAX_RESOURCE scale). */
export const HARVEST_AMOUNT = 25;

/** Seeded RNG matching the pattern used elsewhere (mulberry32/LCG style). */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface DepositPlacementConfig {
  size: number;
  amplitude: number;
  flatRadius: number;
}

/**
 * Generate `count` deposits: outside the outpost pad, inside `size*0.35`,
 * separated by at least DEPOSIT_RADIUS*2, types cycled fairly.
 * `heightAt` grounds each deposit on the terrain.
 */
export function generateDeposits(
  cfg: DepositPlacementConfig,
  seed: number,
  count: number,
  heightAt?: (x: number, z: number) => number,
): Deposit[] {
  const rand = seededRandom(seed);
  const out: Deposit[] = [];
  const minDist = DEPOSIT_RADIUS * 2 + 1;
  const inner = cfg.flatRadius + 2.5;
  const outer = cfg.size * 0.35;
  let attempts = 0;

  while (out.length < count && attempts < count * 100) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = inner + rand() * (outer - inner);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const tooClose = out.some((d) => Math.hypot(d.x - x, d.z - z) < minDist);
    if (tooClose) continue;

    const type = DEPOSIT_TYPES[out.length % DEPOSIT_TYPES.length];
    const height = heightAt ? heightAt(x, z) : (rand() * 2 - 1) * cfg.amplitude;
    out.push({ id: out.length, x, z, height, type, harvested: false });
  }
  return out;
}

/** Apply a harvest to the state: refill matching meter, clamped. Pure. */
export function applyHarvest<S extends { oxygen: number; shield: number; battery: number }>(
  state: S,
  deposit: Pick<Deposit, 'type'>,
): S {
  const amount = HARVEST_AMOUNT;
  switch (deposit.type) {
    case 'oxygen':
      return { ...state, oxygen: Math.min(100, state.oxygen + amount) };
    case 'sodium':
      return { ...state, shield: Math.min(100, state.shield + amount) };
    case 'battery':
      return { ...state, battery: Math.min(100, state.battery + amount) };
  }
}
