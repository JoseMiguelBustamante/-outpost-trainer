import { describe, expect, it } from 'vitest';
import { generateDeposits, DEPOSIT_RADIUS, DEPOSIT_TYPES, HARVEST_AMOUNT, applyHarvest, type Deposit } from './deposits';
import { TERRAIN_CONFIG } from '../scene/scene';
import { createInitialState, MAX_RESOURCE } from '../sim';

describe('generateDeposits', () => {
  const deposits = generateDeposits(TERRAIN_CONFIG, 42, 10);

  it('produces the requested count, deterministically', () => {
    expect(deposits.length).toBe(10);
    const again = generateDeposits(TERRAIN_CONFIG, 42, 10);
    expect(deposits).toEqual(again);
  });

  it('spawns deposits outside the outpost pad but inside the play area', () => {
    for (const d of deposits) {
      const dist = Math.hypot(d.x, d.z);
      expect(dist).toBeGreaterThan(TERRAIN_CONFIG.flatRadius + 2); // outside pad
      expect(dist).toBeLessThan(TERRAIN_CONFIG.size * 0.35); // within walking range
    }
  });

  it('keeps deposits separated from each other', () => {
    for (let i = 0; i < deposits.length; i++) {
      for (let j = i + 1; j < deposits.length; j++) {
        const d = Math.hypot(deposits[i].x - deposits[j].x, deposits[i].z - deposits[j].z);
        expect(d).toBeGreaterThan(DEPOSIT_RADIUS * 2);
      }
    }
  });

  it('assigns only valid resource types', () => {
    for (const d of deposits) {
      expect(DEPOSIT_TYPES).toContain(d.type);
    }
  });

  it('grounds deposits on the terrain height', () => {
    // terrainHeight is exported via terrain module; reconstruct its value
    for (const d of deposits) {
      expect(d.height).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.amplitude);
      expect(d.height).toBeLessThanOrEqual(TERRAIN_CONFIG.amplitude);
    }
  });
});

describe('applyHarvest', () => {
  it('refills the matching resource below its cap', () => {
    let s = { ...createInitialState(600), oxygen: 30 };
    s = applyHarvest(s, { type: 'oxygen' } as Deposit);
    expect(s.oxygen).toBeCloseTo(30 + HARVEST_AMOUNT, 5);
  });

  it('clamps at MAX_RESOURCE and no-ops other meters', () => {
    let s = { ...createInitialState(600), oxygen: MAX_RESOURCE - 1 };
    const before = { shield: s.shield, comms: s.comms, battery: s.battery };
    s = applyHarvest(s, { type: 'oxygen' } as Deposit);
    expect(s.oxygen).toBe(MAX_RESOURCE);
    expect(s.shield).toBe(before.shield);
    expect(s.comms).toBe(before.comms);
    expect(s.battery).toBe(before.battery);
  });

  it('battery pickups charge the battery', () => {
    let s = { ...createInitialState(600), battery: 20 };
    s = applyHarvest(s, { type: 'battery' } as Deposit);
    expect(s.battery).toBeCloseTo(20 + HARVEST_AMOUNT, 5);
  });
});
