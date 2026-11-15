// Lunar Outpost Trainer — entry point.
// Scene + simulation + DONKI storms + HUD + scanner gameplay.

import * as THREE from 'three';
import { createGameScene } from './scene';
import { createInitialState, tick, type GameState } from './sim';
import { applyHarvest } from './game';
import { generateDeposits } from './game';
import { createScanner, type ScannerHandle } from './scene/scanner';
import { createHud } from './ui/hud';
import { createAlerts } from './ui/alerts';
import { createOverlays, createTutorial } from './ui/overlays';
import { createAudio } from './ui/audio';
import { fetchDonkiEvents, stormsFromEvents } from './donki/donki';
import { scheduleStorms, updateStorms, type ScheduledStorm } from './donki/storms';

const MISSION_LENGTH = 600; // game seconds for a full day+night cycle
const SEED = 20261114;

function boot(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#game-canvas element not found or not a canvas');
  }
  const hudEl = document.getElementById('hud');
  if (!hudEl) throw new Error('#hud element not found');

  const game = createGameScene(canvas);
  window.addEventListener('resize', game.handleResize);

  // --- scanner + deposits ---
  const deposits = generateDeposits(game.terrainConfig, SEED, 9, (x, z) => {
    // USAR terrainHeight real (deterministic) via scene re-export
    return terrainHeightAt(x, z);
  });
  let scanner: ScannerHandle | null = null;
  const outpostPos = game.outpost.group.position.clone();
  scanner = createScanner(deposits, outpostPos);
  game.scene.add(scanner.group);

  function terrainHeightAt(x: number, z: number): number {
    // Re-exported from scene module for gameplay reuse.
    return game.terrainHeight(x, z);
  }

  // Click-to-collect via raycast.
  const ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (!scanner) return;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const deposit = scanner.pick(ndc, game.cameraRig.camera);
    if (deposit) {
      state = applyHarvest(state, deposit);
      scanner.harvest(deposit);
      audio.harvest();
    }
  });

  // --- HUD ---
  let state: GameState = createInitialState(MISSION_LENGTH);
  let schedule: ScheduledStorm[] = scheduleStorms([], MISSION_LENGTH, SEED);
  const hud = createHud(hudEl, (alloc) => {
    state = { ...state, allocation: alloc };
  });
  const alerts = createAlerts(hudEl);

  // --- overlays: tutorial at boot, game over / victory at the end ---
  const audio = createAudio();
  let paused = true; // sim waits until the tutorial is dismissed

  const resetMission = (): void => {
    state = createInitialState(MISSION_LENGTH);
    alarmed.clear();
    endedHandled = false;
    overlays.hideGameOver();
    paused = false;
  };
  const overlays = createOverlays(hudEl, resetMission);

  const tutorial = createTutorial(hudEl, () => {
    tutorial.remove();
    audio.unlock();
    paused = false;
  });
  // Any tap also unlocks audio (mobile browsers require a gesture).
  window.addEventListener('pointerdown', audio.unlock, { once: true });

  const scanBtn = document.createElement('button');
  scanBtn.className = 'hud-scan-btn';
  scanBtn.textContent = '🔍 SCAN';
  scanBtn.style.pointerEvents = 'auto';
  scanBtn.addEventListener('click', () => scanner?.pulse());
  const scanWrap = document.createElement('div');
  scanWrap.className = 'hud-actions';
  scanWrap.appendChild(scanBtn);
  hudEl.appendChild(scanWrap);
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'e' || e.key === 'E') scanner?.pulse();
  });

  // --- DONKI ---
  fetchDonkiEvents()
    .then(({ cmes, gsts }) => {
      const storms = stormsFromEvents(cmes, gsts);
      schedule = scheduleStorms(storms, MISSION_LENGTH, SEED);
      console.info(`[DONKI] loaded ${storms.length} real storms`);
    })
    .catch((err) => {
      console.warn('[DONKI] unavailable, using embedded real dataset:', err.message);
    });

  const SIM_DT = 0.1;
  let simAccumulator = 0;
  let last = performance.now();
  const alarmed = new Set<string>(); // storm source ids that already played the alarm
  let endedHandled = false; // end-of-mission sting + screen fire only once

  const frame = (now: number): void => {
    const delta = Math.min((now - last) / 1000, 0.25);
    last = now;

    if (!paused && !state.gameOver) {
      simAccumulator += delta;
      while (simAccumulator >= SIM_DT) {
        state = updateStorms(schedule, state, SIM_DT);
        state = tick(state, SIM_DT);
        simAccumulator -= SIM_DT;
      }
    }
    hud.update(state);
    alerts.update(schedule, state.elapsed);

    // First-time announcements play the storm alarm once per event.
    for (const storm of schedule) {
      if (storm.announced && !storm.hit && !alarmed.has(storm.sourceId)) {
        alarmed.add(storm.sourceId);
        audio.stormAlarm();
      }
    }

    // End of mission: freeze the sim, show the screen, play the sting.
    if (state.gameOver && !endedHandled) {
      endedHandled = true;
      overlays.showGameOver(state.gameOverReason ?? 'unknown', state);
      if (state.gameOverReason === 'survived') audio.victory();
      else audio.defeat();
    }

    scanner?.update(delta);

    game.update(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
