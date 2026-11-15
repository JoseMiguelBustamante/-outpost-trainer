// Lunar Outpost Trainer — entry point.
// Scene + simulation + DONKI storms + HUD + scanner gameplay.

import * as THREE from 'three';
import { createGameScene } from './scene';
import { createInitialState, tick, MAX_RESOURCE, buildModule, repairRover, MODULE_COSTS, ROVER_REPAIR_COST, type ModuleKind, type GameState } from './sim';
import { applyHarvest, type Deposit } from './game';
import { createModuleSlots, createRoverCondition } from './scene/modules';
import { createPlayerAstronaut } from './scene/astronaut';
import { createStormVisual } from './scene/storm-visual';
import { generateDeposits } from './game';
import { createScanner, type ScannerHandle } from './scene/scanner';
import { createHud } from './ui/hud';
import { createAlerts } from './ui/alerts';
import { createOverlays, createTutorial } from './ui/overlays';
import { createAudio } from './ui/audio';
import { missionProgress } from './game/missions';
import { createObjectives } from './ui/objectives';
import { createLogbook, appendLogEntry, discoveryName, type LogEntry } from './ui/logbook';
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
  const stormVisual = createStormVisual(game.scene);
  game.scene.add(stormVisual.group);
  window.addEventListener('resize', game.handleResize);

  // --- scanner + deposits ---
  let deposits = generateDeposits(game.terrainConfig, SEED, 9, (x, z) => {
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

  // Pad ellipse (9.5 × 5.225): clear of structure footprints, pipes and x=0 chevrons.
  const moduleKinds: ModuleKind[] = ['batteryBank', 'recycler', 'pylon'];
  const moduleNames = { batteryBank: 'Battery Bank', recycler: 'Recycler', pylon: 'Shield Pylon' };
  const moduleEffects = { batteryBank: '+40% battery capacity', recycler: 'free oxygen +0.8/s', pylon: 'no shield decay, free shield +0.5/s' };
  const slots = createModuleSlots(game.scene, [new THREE.Vector3(-7, 0.09, 0),
    new THREE.Vector3(3.7, 0.09, -2.6), new THREE.Vector3(2.2, 0.09, 4.3)]);
  const baseColliders = [...game.outpost.colliders];
  const rover = game.outpost.group.getObjectByName('rover')!;
  const roverPosition = rover.getWorldPosition(new THREE.Vector3());
  const roverCondition = createRoverCondition(rover);

  // Replace the presentation-only suit without changing the outpost builder's API.
  const staticAstronaut = game.outpost.group.getObjectByName('astronaut');
  staticAstronaut?.removeFromParent();
  const keys = new Set<string>();
  const stick = new THREE.Vector2();
  const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
  const isFormControl = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && (target.matches('input, button, select, textarea') || target.isContentEditable);
  window.addEventListener('keydown', (event) => {
    if (!movementKeys.includes(event.code) || isFormControl(event.target)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    resetStick();
  });
  const joystick = document.createElement('div');
  joystick.className = 'player-joystick';
  joystick.setAttribute('aria-label', 'Drag to walk. Desktop: WASD or arrow keys; E to scan.');
  const knob = document.createElement('div');
  knob.className = 'player-joystick-knob';
  joystick.appendChild(knob);
  hudEl.appendChild(joystick);
  let stickPointer: number | null = null;
  function resetStick(): void {
    const pointer = stickPointer;
    stickPointer = null;
    if (pointer !== null && joystick.hasPointerCapture(pointer)) joystick.releasePointerCapture(pointer);
    stick.set(0, 0);
    knob.style.transform = 'translate(0px, 0px)';
  }
  const moveStick = (event: PointerEvent): void => {
    const rect = joystick.getBoundingClientRect();
    stick.set((event.clientX - rect.left - rect.width / 2) / 34,
      (event.clientY - rect.top - rect.height / 2) / 34).clampLength(0, 1);
    const magnitude = stick.length();
    if (magnitude <= 0.12) stick.set(0, 0);
    else stick.multiplyScalar((magnitude - 0.12) / (0.88 * magnitude));
    knob.style.transform = `translate(${stick.x * 34}px, ${stick.y * 34}px)`;
  };
  const consumeStickEvent = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  joystick.addEventListener('pointerdown', (event) => {
    consumeStickEvent(event);
    if (stickPointer !== null) return;
    audio.unlock();
    stickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    consumeStickEvent(event);
    if (event.pointerId === stickPointer) moveStick(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joystick.addEventListener(type, (event) => {
      consumeStickEvent(event);
      if ((event as PointerEvent).pointerId === stickPointer) resetStick();
    });
  }
  const player = createPlayerAstronaut(game.scene, {
    center: outpostPos,
    colliders: game.outpost.colliders,
    terrainHeight: terrainHeightAt,
    movement: () => {
      if (paused || state.gameOver) return new THREE.Vector2();
      const input = stick.clone().add(new THREE.Vector2(
        Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')),
      )).clampLength(0, 1);
      // Use the current rendered camera orientation, independent of follow lerping.
      const forward = game.cameraRig.camera.getWorldDirection(new THREE.Vector3());
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      return new THREE.Vector2(right.x * input.x - forward.x * input.y,
        right.z * input.x - forward.z * input.y);
    },
  });

  // All collection paths share validation, reward, removal, and sound.
  function collect(deposit: Deposit): void {
    if (paused || state.gameOver || !scanner?.harvest(deposit)) return;
    const previousMaterials = state.materials;
    state = applyHarvest(state, deposit);
    stats.depositsCollected++;
    recordLog(`Named discovery: ${discoveryName(deposit.id)} — materials +${Number((state.materials - previousMaterials).toFixed(2))}`);
    advanceObjectives();
    audio.harvest();
  }

  // Click-to-collect via raycast.
  const ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (ev.target !== canvas || !scanner) return;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const deposit = scanner.pick(ndc, game.cameraRig.camera);
    if (deposit) collect(deposit);
  });

  // --- HUD ---
  let state: GameState = createInitialState(MISSION_LENGTH);
  let schedule: ScheduledStorm[] = scheduleStorms([], MISSION_LENGTH, SEED);
  const hud = createHud(hudEl, (alloc) => {
    state = { ...state, allocation: alloc };
  });
  const alerts = createAlerts(hudEl);
  const stats = { depositsCollected: 0 };
  let progress = missionProgress(state, stats);
  let entries: LogEntry[] = [];
  let activeStorm: ScheduledStorm | null = null;
  const missionBanner = hud.root.querySelector<HTMLElement>('.hud-mission')!;
  const objectives = createObjectives(missionBanner);
  const logbook = createLogbook(hudEl, (open) => {
    keys.clear();
    resetStick();
    paused = open;
    simAccumulator = 0;
  });
  function recordLog(text: string): void {
    entries = appendLogEntry(entries, state.elapsed, text);
    logbook.update(entries);
  }
  function advanceObjectives(): void {
    progress = missionProgress(state, stats, progress.stageIndex);
    for (const stage of progress.completed) {
      state = { ...state, materials: Math.min(MAX_RESOURCE, state.materials + stage.rewardMaterials) };
      objectives.celebrate(stage, performance.now());
      recordLog(`Stage completed: ${stage.title} — +${stage.rewardMaterials} materials`);
    }
  }

  // --- overlays: tutorial at boot, game over / victory at the end ---
  const audio = createAudio();
  let paused = true; // sim waits until the tutorial is dismissed

  const resetMission = (): void => {
    state = createInitialState(MISSION_LENGTH, state.difficulty);
    stats.depositsCollected = 0;
    progress = missionProgress(state, stats);
    objectives.reset();
    entries = [];
    logbook.update(entries);
    activeStorm = null;
    simAccumulator = 0;
    slots.forEach((slot) => slot.reset());
    game.outpost.colliders.splice(0, game.outpost.colliders.length, ...baseColliders);
    roverCondition.setRepaired(false);
    interaction.hidden = true;
    currentInteraction = null;
    keys.clear();
    resetStick();
    player.setPosition(outpostPos.x + 0.85, outpostPos.z + 2.8);
    // Reuse the scanner constructor so retry restores both deposit state and visuals.
    scanner?.group.removeFromParent();
    scanner?.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    deposits = generateDeposits(game.terrainConfig, SEED, 9, terrainHeightAt);
    scanner = createScanner(deposits, outpostPos);
    game.scene.add(scanner.group);
    scanner.setRangeMultiplier(1);
    schedule = scheduleStorms(schedule, MISSION_LENGTH, SEED);
    alarmed.clear();
    endedHandled = false;
    overlays.hideGameOver();
    paused = false;
  };
  const overlays = createOverlays(hudEl, resetMission);

  const tutorial = createTutorial(hudEl, (difficulty) => {
    state = createInitialState(MISSION_LENGTH, difficulty);
    progress = missionProgress(state, stats);
    simAccumulator = 0;
    tutorial.remove();
    audio.unlock();
    paused = false;
  });
  // Any tap also unlocks audio (mobile browsers require a gesture).
  window.addEventListener('pointerdown', audio.unlock, { once: true });

  const scanBtn = document.createElement('button');
  scanBtn.className = 'hud-scan-btn';
  scanBtn.textContent = '🔍 SCAN';
  scanBtn.title = 'Reveal resources within 55 units (E), or 110 after rover repair. Walk with WASD / arrows or joystick to collect. Build at cyan pads; repair the rover nearby.';
  scanBtn.style.pointerEvents = 'auto';
  scanBtn.addEventListener('click', () => scanner?.pulse());
  const scanWrap = document.createElement('div');
  scanWrap.className = 'hud-actions';
  scanWrap.appendChild(scanBtn);
  const logBtn = document.createElement('button');
  logBtn.className = 'hud-scan-btn hud-log-btn';
  logBtn.textContent = '📖 LOG';
  logBtn.title = 'Science logbook: discoveries, survived NASA storms, and completed stages. Escape closes.';
  logBtn.setAttribute('aria-haspopup', 'dialog');
  logBtn.addEventListener('click', () => {
    if (!paused && !state.gameOver) logbook.toggle();
  });
  scanWrap.appendChild(logBtn);
  hudEl.appendChild(scanWrap);
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'e' || e.key === 'E') scanner?.pulse();
  });

  // A single proximity prompt serves all construction and rover interactions.
  const interaction = document.createElement('div');
  interaction.className = 'hud-build-prompt';
  interaction.hidden = true;
  const interactionText = document.createElement('span');
  interactionText.setAttribute('aria-live', 'polite');
  const interactionButton = document.createElement('button');
  interactionButton.className = 'hud-scan-btn';
  interaction.append(interactionText, interactionButton);
  hudEl.appendChild(interaction);
  let currentInteraction: number | 'rover' | null = null;
  const distanceTo = (position: THREE.Vector3) => {
    const playerPosition = player.getPosition();
    return Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
  };
  function updateInteraction(): void {
    currentInteraction = null;
    if (!paused && !state.gameOver) {
      const candidates = slots.map((slot, index) => ({ target: index as number | 'rover',
        distance: state.built[moduleKinds[index]] ? Infinity : distanceTo(slot.position) }));
      candidates.push({ target: 'rover', distance: state.roverRepaired ? Infinity : distanceTo(roverPosition) });
      candidates.sort((a, b) => a.distance - b.distance);
      if (candidates[0].distance <= 2.5) currentInteraction = candidates[0].target;
    }
    interaction.hidden = currentInteraction === null;
    if (currentInteraction === null) return;
    const isRover = currentInteraction === 'rover';
    const kind = isRover ? null : moduleKinds[currentInteraction as number];
    const cost = kind ? MODULE_COSTS[kind] : ROVER_REPAIR_COST;
    const affordable = state.materials >= cost;
    interactionText.textContent = affordable
      ? `${kind ? `Build ${moduleNames[kind]}` : 'Repair rover'} — ${cost} 🧪`
      : `Not enough materials (have ${Number(state.materials.toFixed(2))}/${cost})`;
    interactionButton.textContent = isRover ? 'REPAIR' : 'BUILD';
    interactionButton.disabled = !affordable;
  }
  interactionButton.addEventListener('click', () => {
    updateInteraction(); // Revalidate distance, balance and pause at activation time.
    if (currentInteraction === null || interactionButton.disabled) return;
    if (currentInteraction === 'rover') {
      const next = repairRover(state);
      if (next === state) return;
      state = next;
      roverCondition.setRepaired(true);
      scanner?.setRangeMultiplier(2);
      recordLog('Repaired: Rover — SCAN range ×2');
    } else {
      const index = currentInteraction;
      const kind = moduleKinds[index];
      const next = buildModule(state, kind);
      if (next === state) return;
      state = next;
      slots[index].markBuilt(kind);
      game.outpost.colliders.push({ x: slots[index].position.x, z: slots[index].position.z, r: 0.65 });
      recordLog(`Built: ${moduleNames[kind]} — ${moduleEffects[kind]}`);
    }
    audio.harvest();
    updateInteraction();
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
      while (simAccumulator >= SIM_DT && !state.gameOver) {
        const startingStorm = state.stormRemaining <= 0
          ? schedule.find((storm) => !storm.hit && state.elapsed + SIM_DT >= storm.startAt) : undefined;
        state = updateStorms(schedule, state, SIM_DT);
        if (startingStorm?.hit) activeStorm = startingStorm;
        const survived = state.stormsSurvived;
        state = tick(state, SIM_DT);
        if (state.stormsSurvived > survived && activeStorm) {
          recordLog(`Storm survived: ${activeStorm.summary} — NASA DONKI ${activeStorm.sourceId}`);
          activeStorm = null;
        }
        advanceObjectives();
        simAccumulator -= SIM_DT;
      }
    }
    hud.update(state);
    objectives.update(state, stats, progress, now);
    // Keep the opener focusable while the native modal owns focus, so closing
    // with Escape restores focus to LOG rather than dropping it onto the page.
    logBtn.disabled = state.gameOver;
    alerts.update(schedule, state.elapsed, state.stormRemaining);

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

    player.update(delta);
    game.cameraRig.follow(player.getPosition(), delta);
    if (!paused && !state.gameOver) {
      for (const deposit of scanner?.nearby(player.getPosition()) ?? []) collect(deposit);
    }
    scanner?.update(delta);
    slots.forEach((slot) => slot.update(paused ? 0 : delta));
    roverCondition.update(paused ? 0 : delta);
    updateInteraction();

    // DONKI maps a 1420 km/s CME to ~2.36 damage/s: / 2.7 gives ~0.87.
    const intensity = THREE.MathUtils.clamp((state.activeEvent?.shieldDamagePerSecond ?? 0) / 2.7, 0, 1);
    stormVisual.setActive(state.stormRemaining > 0, intensity);
    stormVisual.update(delta);
    game.update(delta);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
