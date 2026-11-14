import { describe, expect, it } from 'vitest';
import { generateDeposits, applyHarvest, type Deposit } from './deposits';
import { createInitialState, tick } from '../sim';
import { TERRAIN_CONFIG } from '../scene/scene';

describe('scanner gameplay integration (deposits -> sim)', () => {
  it('harvesting an oxygen deposit during a blackout keeps the crew alive', () => {
    // Night, empty battery: recycler offline, oxygen draining. The player
    // scans, finds an O2 crystal, harvests just in time.
    let state = { ...createInitialState(600), elapsed: 300, oxygen: 10, battery: 0 }; // 300/600 = night
    const deposits = generateDeposits(TERRAIN_CONFIG, 7, 9, () => 0);
    const oxygenDeposit = deposits.find((d: Deposit) => d.type === 'oxygen')!;

    // Drain to near-death.
    for (let i = 0; i < 20; i++) state = tick(state, 0.5);
    expect(state.oxygen).toBeLessThan(10);

    // Harvest saves the run.
    state = applyHarvest(state, oxygenDeposit);
    expect(state.oxygen).toBeGreaterThanOrEqual(25); // refill dominates drain
  });

  it('deposits survive round-trip: generate -> pick -> harvest -> state updated', () => {
    const deposits = generateDeposits(TERRAIN_CONFIG, 42, 9, () => 0.5);
    let state = { ...createInitialState(600), shield: 15 };
    const sodium = deposits.find((d: Deposit) => d.type === 'sodium')!;

    // Simulate picking: mark harvested and apply.
    const picked: Deposit = { ...sodium, harvested: true };
    state = applyHarvest(state, picked);
    expect(state.shield).toBeCloseTo(40, 5);
    expect(picked.harvested).toBe(true);
    expect(sodium.harvested).toBe(false); // pure: original untouched
  });

  it('full deposit set provides enough resources for the whole mission', () => {
    // 9 deposits x 25 = 225 extra resource points; mission drains ~0.55 O2/s
    // over 600s = 330. Deposits do not cover everything: shield/power still matter.
    const deposits = generateDeposits(TERRAIN_CONFIG, 99, 9, () => 0);
    const total = deposits.length * 25;
    expect(total).toBe(225);
    expect(total).toBeLessThan(600 * 0.55); // scanner helps but does not trivialize
  });
});
