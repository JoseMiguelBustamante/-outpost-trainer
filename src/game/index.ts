// Public API of the game logic layer.
export * from './deposits';
import { applyHarvest as refillDeposit, HARVEST_AMOUNT, type Deposit } from './deposits';
import { MAX_RESOURCE, batteryCapacity } from '../sim';

// Nine deposits yield 33.75 repair materials, in addition to their original
// 25-point oxygen/shield/battery reward. Built banks expand battery storage.
export const HARVEST_MATERIALS = 3.75;

/** Reuse the existing capped deposit rewards, then add shared repair stock. */
export function applyHarvest<S extends { oxygen: number; shield: number; battery: number }>(
  state: S,
  deposit: Pick<Deposit, 'type'>,
): S & { materials: number } {
  const materials = 'materials' in state && typeof state.materials === 'number' ? state.materials : 0;
  const reward = refillDeposit(state, deposit);
  // Keep the public deposit helper's reward and all other caps; only expanded
  // battery storage differs from its original 100-point limit.
  if (deposit.type === 'battery' && batteryCapacity(state as { built?: { batteryBank: boolean } }) > MAX_RESOURCE) {
    reward.battery = Math.min(batteryCapacity(state as { built?: { batteryBank: boolean } }), state.battery + HARVEST_AMOUNT);
  }
  return {
    ...reward,
    materials: Math.min(MAX_RESOURCE, Math.max(0, materials + HARVEST_MATERIALS)),
  };
}
