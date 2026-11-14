// Storm coordinator: schedules real DONKI storm specs into a mission and
// applies them to the simulation at the right moment (with lead time).

import { startStorm, type GameState } from '../sim';
import type { StormSpec } from './donki';
import { FALLBACK_STORMS } from './fallback-storms';

export interface ScheduledStorm extends StormSpec {
  /** Mission elapsed time (s) at which the storm begins hitting the outpost. */
  startAt: number;
  announced: boolean;
  hit: boolean;
}

/**
 * Build the mission schedule. If DONKI gave us storms, use them (real events);
 * otherwise fall back to an embedded real dataset (brief-allowed). Order is
 * shuffled deterministically from the seed so replays differ but stay stable.
 */
export function scheduleStorms(
  storms: StormSpec[],
  missionLength: number,
  seed: number,
): ScheduledStorm[] {
  const pool = storms.length > 0 ? storms : FALLBACK_STORMS;
  const shuffled = seededShuffle(pool, seed);

  // Distribute across the mission, skipping the first 20% (grace period)
  // and reserving a lead-time announcement before each hit.
  const windowStart = missionLength * 0.2;
  const windowLen = missionLength * 0.8;
  return shuffled.slice(0, 4).map((storm, i) => ({
    ...storm,
    startAt: windowStart + (windowLen * i) / Math.min(4, shuffled.length),
    announced: false,
    hit: false,
  }));
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Advance storm scheduling for this frame; mutates the schedule in place. */
export function updateStorms(schedule: ScheduledStorm[], state: GameState, dt: number): GameState {
  let next = state;
  for (const storm of schedule) {
    const active = next.activeEvent !== null && next.stormRemaining > 0;
    if (!storm.hit && next.elapsed + dt >= storm.startAt && !active) {
      next = startStorm(next, storm.damagePerSecond, storm.durationSeconds);
      storm.hit = true;
      storm.announced = true;
    } else if (!storm.announced && next.elapsed + dt >= storm.startAt - storm.leadTimeSeconds) {
      storm.announced = true;
    }
  }
  return next;
}
