// Public API of the game logic layer.
export * from './deposits';
import { applyHarvest as refillDeposit, type Deposit } from './deposits';
import { MAX_RESOURCE } from '../sim';

// Nine deposits yield 33.75 repair materials, in addition to their original
// 25-point oxygen/shield/battery reward. Battery rewards remain unchanged.
export const HARVEST_MATERIALS = 3.75;

/** Reuse the existing capped deposit rewards, then add shared repair stock. */
export function applyHarvest<S extends { oxygen: number; shield: number; battery: number }>(
  state: S,
  deposit: Pick<Deposit, 'type'>,
): S & { materials: number } {
  const materials = 'materials' in state && typeof state.materials === 'number' ? state.materials : 0;
  return {
    ...refillDeposit(state, deposit),
    materials: Math.min(MAX_RESOURCE, Math.max(0, materials + HARVEST_MATERIALS)),
  };
}
