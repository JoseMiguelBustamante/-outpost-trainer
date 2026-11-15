// Core simulation engine for the lunar outpost.
// Pure, deterministic, framework-free: the scene/UI layers drive tick().

/** Shared upper bound for all metered resources (0..MAX_RESOURCE). */
export const MAX_RESOURCE = 100;

export const BATTERY_BANK_CAPACITY = 140;
export const MODULE_COSTS = { batteryBank: 20, recycler: 25, pylon: 20 } as const;
export type ModuleKind = keyof typeof MODULE_COSTS;
export const ROVER_REPAIR_COST = 10;
export const RECYCLER_REGEN = 0.8;
export const PYLON_REGEN = 0.5;

export function batteryCapacity(state: { built?: { batteryBank: boolean } }): number {
  return state.built?.batteryBank ? BATTERY_BANK_CAPACITY : MAX_RESOURCE;
}

/** Sliders the player moves. Values are normalized to sum 100 inside tick(). */
export interface PowerAllocation {
  shield: number;
  oxygen: number;
  comms: number;
}

/** External world event applied to the sim (storms arrive in T4 via DONKI). */
export interface SimEvent {
  /** Damage per second applied to the shield while active. */
  shieldDamagePerSecond: number;
}

export type Difficulty = 'guided' | 'challenge';

export interface GameState {
  difficulty: Difficulty;
  built: Record<ModuleKind, boolean>;
  roverRepaired: boolean;
  /** Seconds of mission time elapsed. */
  elapsed: number;
  /** Mission length of one full lunar day+night cycle, in seconds (game time). */
  readonly cycleLength: number;
  isDay: boolean;
  /** Solar generation units per second right now (0 at night). */
  solarGeneration: number;
  battery: number;
  /** Collected repair feedstock; empty materials is not a defeat condition. */
  materials: number;
  shield: number;
  oxygen: number;
  comms: number;
  allocation: PowerAllocation;
  /** Seconds remaining of the active storm, if any. */
  stormRemaining: number;
  activeEvent: SimEvent | null;
  /** Storms that ended without destroying the shield. */
  stormsSurvived: number;
  gameOver: boolean;
  gameOverReason: string | null;
}

// Tuning constants (per-second rates, game-time). Kept small so a full
// cycle plays in a few minutes and kids feel pressure without panic.
const BASE_SOLAR_OUTPUT = 20; // generation units/s at full sun
const BATTERY_CAPACITY_TIME = 150; // seconds of average consumption it can hold
const OXYGEN_BASE_DRAIN = 0.55; // crew breathing, always
const SHIELD_DECAY = 0.35; // passive decay when underpowered
const COMMS_DECAY = 0.25; // drift when underpowered
const RESOURCE_REGEN = 3; // meter points/s scaled by system power (> 0.25)
const MATERIALS_PER_POINT = 0.5; // one material repairs two meter points
// Budget at balanced full power over ~25s of fallback storm damage:
// shield repairs ~25 points + oxygen/comms upkeep 20 points => ~22.5 materials,
// ~67% of the 33.75 materials in nine deposits. Only actual repairs cost stock.
// Blackouts/poor allocation still reduce repairs; battery remains solar-driven.

/** Fraction of the cycle (0..1) elapsed, wrapping. */
function cyclePhase(state: GameState): number {
  return (state.elapsed % state.cycleLength) / state.cycleLength;
}

/** Normalize allocation to sum exactly 100 (avoids divide-by-zero). */
function normalizeAllocation(a: PowerAllocation): PowerAllocation {
  const sum = a.shield + a.oxygen + a.comms;
  if (sum <= 0) return { shield: 100 / 3, oxygen: 100 / 3, comms: 100 / 3 };
  const k = 100 / sum;
  return { shield: a.shield * k, oxygen: a.oxygen * k, comms: a.comms * k };
}

function clamp(v: number): number {
  return Math.min(MAX_RESOURCE, Math.max(0, v));
}

/**
 * Advance the simulation by dt seconds. Returns a new state object;
 * the input state is never mutated.
 */
