import { describe, expect, it } from 'vitest';
import { createInitialState, tick, MAX_RESOURCE, buildModule, MODULE_COSTS, BATTERY_BANK_CAPACITY, repairRover, ROVER_REPAIR_COST, type GameState, type PowerAllocation } from './sim';
import { applyHarvest, DEPOSIT_TYPES } from '../game';
import { missionProgress } from '../game/missions';
import { discoveryName, appendLogEntry } from '../ui/logbook';

import * as THREE from 'three';
import { createScanner, SCAN_RADIUS } from '../scene/scanner';
import { createModuleSlots, createRoverCondition } from '../scene/modules';
import { buildOutpost } from '../scene/outpost';

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
    expect(s.materials).toBe(40);
    expect(s.isDay).toBe(true);
    expect(s.elapsed).toBe(0);
  });
});

describe('construction and rover progression', () => {
  it.each(['batteryBank', 'recycler', 'pylon'] as const)('builds %s exactly once at its fixed cost, without mutating input', (kind) => {
    const start = createInitialState(600);
    expect(start.built).toEqual({ batteryBank: false, recycler: false, pylon: false });
    const before = structuredClone(start);
    const built = buildModule({ ...start, materials: MODULE_COSTS[kind] }, kind);
    expect(built).toEqual({ ...start, materials: 0, built: { ...start.built, [kind]: true } });
    expect(buildModule(built, kind)).toBe(built);
    const poor = { ...start, materials: MODULE_COSTS[kind] - 0.01 };
    expect(buildModule(poor, kind)).toBe(poor);
    expect(start).toEqual(before);
  });

  it('charges and harvests to 140 only with a battery bank, without lowering an expanded reserve', () => {
    expect(BATTERY_BANK_CAPACITY).toBe(140);
    const built = buildModule(createInitialState(600), 'batteryBank');
    const full = tick({ ...built, elapsed: 150, battery: 139 }, 1);
    expect(full.battery).toBe(140);
    expect(applyHarvest({ ...built, battery: 130 }, { type: 'battery' }).battery).toBe(140);
    expect(applyHarvest({ ...built, battery: 110 }, { type: 'oxygen' }).battery).toBe(110);
    expect(applyHarvest({ ...createInitialState(), battery: 90 }, { type: 'battery' }).battery).toBe(100);
    expect(tick({ ...createInitialState(600), elapsed: 150, battery: 99 }, 1).battery).toBe(100);
  });

  it.each(['guided', 'challenge'] as const)('provides free independent recycler and pylon passives in %s', (difficulty) => {
    const start = { ...createInitialState(600, difficulty), elapsed: 400, battery: 0,
      materials: 0, oxygen: 50, shield: 50, built: { batteryBank: false, recycler: true, pylon: true } };
    const next = tick(start, 1);
    expect(next.oxygen).toBeCloseTo(50 - 0.55 * (difficulty === 'guided' ? 0.6 : 1.4) + 0.8);
    expect(next.shield).toBe(50.5);
    expect(next.materials).toBe(0);
    const storm = tick({ ...start, activeEvent: { shieldDamagePerSecond: 2 }, stormRemaining: 5 }, 1);
    expect(storm.shield).toBe(48.5);
    const powered = tick({ ...start, elapsed: 150, battery: 100, materials: 20,
      allocation: { shield: 100, oxygen: 0, comms: 0 } }, 1);
    expect(powered.shield).toBe(53.5);
    expect(powered.materials).toBeCloseTo(20 - 3 * 0.5 * (difficulty === 'guided' ? 0.7 : 1));
    expect(tick({ ...start, oxygen: 100, shield: 100 }, 1).shield).toBe(100);
    expect(tick({ ...start, oxygen: 100, shield: 100 }, 1).oxygen).toBe(100);
  });

  it('repairs the rover once for 10 materials and resets all progression in a fresh mission', () => {
    expect(ROVER_REPAIR_COST).toBe(10);
    const start = { ...createInitialState(), materials: 10 };
    const repaired = repairRover(start);
    expect(repaired).toEqual({ ...start, materials: 0, roverRepaired: true });
    expect(start.roverRepaired).toBe(false);
    expect(repairRover(repaired)).toBe(repaired);
    const poor = { ...start, materials: 9.99 };
    expect(repairRover(poor)).toBe(poor);
    expect(createInitialState().built).toEqual({ batteryBank: false, recycler: false, pylon: false });
    expect(createInitialState().roverRepaired).toBe(false);
    expect(createInitialState().materials).toBe(40);
  });
});

