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
  dialog.addEventListener('close', () => onToggle(false));
  const list = document.createElement('ol');
  list.className = 'logbook-entries';
  const empty = document.createElement('p');
  empty.textContent = 'Escanea y recolecta depósitos para nombrar tu primer descubrimiento.';
  let badges = renderBadgeChips([]);
  dialog.append(title, badges, empty, list, close);
  container.appendChild(dialog);
  return {
    toggle() {
      if (dialog.open) dialog.close();
      else {
        dialog.showModal();
        onToggle(true);
        close.focus();
      }
    },
    update(entries: readonly LogEntry[], earnedBadges: readonly BadgeId[] = []) {
      const nextBadges = renderBadgeChips(earnedBadges);
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
