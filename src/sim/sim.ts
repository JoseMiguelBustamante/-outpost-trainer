// Core simulation engine for the lunar outpost.
// Pure, deterministic, framework-free: the scene/UI layers drive tick().

/** Shared upper bound for all metered resources (0..MAX_RESOURCE). */
export const MAX_RESOURCE = 100;

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

export interface GameState {
  /** Seconds of mission time elapsed. */
  elapsed: number;
  /** Mission length of one full lunar day+night cycle, in seconds (game time). */
  readonly cycleLength: number;
  isDay: boolean;
  /** Solar generation units per second right now (0 at night). */
  solarGeneration: number;
  battery: number;
  shield: number;
  oxygen: number;
  comms: number;
  allocation: PowerAllocation;
  /** Seconds remaining of the active storm, if any. */
  stormRemaining: number;
  activeEvent: SimEvent | null;
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
const RESOURCE_REGEN = 6; // regen per second when a system is well powered

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
  if (net > 0 && s.battery < MAX_RESOURCE) {
    s.battery = clamp(s.battery + net * 0.8 * dt);
  } else if (net < 0 || !s.isDay) {
    const deficit = s.isDay ? Math.max(0, consumptionDemand - s.solarGeneration) : consumptionDemand;
    const fromBattery = Math.min(deficit * dt, s.battery);
    s.battery -= fromBattery;
  }

  // --- consumers ---
  const powerFor = (pct: number): number => poweredFraction * (pct / 100); // 0..1

  // Shield: regen when well powered, decay otherwise, storm damage on top.
  const shieldPower = powerFor(alloc.shield);
  let shieldDelta = (shieldPower > 0.25 ? RESOURCE_REGEN * shieldPower : -SHIELD_DECAY) * dt;
  if (s.activeEvent && s.stormRemaining > 0) {
    shieldDelta -= s.activeEvent.shieldDamagePerSecond * dt;
    s.stormRemaining = Math.max(0, s.stormRemaining - dt);
    if (s.stormRemaining === 0) s.activeEvent = null;
  }
  s.shield = clamp(s.shield + shieldDelta);

  // Oxygen: base drain plus regen if the recycler is powered.
  const oxygenPower = powerFor(alloc.oxygen);
  const oxygenDelta = (RESOURCE_REGEN * oxygenPower - OXYGEN_BASE_DRAIN) * dt;
  s.oxygen = clamp(s.oxygen + oxygenDelta);

  // Comms: slow decay; regen when powered. Missions need comms > 0 for points.
  const commsPower = powerFor(alloc.comms);
  const commsDelta = (RESOURCE_REGEN * commsPower * 0.7 - COMMS_DECAY) * dt;
  s.comms = clamp(s.comms + commsDelta);

  // --- game over conditions ---
  if (s.oxygen <= 0) {
    s.gameOver = true;
    s.gameOverReason = 'oxygen';
  } else if (s.shield <= 0 && !s.gameOver) {
    s.gameOver = true;
    s.gameOverReason = 'shield';
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

/** Fresh state for a new mission. cycleLength is game seconds for one day+night. */
export function createInitialState(cycleLength = 120): GameState {
  return {
    elapsed: 0,
    cycleLength,
    isDay: true,
    solarGeneration: BASE_SOLAR_OUTPUT,
    battery: MAX_RESOURCE,
    shield: MAX_RESOURCE,
    oxygen: MAX_RESOURCE,
    comms: MAX_RESOURCE,
    allocation: { shield: 33.4, oxygen: 33.3, comms: 33.3 },
    stormRemaining: 0,
    activeEvent: null,
    gameOver: false,
    gameOverReason: null,
  };
}