describe('progression scene handles', () => {
  it('doubles scan reveal reach and restores the original range on reset', () => {
    const deposits = [55, 55.01, 110, 110.01].map((x, id) => ({ id, x, z: 0,
      height: 0, type: 'oxygen' as const, harvested: false }));
    const scan = createScanner(deposits, new THREE.Vector3());
    expect(SCAN_RADIUS).toBe(55);
    scan.pulse();
    expect(scan.nearby(new THREE.Vector3(), 200).map((d) => d.id)).toEqual([0]);
    scan.setRangeMultiplier(2);
    scan.pulse();
    expect(scan.nearby(new THREE.Vector3(), 200).map((d) => d.id)).toEqual([0, 1, 2]);
    scan.update(1.75);
    expect(scan.group.children.at(-1)!.scale.x).toBe(55);
    const reset = createScanner(deposits, new THREE.Vector3());
    reset.setRangeMultiplier(1);
    reset.pulse();
    expect(reset.nearby(new THREE.Vector3(), 200).map((d) => d.id)).toEqual([0]);
  });

  it('keeps slots clear, animates solid modules, resets holograms and stays below the mesh budget', () => {
    const outpost = buildOutpost();
    const scene = new THREE.Scene();
    const positions = [new THREE.Vector3(-7, 0.09, 0), new THREE.Vector3(3.7, 0.09, -2.6), new THREE.Vector3(2.2, 0.09, 4.3)];
    const slots = createModuleSlots(scene, positions);
    positions.forEach((p) => {
      for (const c of outpost.colliders) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(c.r + 0.65);
      expect((p.x / 9.5) ** 2 + (p.z / 5.225) ** 2).toBeLessThan(1);
      expect(Math.abs(p.x)).toBeGreaterThan(1.2); // chevron corridor stays open
    });
    const kinds = ['batteryBank', 'recycler', 'pylon'] as const;
    slots.forEach((slot, index) => slot.markBuilt(kinds[index]));
    const roots = scene.children;
    slots.forEach((slot) => slot.update(0.5));
    roots.forEach((root) => {
      expect(root.children[0].visible).toBe(false);
      expect(root.children[2].scale.y).toBeGreaterThan(0.5);
      expect(root.children[2].scale.y).toBeLessThan(1);
    });
    slots.forEach((slot) => slot.update(0.5));
    roots.forEach((root) => expect(root.children[2].scale.y).toBe(1));
    slots.forEach((slot) => slot.reset());
    roots.forEach((root) => {
      expect(root.children[0].visible).toBe(true);
      expect(root.children[2].visible).toBe(false);
    });
    slots.forEach((slot, index) => slot.markBuilt(kinds[index]));
    const rover = new THREE.Group();
    scene.add(rover);
    const condition = createRoverCondition(rover);
    condition.update(0.5);
    expect(rover.children[0].visible).toBe(true);
    condition.setRepaired(true);
    expect(rover.children[0].visible).toBe(false);
    expect(rover.children[1].visible).toBe(true);
    condition.setRepaired(false);
    expect(rover.children[0].visible).toBe(true);
    expect(rover.children[1].visible).toBe(false);
    let meshes = 0;
    scene.traverse((object) => { if (object instanceof THREE.Mesh) meshes++; });
    expect(meshes).toBe(21);
    expect(meshes).toBeLessThan(45);
  });
});

