// Full-screen overlays: mission tutorial at boot and game-over/victory screens.
// Pure helpers (gameOverTitle, gameOverDetail, missionSummary) are exported
// for tests; the DOM wiring is thin and only runs in the browser.

import type { GameState } from '../sim';

export type GameOverReason = 'oxygen' | 'shield' | 'survived' | string;

/** Headline for the end-of-mission screen, keyed by the sim's gameOverReason. */
export function gameOverTitle(reason: GameOverReason): string {
  switch (reason) {
    case 'oxygen':
      return 'Oxygen ran out!';
    case 'shield':
      return 'Shield destroyed!';
    case 'survived':
      return 'Mission accomplished! 🌕';
    default:
      return 'Mission ended';
  }
}

/** One-sentence explanation of why the mission ended, kid-friendly. */
export function gameOverDetail(reason: GameOverReason): string {
  switch (reason) {
    case 'oxygen':
      return 'The crew ran out of oxygen. Keep the oxygen recycler powered — even at night.';
    case 'shield':
      return 'A real solar storm broke through the shield. Slide shield power up when the alarm sounds.';
    case 'survived':
      return 'You survived a full lunar day and night. Every storm in this run was a real NASA DONKI event — see the Science page for the data.';
    default:
      return 'The mission came to an end.';
  }
}

/** "2 storms survived · Day 5 of 14" line for the end screen. */
export function missionSummary(s: GameState): string {
  const n = s.stormsSurvived;
  const stormPart = n === 1 ? '1 storm survived' : `${n} storms survived`;
  const day = Math.floor(s.elapsed / 60) + 1;
  const total = Math.round(s.cycleLength / 60);
  return `${stormPart} · Day ${day} of ${total}`;
}

export interface OverlayHandle {
  root: HTMLElement;
  /** Show the end screen with the given sim reason and final state. */
  showGameOver: (reason: GameOverReason, state: GameState) => void;
  hideGameOver: () => void;
}

function buildGameOverCard(
  titleEl: HTMLElement,
  detailEl: HTMLElement,
  scoreEl: HTMLElement,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'overlay-card';
  const icon = document.createElement('div');
  icon.className = 'overlay-icon';
  card.appendChild(icon);
  titleEl.id = 'go-title';
  card.appendChild(titleEl);
  detailEl.className = 'overlay-detail';
  card.appendChild(detailEl);
  scoreEl.className = 'overlay-score';
  card.appendChild(scoreEl);
  return card;
}

export function createOverlays(container: HTMLElement, onRetry: () => void): OverlayHandle {
  const root = document.createElement('div');
  root.className = 'overlay-layer';
  container.appendChild(root);

  const titleEl = document.createElement('h2');
  const detailEl = document.createElement('p');
  const scoreEl = document.createElement('p');
  const iconEl = document.createElement('div');
  iconEl.className = 'overlay-icon';

  const overlay = document.createElement('div');
  overlay.className = 'hud-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'go-title');
  const card = buildGameOverCard(titleEl, detailEl, scoreEl);
  card.insertBefore(iconEl, card.firstChild);

  const retry = document.createElement('button');
  retry.className = 'overlay-cta';
  retry.textContent = '🔁 Retry mission';
  retry.addEventListener('click', onRetry);
  card.appendChild(retry);
  overlay.appendChild(card);
  root.appendChild(overlay);

  const showGameOver = (reason: GameOverReason, state: GameState): void => {
    const won = reason === 'survived';
    overlay.classList.toggle('victory', won);
    iconEl.textContent = won ? '🌕' : '💥';
    titleEl.textContent = gameOverTitle(reason);
    detailEl.textContent = gameOverDetail(reason);
    scoreEl.textContent = missionSummary(state);
    root.classList.add('show');
    retry.focus();
  };

  const hideGameOver = (): void => {
    root.classList.remove('show');
  };

  return { root, showGameOver, hideGameOver };
}

/**
 * Build the boot tutorial overlay. Returns the root element; the caller
 * removes it when the player presses start.
 */
export function createTutorial(
  container: HTMLElement,
  onStart: () => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'hud-overlay show tutorial';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tut-title');

  const card = document.createElement('div');
  card.className = 'overlay-card';

  const icon = document.createElement('div');
  icon.className = 'overlay-icon';
  icon.textContent = '🌙';
  card.appendChild(icon);

  const title = document.createElement('h2');
  title.id = 'tut-title';
  title.textContent = 'Welcome, Junior Astronaut';
  card.appendChild(title);

  const intro = document.createElement('p');
  intro.className = 'overlay-detail';
  intro.textContent =
    'You run a real Moon outpost at the lunar south pole. NASA tracked actual solar storms — they will hit your shield.';
  card.appendChild(intro);

  const rules = document.createElement('ul');
  rules.className = 'overlay-rules';
  for (const rule of [
    ['One power budget', 'shield, oxygen and comms share a single battery — every point matters.'],
    ['Storms are real', 'when the alarm sounds, move power to the shield.'],
    ['SCAN', 'press the scan button to reveal resource deposits, then tap them to collect.'],
  ] as const) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = `${rule[0]} — `;
    li.appendChild(b);
    li.appendChild(document.createTextNode(rule[1]));
    rules.appendChild(li);
  }
  card.appendChild(rules);

  const start = document.createElement('button');
  start.className = 'overlay-cta';
  start.textContent = '🚀 Start mission';
  start.addEventListener('click', onStart);
  card.appendChild(start);

  overlay.appendChild(card);
  container.appendChild(overlay);
  return overlay;
}
