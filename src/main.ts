// Lunar Outpost Trainer — entry point.
// Bootstraps the 3D scene, the simulation, and the HUD, then runs the loop.

import { createGameScene } from './scene';
import { createInitialState, tick, type GameState } from './sim';
import { createHud } from './ui/hud';

function boot(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#game-canvas element not found or not a canvas');
  }
  const hudEl = document.getElementById('hud');
  if (!hudEl) throw new Error('#hud element not found');

  const game = createGameScene(canvas);
  window.addEventListener('resize', game.handleResize);

  let state: GameState = createInitialState(120);
  const hud = createHud(hudEl, (alloc) => {
    state = { ...state, allocation: alloc };
  });

  const SIM_DT = 0.1; // fixed simulation step (s); game time runs ~60x slower than real
  let simAccumulator = 0;
  let last = performance.now();

  const frame = (now: number): void => {
    const delta = Math.min((now - last) / 1000, 0.25); // clamp tab-switch spikes
    last = now;

    simAccumulator += delta;
    while (simAccumulator >= SIM_DT) {
      state = tick(state, SIM_DT);
      simAccumulator -= SIM_DT;
    }
    hud.update(state);

    game.update(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
