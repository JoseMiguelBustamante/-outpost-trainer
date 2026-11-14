// Lunar Outpost Trainer — entry point.
// Bootstraps the 3D scene (terrain, outpost, lighting, orbit camera).

import { createGameScene } from './scene';

function boot(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#game-canvas element not found or not a canvas');
  }

  const game = createGameScene(canvas);

  window.addEventListener('resize', game.handleResize);

  const hud = document.getElementById('hud');
  if (hud) {
    // Placeholder HUD text; real meters arrive with the simulation (T3).
    hud.textContent = '';
  }
}

boot();
