// Lunar Outpost Trainer — entry point.
// Bootstraps the 3D scene, the simulation, DONKI storms and the HUD loop.

import { createGameScene } from './scene';
import { createInitialState, tick, type GameState } from './sim';
import { createHud } from './ui/hud';
import { createAlerts } from './ui/alerts';
import { fetchDonkiEvents, stormsFromEvents } from './donki/donki';
import { scheduleStorms, updateStorms, type ScheduledStorm } from './donki/storms';

const MISSION_LENGTH = 600; // game seconds (one full day+night at 120s per half? no: full cycle)

function boot(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#game-canvas element not found or not a canvas');
  }
  const hudEl = document.getElementById('hud');
  if (!hudEl) throw new Error('#hud element not found');

  const game = createGameScene(canvas);
  window.addEventListener('resize', game.handleResize);

  let state: GameState = createInitialState(MISSION_LENGTH);
  let schedule: ScheduledStorm[] = scheduleStorms([], MISSION_LENGTH, 20261114); // fallback until DONKI answers
  const hud = createHud(hudEl, (alloc) => {
    state = { ...state, allocation: alloc };
  });
  const alerts = createAlerts(hudEl);

  // Real data first: fetch recent DONKI events; on failure keep fallback.
  fetchDonkiEvents()
    .then(({ cmes, gsts }) => {
      const storms = stormsFromEvents(cmes, gsts);
      schedule = scheduleStorms(storms, MISSION_LENGTH, 20261114);
      console.info(`[DONKI] loaded ${storms.length} real storms`);
    })
    .catch((err) => {
      console.warn('[DONKI] unavailable, using embedded real dataset:', err.message);
    });

  const SIM_DT = 0.1;
  let simAccumulator = 0;
  let last = performance.now();

  const frame = (now: number): void => {
    const delta = Math.min((now - last) / 1000, 0.25);
    last = now;

    simAccumulator += delta;
    while (simAccumulator >= SIM_DT) {
      state = updateStorms(schedule, state, SIM_DT);
      state = tick(state, SIM_DT);
      simAccumulator -= SIM_DT;
    }
    hud.update(state);
    alerts.update(schedule, state.elapsed);

    game.update(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
