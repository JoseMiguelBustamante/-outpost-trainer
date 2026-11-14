import { describe, expect, it } from 'vitest';
import { createInitialState, tick, MAX_RESOURCE, type GameState, type PowerAllocation } from './sim';

const DT = 0.1; // seconds per step for tests

function runSeconds(state: GameState, seconds: number, dt = DT): GameState {
  let s = state;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) s = tick(s, dt);
  return s;
}

describe('createInitialState', () => {
  it('starts with full battery and resources, daytime', () => {
    const s = createInitialState(1);
    expect(s.battery).toBe(MAX_RESOURCE);
    expect(s.shield).toBe(MAX_RESOURCE);
    expect(s.oxygen).toBe(MAX_RESOURCE);
    expect(s.comms).toBe(MAX_RESOURCE);
    expect(s.isDay).toBe(true);
    expect(s.elapsed).toBe(0);
  });
});

describe('power allocation', () => {
  it('accepts allocations that sum to 100 percent', () => {
    const alloc: PowerAllocation = { shield: 40, oxygen: 40, comms: 20 };
    const s = tick({ ...createInitialState(1), allocation: alloc }, DT);
    expect(s.allocation).toEqual(alloc);
  });

  it('normalizes allocations that do not sum to 100', () => {
    const alloc: PowerAllocation = { shield: 60, oxygen: 60, comms: 60 }; // sum 180
    const s = tick({ ...createInitialState(1), allocation: alloc }, DT);
    const sum = s.allocation.shield + s.allocation.oxygen + s.allocation.comms;
    expect(sum).toBeCloseTo(100, 5);
  });
});

describe('day/night cycle', () => {
  it('is day during the first half of the cycle', () => {
    const s = runSeconds(createInitialState(60), 10);
    expect(s.isDay).toBe(true);
  });

  it('becomes night after half the cycle length', () => {
    const s = runSeconds(createInitialState(60), 60 * 0.55);
    expect(s.isDay).toBe(false);
  });

  it('exposes solar generation above zero in day and zero at night', () => {
    const day = createInitialState(1);
    expect(day.solarGeneration).toBeGreaterThan(0);
    const night = runSeconds(createInitialState(60), 60 * 0.75);
    expect(night.solarGeneration).toBe(0);
  });
});

describe('battery dynamics', () => {
  it('charges during day when generation exceeds consumption', () => {
    const start = createInitialState(60);
    const s0 = { ...start, battery: 50, elapsed: 15 }; // midday
    const s = runSeconds(s0, 5);
    expect(s.battery).toBeGreaterThan(50);
  });

  it('drains during night', () => {
    const start = createInitialState(60);
    const s0 = { ...start, battery: 90 };
    const s = runSeconds(s0, 60 * 0.75, 0.5);
    expect(s.battery).toBeLessThan(90);
  });

  it('clamps battery between 0 and MAX_RESOURCE', () => {
    const start = createInitialState(60);
    let s = runSeconds({ ...start, battery: 1 }, 60 * 0.75, 0.5);
    expect(s.battery).toBeGreaterThanOrEqual(0);
    s = runSeconds({ ...s, battery: MAX_RESOURCE - 0.01 }, 30, 0.5);
    expect(s.battery).toBeLessThanOrEqual(MAX_RESOURCE);
  });
});

describe('consumer resources', () => {
  it('drains oxygen over time regardless of allocation', () => {
    const s = runSeconds(createInitialState(1), 30);
    expect(s.oxygen).toBeLessThan(MAX_RESOURCE);
  });

  it('low allocation to shield lets it decay', () => {
    const start = { ...createInitialState(1), allocation: { shield: 5, oxygen: 90, comms: 5 } };
    const s = runSeconds(start, 60);
    expect(s.shield).toBeLessThan(MAX_RESOURCE);
  });

  it('high allocation to shield keeps it topped up', () => {
    const start = { ...createInitialState(1), allocation: { shield: 60, oxygen: 30, comms: 10 } };
    const s = runSeconds(start, 60);
    expect(s.shield).toBeGreaterThan(MAX_RESOURCE * 0.9);
  });

  it('all resources clamp between 0 and MAX_RESOURCE', () => {
    const start = { ...createInitialState(1), battery: 0, allocation: { shield: 0, oxygen: 0, comms: 0 } };
    const s = runSeconds(start, 120);
    for (const v of [s.shield, s.oxygen, s.comms]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(MAX_RESOURCE);
    }
  });
});

describe('game over', () => {
  it('sets gameOver when oxygen hits zero', () => {
    // Night with empty battery: recycler offline, oxygen just drains out.
    const start = { ...createInitialState(60), elapsed: 33, battery: 0, oxygen: 0.5 };
    const s = runSeconds(start, 10);
    expect(s.gameOver).toBe(true);
    expect(s.gameOverReason).toContain('oxygen');
  });

  it('sets gameOver when battery and reserves collapse (blackout)', () => {
    // Night (starts at elapsed 30), no battery -> generator offline -> suffocation
    const start = { ...createInitialState(60), elapsed: 30, battery: 0, oxygen: 10, allocation: { shield: 0, oxygen: 0, comms: 0 } };
    const s = runSeconds(start, 30, 0.5);
    expect(s.gameOver).toBe(true);
  });
});

describe('determinism', () => {
  it('same inputs produce same outputs (pure tick, no RNG)', () => {
    const a = runSeconds(createInitialState(7), 20);
    const b = runSeconds(createInitialState(7), 20);
    expect(a).toEqual(b);
  });
});

describe('mission completion and storm survival (T6 scope)', () => {
  it('sets gameOver reason "survived" when the full cycle completes', () => {
    const s = runSeconds(createInitialState(60), 61, 0.5);
    expect(s.gameOver).toBe(true);
    expect(s.gameOverReason).toBe('survived');
  });

  it('counts survived storms when a storm ends without shield collapse', () => {
    let s = createInitialState(600);
    for (let i = 0; i < 5; i++) s = tick(s, 0.5);
    // start a storm the shield can clearly survive
    s = { ...s, activeEvent: { shieldDamagePerSecond: 0.2 }, stormRemaining: 5 };
    s = runSeconds(s, 6, 0.5);
    expect(s.stormsSurvived).toBe(1);
    expect(s.gameOver).toBe(false);
  });

  it('does not count a storm that destroyed the shield as survived', () => {
    let s = { ...createInitialState(600), shield: 0.05 };
    s = { ...s, activeEvent: { shieldDamagePerSecond: 9 }, stormRemaining: 20 };
    s = runSeconds(s, 22, 0.5);
    expect(s.gameOver).toBe(true);
    expect(s.gameOverReason).toBe('shield');
    expect(s.stormsSurvived).toBe(0);
  });
});