describe('staged missions', () => {
  it('reveals stages in order and reports each reward transition only once', () => {
    const state = createInitialState(600);
    const initial = missionProgress(state, { depositsCollected: 2 });
    expect(initial.stageIndex).toBe(0);
    expect(initial.stages.map((stage) => stage.title)).toEqual(['Establecer el puesto']);
    expect(initial.completed).toEqual([]);
    const first = missionProgress(state, { depositsCollected: 3 });
    expect(first.stageIndex).toBe(1);
    expect(first.completed.map((stage) => stage.rewardMaterials)).toEqual([15]);
    expect(first.stages).toHaveLength(2);
    const waiting = missionProgress({ ...state, stormsSurvived: 1, oxygen: 59 }, { depositsCollected: 3 }, 1);
    expect(waiting.stageIndex).toBe(1);
    const second = missionProgress({ ...state, stormsSurvived: 1, oxygen: 60 }, { depositsCollected: 3 }, 1);
    expect(second.stageIndex).toBe(2);
    expect(second.completed.map((stage) => stage.rewardMaterials)).toEqual([15]);
    const repeated = missionProgress({ ...state, oxygen: 20 }, { depositsCollected: 3 }, 2);
    expect(repeated.stageIndex).toBe(2);
    expect(repeated.completed).toEqual([]);
    const final = missionProgress({ ...state, stormsSurvived: 3 }, { depositsCollected: 3 }, 2);
    expect(final.allDone).toBe(true);
    expect(final.stages).toHaveLength(3);
    expect(final.completed.map((stage) => stage.rewardMaterials)).toEqual([20]);
    expect(missionProgress(state, { depositsCollected: 3 }, 3).completed).toEqual([]);
  });

  it('accepts cycle survival for the final stage but never skips an earlier requirement', () => {
    const state = { ...createInitialState(600), gameOverReason: 'survived', stormsSurvived: 1 };
    expect(missionProgress(state, { depositsCollected: 2 }).stageIndex).toBe(0);
    const progress = missionProgress(state, { depositsCollected: 3 });
    expect(progress.allDone).toBe(true);
    expect(progress.completed.map((stage) => stage.rewardMaterials)).toEqual([15, 15, 20]);
  });
});

describe('science logbook', () => {
  it('names discoveries deterministically from their deposit index', () => {
    expect([0, 1, 2].map(discoveryName)).toEqual(['Loma Cian', 'Aguja Oxidada', 'Grieta Ámbar']);
    expect(discoveryName(8)).toBe(discoveryName(8));
    expect(new Set(Array.from({ length: 9 }, (_, i) => discoveryName(i))).size).toBe(9);
  });

  it('keeps the newest 50 entries and mission-day timestamps without mutating prior entries', () => {
    let entries = appendLogEntry([], 0, 'First discovery');
    const first = entries;
    for (let i = 1; i <= 50; i++) entries = appendLogEntry(entries, i * 60, `Entry ${i}`);
    expect(first).toEqual([{ day: 1, text: 'First discovery' }]);
    expect(entries).toHaveLength(50);
    expect(entries[0]).toEqual({ day: 2, text: 'Entry 1' });
    expect(entries[49]).toEqual({ day: 51, text: 'Entry 50' });
  });
});