export function tick(prev: GameState, dt: number): GameState {
  const s: GameState = { ...prev, allocation: { ...prev.allocation } };
  s.elapsed += dt;

  // --- day/night + solar generation ---
  const phase = cyclePhase(s);
  s.isDay = phase < 0.5;
  s.solarGeneration = s.isDay
    ? BASE_SOLAR_OUTPUT * Math.sin(Math.min(1, phase / 0.5) * Math.PI) // soft sunrise/sunset
    : 0;

  // --- power budget ---
  const alloc = normalizeAllocation(s.allocation);
  s.allocation = alloc; // expose normalized values to the UI
  const consumptionDemand = 10; // arbitrary demand units/s the players must cover
  const availablePower = s.solarGeneration + s.battery / BATTERY_CAPACITY_TIME;
  const poweredFraction = Math.min(1, availablePower / consumptionDemand);

  // Battery: charges with surplus, drains to cover deficits.
  const net = s.solarGeneration - consumptionDemand * poweredFraction;
  const capacity = batteryCapacity(s);
  s.battery = Math.min(capacity, Math.max(0, s.battery));
  if (net > 0 && s.battery < capacity) {
    s.battery = Math.min(capacity, s.battery + net * 0.8 * dt);
  } else if (net < 0 || !s.isDay) {
    const deficit = s.isDay ? Math.max(0, consumptionDemand - s.solarGeneration) : consumptionDemand;
    const fromBattery = Math.min(deficit * dt, s.battery);
    s.battery -= fromBattery;
  }

  // Guided eases passive drains to 60% and repair costs to 70%; challenge
  // raises passive drains to 140% with the original material cost.
  // Solar, battery, storm damage, and powered repair rates are unchanged.
  const drainScale = s.difficulty === 'challenge' ? 1.4 : 0.6;
  const materialCost = MATERIALS_PER_POINT * (s.difficulty === 'challenge' ? 1 : 0.7);

  // --- consumers ---
  const powerFor = (pct: number): number => poweredFraction * (pct / 100); // 0..1

  // Shared feedstock is spent in shield, oxygen, comms priority order.
  // Apply damage/drain first, then buy only repairs that fit below the cap.
  const repair = (value: number, power: number, rate = 1): number => {
    const damaged = clamp(value);
    if (power <= 0.25) return damaged;
    const gain = Math.min(MAX_RESOURCE - damaged, RESOURCE_REGEN * power * rate * dt,
      s.materials / materialCost);
    s.materials = clamp(s.materials - gain * materialCost);
    return clamp(damaged + gain);
  };

  // Shield: material-funded repair when well powered, decay otherwise.
  const shieldPower = powerFor(alloc.shield);
  let shieldDelta = (s.built.pylon ? PYLON_REGEN : shieldPower > 0.25 ? 0 : -SHIELD_DECAY * drainScale) * dt;
  if (s.activeEvent && s.stormRemaining > 0) {
    shieldDelta -= s.activeEvent.shieldDamagePerSecond * dt;
    s.stormRemaining = Math.max(0, s.stormRemaining - dt);
    if (s.stormRemaining === 0) {
      s.activeEvent = null;
      if (s.shield > 0) s.stormsSurvived += 1;
    }
  }
  s.shield = repair(s.shield + shieldDelta, shieldPower);

  // Oxygen: breathing continues even without feedstock or recycler power.
  const oxygenPower = powerFor(alloc.oxygen);
  s.oxygen = repair(s.oxygen + ((s.built.recycler ? RECYCLER_REGEN : 0) - OXYGEN_BASE_DRAIN * drainScale) * dt, oxygenPower);

  // Comms: drift continues; powered repairs also consume shared materials.
  const commsPower = powerFor(alloc.comms);
  s.comms = repair(s.comms - COMMS_DECAY * drainScale * dt, commsPower, 0.7);

  // --- game over conditions ---
  if (s.oxygen <= 0) {
    s.gameOver = true;
    s.gameOverReason = 'oxygen';
  } else if (s.shield <= 0 && !s.gameOver) {
    s.gameOver = true;
    s.gameOverReason = 'shield';
  } else if (s.elapsed >= s.cycleLength && !s.gameOver) {
    // Survived one full lunar day+night cycle: mission accomplished.
    s.gameOver = true;
    s.gameOverReason = 'survived';
  }

  return s;
}

/**
 * Begin a storm event on the state (used by the DONKI mapper in T4).
 * Returns a new state; does not mutate.
 */
export function startStorm(prev: GameState, damagePerSecond: number, durationSeconds: number): GameState {
  return {
    ...prev,
    activeEvent: { shieldDamagePerSecond: damagePerSecond },
    stormRemaining: durationSeconds,
  };
}

/** Fixed construction prices are independent of difficulty; rejected actions are no-ops. */
export function buildModule(prev: GameState, kind: ModuleKind): GameState {
  if (prev.gameOver || prev.built[kind] || prev.materials < MODULE_COSTS[kind]) return prev;
  return { ...prev, materials: prev.materials - MODULE_COSTS[kind], built: { ...prev.built, [kind]: true } };
}

export function repairRover(prev: GameState): GameState {
  if (prev.gameOver || prev.roverRepaired || prev.materials < ROVER_REPAIR_COST) return prev;
  return { ...prev, materials: prev.materials - ROVER_REPAIR_COST, roverRepaired: true };
}

/** Fresh state for a new mission. cycleLength is game seconds for one day+night. */
export function createInitialState(cycleLength = 120, difficulty: Difficulty = 'guided'): GameState {
  return {
    difficulty,
    built: { batteryBank: false, recycler: false, pylon: false },
    roverRepaired: false,
    elapsed: 0,
    cycleLength,
    isDay: true,
    solarGeneration: BASE_SOLAR_OUTPUT,
    battery: MAX_RESOURCE,
    materials: 40,
    shield: MAX_RESOURCE,
    oxygen: MAX_RESOURCE,
    comms: MAX_RESOURCE,
    allocation: { shield: 33.4, oxygen: 33.3, comms: 33.3 },
    stormRemaining: 0,
    activeEvent: null,
    stormsSurvived: 0,
    gameOver: false,
    gameOverReason: null,
  };
}
