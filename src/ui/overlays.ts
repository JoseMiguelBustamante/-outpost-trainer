// Full-screen overlays: mission tutorial at boot and game-over/victory screens.
// Pure helpers (gameOverTitle, gameOverDetail, missionSummary) are exported
// for tests; the DOM wiring is thin and only runs in the browser.

import type { Difficulty, GameState } from '../sim';
import { renderBadgeChips, type BadgeId } from './logbook';

export type GameOverReason = 'oxygen' | 'shield' | 'survived' | string;

/** Headline for the end-of-mission screen, keyed by the sim's gameOverReason. */
export function gameOverTitle(reason: GameOverReason): string {
  switch (reason) {
    case 'oxygen':
      return '¡Se acabó el oxígeno!';
    case 'shield':
      return '¡Escudo destruido!';
    case 'survived':
      return '¡Misión cumplida! 🌕';
    default:
      return 'Misión terminada';
  }
}

/** One-sentence explanation of why the mission ended, kid-friendly. */
export function gameOverDetail(reason: GameOverReason): string {
  switch (reason) {
    case 'oxygen':
      return 'La tripulación se quedó sin oxígeno. Mantén encendido el reciclador de oxígeno, incluso de noche.';
    case 'shield':
      return 'Una tormenta solar real atravesó el escudo. Dale más energía al escudo cuando suene la alarma.';
    case 'survived':
      return 'Sobreviviste un día y una noche lunar completos. Cada tormenta fue un evento real de NASA DONKI. Consulta los datos en la página de ciencia.';
    default:
      return 'La misión llegó a su fin.';
  }
}

/** "2 storms survived · Day 5 of 14" line for the end screen. */
export function missionSummary(s: GameState): string {
  const n = s.stormsSurvived;
  const stormPart = `Tormentas sobrevividas: ${n}`;
  const day = Math.floor(s.elapsed / 60) + 1;
  const total = Math.round(s.cycleLength / 60);
  return `${stormPart} · Día ${day} de ${total}`;
}

export interface ShowcaseData {
  built: GameState['built'];
  depositsCollected: number;
  badges: readonly BadgeId[];
  difficulty: Difficulty;
}

export interface OverlayHandle {
  root: HTMLElement;
  /** Show the end screen with the given sim reason and final state. */
  showGameOver: (reason: GameOverReason, state: GameState, extra?: ShowcaseData) => void;
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

  const showcase = document.createElement('section');
  showcase.className = 'victory-showcase';
  showcase.hidden = true;
  card.appendChild(showcase);

  const retry = document.createElement('button');
  retry.className = 'overlay-cta';
  retry.textContent = '🔁 Reintentar';
  retry.addEventListener('click', onRetry);
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;';
  retry.style.padding = '12px 14px';
  actions.appendChild(retry);
  const science = document.createElement('a');
  science.className = 'overlay-cta overlay-science-link';
  science.textContent = '🔬 Ver la ciencia';
  science.href = '/science.html';
  science.target = '_blank';
  science.rel = 'noopener';
  science.style.cssText = 'display: inline-flex; align-items: center; padding: 12px 14px; background: transparent; border: 1px solid #7fd8ff; color: #7fd8ff; text-decoration: none;';
  actions.appendChild(science);
  card.appendChild(actions);
  overlay.appendChild(card);
  root.appendChild(overlay);