describe('difficulty', () => {
  it('defaults to guided and retains an explicit challenge selection', () => {
    expect(createInitialState(600).difficulty).toBe('guided');
    expect(createInitialState(600, 'challenge').difficulty).toBe('challenge');
  });

  it('scales passive drains without changing battery or storm damage', () => {
    const scenario = (difficulty: 'guided' | 'challenge') => tick({
      ...createInitialState(600, difficulty), elapsed: 400, battery: 0, materials: 0,
      shield: 50, oxygen: 50, comms: 50,
      activeEvent: { shieldDamagePerSecond: 2 }, stormRemaining: 5,
    }, 1);
    const guided = scenario('guided');
    const challenge = scenario('challenge');
    for (const [key, drain] of [['shield', 0.35], ['oxygen', 0.55], ['comms', 0.25]] as const) {
      const damage = key === 'shield' ? 2 : 0;
      expect(guided[key]).toBeCloseTo(50 - damage - drain * 0.6);
      expect(challenge[key]).toBeCloseTo(50 - damage - drain * 1.4);
      expect(guided[key]).toBeGreaterThan(challenge[key]);
    }
    expect(guided.battery).toBe(challenge.battery);
    expect(guided.stormRemaining).toBe(4);
    expect(challenge.stormRemaining).toBe(4);
  });

  it('discounts guided repairs, preserving the challenge base cost', () => {
    for (const difficulty of ['guided', 'challenge'] as const) {
      const start = { ...createInitialState(600, difficulty), elapsed: 150, shield: 50,
        allocation: { shield: 100, oxygen: 0, comms: 0 } };
      const result = tick(start, 1);
      expect(result.shield).toBe(53);
      expect(start.materials - result.materials).toBeCloseTo(3 * 0.5 * (difficulty === 'guided' ? 0.7 : 1));
      expect(start.shield).toBe(50);
    }
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

  it('high allocation to shield repairs it while powered with materials', () => {
    const start = { ...createInitialState(600), elapsed: 150, shield: 90, allocation: { shield: 60, oxygen: 30, comms: 10 } };
    const s = runSeconds(start, 2);
    expect(s.shield).toBeGreaterThan(90);
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

describe('materials economy', () => {
  const powered = () => ({ ...createInitialState(600), elapsed: 150 });

  it.each(['shield', 'oxygen', 'comms'] as const)('repairs %s at the guided discount without mutating the input', (key) => {
    const start = { ...powered(), shield: 50, oxygen: 50, comms: 50,
      allocation: { shield: 0, oxygen: 0, comms: 0, [key]: 100 } };
    const before = structuredClone(start);
    const s = tick(start, 1);
    const drain = (key === 'oxygen' ? 0.55 : key === 'comms' ? 0.25 : 0) * 0.6;
    expect(s[key] - start[key] + drain).toBeCloseTo((start.materials - s.materials) / 0.35);
    expect(s.materials).toBeLessThan(start.materials);
    expect(start).toEqual(before);
  });

  it('stops regen at zero materials while retaining breathing, drift and storm damage', () => {
    const s = tick({ ...powered(), materials: 0, shield: 50, oxygen: 50, comms: 50,
      activeEvent: { shieldDamagePerSecond: 2 }, stormRemaining: 5 }, 1);
    expect(s.materials).toBe(0);
    expect(s.shield).toBe(48);
    expect(s.oxygen).toBeCloseTo(49.67);
    expect(s.comms).toBeCloseTo(49.85);
    expect(s.stormRemaining).toBe(4);
    expect(s.gameOver).toBe(false);
    expect(s.gameOverReason).toBeNull();
  });

  it('limits the last repair to the materials remaining', () => {
    const s = tick({ ...powered(), materials: 0.1, shield: 50, oxygen: 50, comms: 50 }, 1);
    expect(s.materials).toBe(0);
    expect(s.shield).toBeCloseTo(50 + 0.1 / 0.35);
    expect(s.oxygen).toBeCloseTo(49.67);
    expect(s.comms).toBeCloseTo(49.85);
  });

  it('charges only for repair that fits below the meter cap', () => {
    const s = tick({ ...powered(), shield: 99.9, allocation: { shield: 100, oxygen: 0, comms: 0 } }, 1);
    expect(s.shield).toBe(100);
    expect(s.materials).toBeCloseTo(39.965);
  });

  it('requires more than one quarter power for each recycler', () => {
    const s = tick({ ...powered(), shield: 50, oxygen: 50, comms: 50,
      allocation: { shield: 25, oxygen: 25, comms: 50 } }, 1);
    expect(s.shield).toBeCloseTo(49.79);
    expect(s.oxygen).toBeCloseTo(49.67);
    expect(s.comms).toBeGreaterThan(50);
  });

  it('does not make empty materials a defeat or prevent mission completion', () => {
    const s = tick({ ...powered(), materials: 0 }, 1);
    expect(s.gameOver).toBe(false);
    expect(s.gameOverReason).toBeNull();
    const completed = tick({ ...s, elapsed: 599 }, 1);
    expect(completed.gameOver).toBe(true);
    expect(completed.gameOverReason).toBe('survived');
  });

  it.each(DEPOSIT_TYPES)('adds materials alongside the existing %s harvest reward, with caps', (type) => {
    const start = { ...powered(), oxygen: 50, shield: 50, battery: 50, materials: 0 };
    const s = applyHarvest(start, { type });
    const key = type === 'sodium' ? 'shield' : type;
    expect(s).toEqual({ ...start, [key]: 75, materials: 3.75 });
    expect(start.materials).toBe(0);
    expect(applyHarvest({ ...start, [key]: 99, materials: 99 }, { type }))
      .toEqual({ ...start, [key]: 100, materials: 100 });
  });

  it('budgets three storms totaling 25 powered seconds at the guided discount', () => {
    let s = powered();
    for (const duration of [8, 8, 9]) {
      s = { ...s, activeEvent: { shieldDamagePerSecond: 2 }, stormRemaining: duration };
      s = runSeconds(s, duration, 1);
    }
    expect(s.stormsSurvived).toBe(3);
    expect(s.gameOver).toBe(false);
    expect(40 - s.materials).toBeCloseTo(12.9675);
    const fraction = (40 - s.materials) / (9 * 3.75);
    expect(fraction).toBeGreaterThanOrEqual(0.38);
    expect(fraction).toBeLessThanOrEqual(0.39);
  });

  it('keeps a nine-deposit run within the materials budget', () => {
    let s = { ...powered(), materials: 0 };
    for (let i = 0; i < 9; i++) s = applyHarvest(s, { type: DEPOSIT_TYPES[i % 3] });
    expect(s.materials).toBe(33.75);
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
