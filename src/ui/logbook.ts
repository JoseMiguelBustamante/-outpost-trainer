// Science notes are plain data; DOM rendering uses textContent for DONKI data.
import type { GameState } from '../sim';

export type BadgeId = 'firstStorm' | 'baseBuilder' | 'pathfinder' | 'cycleSurvivor';
export interface BadgeStats {
  stormsSurvived: number;
  built: GameState['built'];
  depositsCollected: number;
  gameOverReason: string | null;
  earnedBadges: readonly BadgeId[];
}

export const BADGES: readonly { id: BadgeId; label: string }[] = [
  { id: 'firstStorm', label: '🛡️ Primera tormenta' },
  { id: 'baseBuilder', label: '🏗️ Constructor de la base' },
  { id: 'pathfinder', label: '🧭 Explorador' },
  { id: 'cycleSurvivor', label: '🌕 Sobreviviente del ciclo' },
];

/** Pure per-run awards; the caller persists IDs to prevent duplicate announcements. */
export function awardBadges(stats: BadgeStats) {
  const eligible: Record<BadgeId, boolean> = {
    firstStorm: stats.stormsSurvived >= 1,
    baseBuilder: stats.built.batteryBank && stats.built.recycler && stats.built.pylon,
    pathfinder: stats.depositsCollected >= 6,
    cycleSurvivor: stats.gameOverReason === 'survived',
  };
  return BADGES.filter((badge) => eligible[badge.id] && !stats.earnedBadges.includes(badge.id));
}

export function suitAccent(earned: readonly BadgeId[]): string {
  if (earned.includes('cycleSurvivor')) return '#ffd45e';
  if (earned.includes('baseBuilder')) return '#b48fff';
  if (earned.includes('firstStorm')) return '#f7b84f';
  return '#7fd8ff';
}

/** Shared projection of badge state for the logbook and victory card. */
export function renderBadgeChips(earned: readonly BadgeId[], includeLocked = true): HTMLElement {
  const row = document.createElement('div');
  row.className = 'badge-row';
  row.setAttribute('aria-label', 'Insignias de logros');
  for (const badge of BADGES) {
    const unlocked = earned.includes(badge.id);
    if (!unlocked && !includeLocked) continue;
    const chip = document.createElement('span');
    chip.className = `badge-chip${unlocked ? '' : ' badge-locked'}`;
    chip.textContent = `${unlocked ? '' : '🔒 '}${badge.label}`;
    row.appendChild(chip);
  }
  return row;
}
export interface LogEntry {
  day: number;
  text: string;
}

const COLORS = ['Cian', 'Oxidado', 'Ámbar', 'Plateado', 'Cobrizo'];
const LANDMARKS = ['Loma', 'Aguja', 'Grieta', 'Meseta', 'Cráter'];

export function discoveryName(depositIndex: number): string {
  const color = COLORS[depositIndex % COLORS.length];
  const landmark = LANDMARKS[(depositIndex + Math.floor(depositIndex / COLORS.length)) % LANDMARKS.length];
  const suffix = depositIndex >= 9 ? ` ${Math.floor(depositIndex / 9) + 1}` : '';
  const adjective = landmark === 'Cráter' ? color : color.replace(/o$/, 'a');
  return `${landmark} ${adjective}${suffix}`;
}

/** Match the mission-day convention used by the end-of-mission summary. */
export function appendLogEntry(entries: readonly LogEntry[], elapsed: number, text: string): LogEntry[] {
  return [...entries, { day: Math.floor(elapsed / 60) + 1, text }].slice(-50);
}