  const showGameOver = (reason: GameOverReason, state: GameState, extra?: ShowcaseData): void => {
    const won = reason === 'survived';
    overlay.classList.toggle('victory', won);
    iconEl.textContent = won ? '🌕' : '💥';
    titleEl.textContent = gameOverTitle(reason);
    detailEl.textContent = gameOverDetail(reason);
    scoreEl.textContent = `${missionSummary(state)} · ${state.difficulty === 'challenge' ? 'Desafío' : 'Guiado'}`;
    showcase.replaceChildren();
    showcase.hidden = !won;
    if (won) {
      const heading = document.createElement('h3');
      heading.textContent = 'Tu puesto de avanzada';
      const achievements = document.createElement('ul');
      achievements.className = 'showcase-stats';
      const built = extra?.built ?? state.built;
      const modules = [
        built.batteryBank && '🔋 Banco de Baterías',
        built.recycler && '♻️ Reciclador',
        built.pylon && '🛡 Pilar de Escudo',
      ].filter(Boolean);
      for (const text of [
        `Tormentas sobrevividas: ${state.stormsSurvived}`,
        `Día: ${Math.floor(state.elapsed / 60) + 1}`,
        `Dificultad: ${(extra?.difficulty ?? state.difficulty) === 'challenge' ? 'Desafío' : 'Guiado'}`,
        `Depósitos recolectados: ${extra?.depositsCollected ?? 0}`,
        `Módulos construidos: ${modules.length ? modules.join(' · ') : 'Ninguno'}`,
      ]) {
        const item = document.createElement('li');
        item.textContent = text;
        achievements.appendChild(item);
      }
      const badgesHeading = document.createElement('h4');
      badgesHeading.textContent = 'Insignias obtenidas';
      const badges = renderBadgeChips(extra?.badges ?? [], false);
      if (!badges.childElementCount) badges.textContent = 'Todavía no tienes insignias';
      showcase.append(heading, achievements, badgesHeading, badges);
    }
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
  onStart: (difficulty: Difficulty) => void,
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
  title.textContent = 'Bienvenido, Astronauta Junior';
  card.appendChild(title);

  const intro = document.createElement('p');
  intro.className = 'overlay-detail';
  intro.textContent =
    'Dirige un puesto de avanzada en el polo sur de la Luna. La NASA registró tormentas solares reales: aquí pondrán a prueba tu escudo.';
  card.appendChild(intro);

  const rules = document.createElement('ul');
  rules.className = 'overlay-rules';
  for (const rule of [
    ['Una sola reserva de energía', 'el escudo, el oxígeno y las comunicaciones comparten una batería. Cada punto cuenta.'],
    ['Las tormentas son reales', 'cuando suene la alarma, dale más energía al escudo.'],
    ['ESCANEAR + BITÁCORA', 'escanea para revelar depósitos. Camina hasta ellos o tócalos para recolectar materiales. Abre la BITÁCORA para ver tus descubrimientos y las tormentas de la NASA.'],
    ['Etapas de la expedición', 'recolecta 3 depósitos, cuida a la tripulación durante una tormenta y sobrevive la emergencia. Cada etapa completa te da materiales para reparar.'],
    ['Insignias y colores del traje', 'sobrevive una tormenta, construye los 3 módulos, recolecta 6 depósitos y sobrevive el ciclo para ganar insignias en la BITÁCORA. Las insignias de tormenta, construcción y ciclo desbloquean detalles naranja, violeta y dorado en tu traje. Reintentar borra el progreso.'],
  ] as const) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = `${rule[0]} — `;
    li.appendChild(b);
    li.appendChild(document.createTextNode(rule[1]));
    rules.appendChild(li);
  }
  card.appendChild(rules);

  let difficulty: Difficulty = 'guided';
  const modes = document.createElement('fieldset');
  modes.className = 'difficulty-options';
  const legend = document.createElement('legend');
  legend.textContent = 'Elige tu dificultad';
  modes.appendChild(legend);
  for (const [value, label, description] of [
    ['guided', '🧭 Guiado', 'drenaje más lento y reparaciones más baratas'],
    ['challenge', '🔥 Desafío', 'menos margen, decaimiento rápido'],
  ] as const) {
    const option = document.createElement('label');
    option.className = 'difficulty-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'difficulty';
    radio.value = value;
    radio.checked = value === difficulty;
    radio.addEventListener('change', () => { if (radio.checked) difficulty = value; });
    const text = document.createElement('span');
    const heading = document.createElement('strong');
    heading.textContent = label;
    const detail = document.createElement('small');
    detail.textContent = description;
    text.append(heading, detail);
    option.append(radio, text);
    modes.appendChild(option);
  }
  card.appendChild(modes);

  const start = document.createElement('button');
  start.className = 'overlay-cta';
  start.textContent = '🚀 Iniciar misión';
  start.addEventListener('click', () => onStart(difficulty));
  card.appendChild(start);

  const science = document.createElement('a');
  science.className = 'overlay-cta overlay-science-link';
  science.textContent = '🔬 Ver la ciencia';
  science.href = '/science.html';
  science.target = '_blank';
  science.rel = 'noopener';
  science.style.cssText = 'display: block; width: fit-content; margin: 12px auto 0; padding: 8px 12px; min-height: 44px; background: transparent; color: #7fd8ff; font-size: 13px; font-weight: 400; text-underline-offset: 3px;';
  card.appendChild(science);

  overlay.appendChild(card);
  container.appendChild(overlay);
  return overlay;
}
