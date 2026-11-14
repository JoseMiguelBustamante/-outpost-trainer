import { describe, expect, it } from 'vitest';
import { scheduleStorms, updateStorms, type ScheduledStorm } from './storms';
import type { StormSpec } from './donki';
import { createInitialState, tick, MAX_RESOURCE } from '../sim';

const spec = (dmg: number, id: string): StormSpec => ({
  damagePerSecond: dmg,
  durationSeconds: 10,
  sourceId: id,
  summary: 'test',
  peakKp: null,
  leadTimeSeconds: 5,
});

describe('scheduleStorms', () => {
  it('uses fallback storms when DONKI returns none', () => {
    const sched = scheduleStorms([], 600, 42);
    expect(sched.length).toBeGreaterThan(0);
    expect(sched[0].startAt).toBeGreaterThan(600 * 0.19); // grace period
  });

  it('uses real storms when provided, distributed across mission', () => {
    const real = [spec(3.5, 'fast'), spec(0.5, 'slow'), spec(1.5, 'mid')];
    const sched = scheduleStorms(real, 600, 7);
    expect(sched.length).toBe(3);
    for (const s of sched) expect(s.startAt).toBeGreaterThanOrEqual(600 * 0.2);
    expect(Math.max(...sched.map((s) => s.startAt))).toBeLessThanOrEqual(600);
  });

  it('same seed produces identical schedule (replayable)', () => {
    const a = scheduleStorms([spec(1, 'a'), spec(2, 'b'), spec(3, 'c')], 600, 99);
    const b = scheduleStorms([spec(1, 'a'), spec(2, 'b'), spec(3, 'c')], 600, 99);
    expect(a.map((s) => s.sourceId)).toEqual(b.map((s) => s.sourceId));
    expect(a.map((s) => s.startAt)).toEqual(b.map((s) => s.startAt));
  });

  it('different seed can reorder storms (replayability)', () => {
    const specs = [spec(1, 'a'), spec(2, 'b'), spec(3, 'c'), spec(4, 'd')];
    const orders = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      orders.add(scheduleStorms(specs, 600, seed).map((s) => s.sourceId).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('updateStorms', () => {
  it('applies storm damage when its time arrives', () => {
    const sched: ScheduledStorm[] = [{ ...spec(2, 'hit'), startAt: 10, announced: false, hit: false }];
    let state = createInitialState(600);
    for (let i = 0; i < 24; i++) {
      state = updateStorms(sched, state, 0.5);
      state = tick(state, 0.5);
    }
    expect(sched[0].hit).toBe(true);
    expect(state.shield).toBeLessThan(MAX_RESOURCE);
  });

  it('announces before the storm hits (lead time)', () => {
    const sched: ScheduledStorm[] = [{ ...spec(2, 'later'), startAt: 100, leadTimeSeconds: 20, announced: false, hit: false }];
    let state = createInitialState(600);
    for (let i = 0; i < 40; i++) {
      state = updateStorms(sched, state, 2);
      state = tick(state, 2);
    }
    expect(sched[0].announced).toBe(true);
    expect(sched[0].hit).toBe(false);
  });

  it('does not stack two storms at once', () => {
    const sched: ScheduledStorm[] = [
      { ...spec(2, 'first'), startAt: 5, leadTimeSeconds: 0, announced: false, hit: false },
      { ...spec(2, 'second'), startAt: 6, leadTimeSeconds: 0, announced: false, hit: false },
    ];
    let state = createInitialState(600);
    for (let i = 0; i < 60; i++) {
      state = updateStorms(sched, state, 0.5);
      state = tick(state, 0.5);
    }
    expect(sched[0].hit).toBe(true);
    expect(sched[1].hit).toBe(true);
    expect(state.shield).toBeGreaterThan(0);
  });
});