export function createLogbook(container: HTMLElement, onToggle: (open: boolean) => void) {
  const dialog = document.createElement('dialog');
  dialog.className = 'logbook-panel';
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'logbook-title');
  const title = document.createElement('h2');
  title.id = 'logbook-title';
  title.textContent = '📖 Bitácora científica';
  const close = document.createElement('button');
  close.className = 'overlay-cta';
  close.textContent = 'Cerrar';
  close.addEventListener('click', () => dialog.close());
  // Native dialog provides focus trapping, Escape dismissal and focus restoration.
  dialog.addEventListener('close', () => {
    pause.hidden = true;
    onToggle(false);
  });
  const list = document.createElement('ol');
  list.className = 'logbook-entries';
  const header = document.createElement('header');
  header.className = 'logbook-header';
  const pause = document.createElement('span');
  pause.className = 'logbook-pause';
  pause.textContent = '⏸ MISIÓN EN PAUSA';
  pause.hidden = true;
  header.append(title, pause);
  const empty = document.createElement('div');
  empty.className = 'logbook-empty';
  const emptyTitle = document.createElement('h3');
  emptyTitle.textContent = 'Tu primer descubrimiento';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Escanea un depósito para crear su ficha.';
  empty.append(emptyTitle, subtitle);
  for (const text of ['🔎 Qué encontraste', '⚙️ Para qué sirve', '📍 Fuente']) {
    const field = document.createElement('div');
    field.className = 'logbook-empty-field';
    field.textContent = text;
    empty.appendChild(field);
  }
  const tabs = document.createElement('div');
  tabs.className = 'logbook-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Secciones de la bitácora');
  const panels = ['hallazgos', 'ciencia', 'logros'].map((id) => {
    const panel = document.createElement('section');
    panel.id = `logbook-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    panel.tabIndex = 0;
    return panel;
  });
  const buttons = ['🔎 Hallazgos', '⚗️ Ciencia', '🏆 Logros'].map((label, index) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.id = panels[index].getAttribute('aria-labelledby')!;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panels[index].id);
    button.addEventListener('click', () => selectTab(index));
    button.addEventListener('keydown', (event) => {
      const next = event.key === 'ArrowRight' ? (index + 1) % 3
        : event.key === 'ArrowLeft' ? (index + 2) % 3
        : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
      if (next === null) return;
      event.preventDefault();
      selectTab(next);
      buttons[next].focus();
    });
    tabs.appendChild(button);
    return button;
  });
  function selectTab(index: number) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  }
  selectTab(0);
  panels[0].append(empty, list);
  const science = document.createElement('dl');
  science.className = 'logbook-science';
  for (const [resource, meaning] of [
    ['🛡️ Escudo', 'Frena tormentas solares.'], ['💨 Oxígeno', 'Mantiene con vida a tu tripulación.'],
    ['📡 Señal', 'Mantiene el contacto con la Tierra.'], ['🔋 Batería', 'Alimenta los sistemas; el Sol la recarga de día.'],
    ['🧪 Materiales', 'Sirven para reparar y construir. Recolecta depósitos para conseguirlos.'],
  ]) {
    const term = document.createElement('dt');
    term.textContent = resource;
    const description = document.createElement('dd');
    description.textContent = meaning;
    science.append(term, description);
  }
  const link = document.createElement('a');
  link.href = './science.html';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Ver la ciencia completa →';
  panels[1].append(science, link);
  let badges = renderBadgeChips([]);
  panels[2].appendChild(badges);
  dialog.append(header, tabs, ...panels, close);
  container.appendChild(dialog);
  return {
    toggle() {
      if (dialog.open) dialog.close();
      else {
        dialog.showModal();
        onToggle(true);
        pause.hidden = false;
        buttons.find((button) => button.getAttribute('aria-selected') === 'true')!.focus();
      }
    },
    update(entries: readonly LogEntry[], earnedBadges: readonly BadgeId[] = [], stats?: BadgeStats) {
      const nextBadges = renderBadgeChips(earnedBadges);
      const counts: Record<BadgeId, [number, number]> = {
        firstStorm: [Math.min(stats?.stormsSurvived ?? 0, 1), 1],
        baseBuilder: [stats ? Object.values(stats.built).filter(Boolean).length : 0, 3],
        pathfinder: [Math.min(stats?.depositsCollected ?? 0, 6), 6],
        cycleSurvivor: [stats?.gameOverReason === 'survived' ? 1 : 0, 1],
      };
      BADGES.forEach((badge, index) => {
        if (earnedBadges.includes(badge.id)) return;
        const [count, total] = counts[badge.id];
        nextBadges.children[index].textContent += ` ${count}/${total}`;
      });
      badges.replaceWith(nextBadges);
      badges = nextBadges;
      list.replaceChildren();
      empty.hidden = entries.length > 0;
      for (const entry of [...entries].reverse()) {
        const item = document.createElement('li');
        const timestamp = document.createElement('span');
        timestamp.className = 'logbook-day';
        timestamp.textContent = `Día ${entry.day} · `;
        item.append(timestamp, document.createTextNode(entry.text));
        list.appendChild(item);
      }
    },
  };
}
