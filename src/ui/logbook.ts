// Science notes are plain data; DOM rendering uses textContent for DONKI data.
export interface LogEntry {
  day: number;
  text: string;
}

const COLORS = ['Cyan', 'Rusty', 'Amber'];
const LANDMARKS = ['Knoll', 'Spire', 'Hollow'];

export function discoveryName(depositIndex: number): string {
  const color = COLORS[depositIndex % COLORS.length];
  const landmark = LANDMARKS[(depositIndex + Math.floor(depositIndex / COLORS.length)) % LANDMARKS.length];
  const suffix = depositIndex >= 9 ? ` ${Math.floor(depositIndex / 9) + 1}` : '';
  return `${color} ${landmark}${suffix}`;
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
  title.textContent = '📖 Science logbook';
  const close = document.createElement('button');
  close.className = 'overlay-cta';
  close.textContent = 'Close logbook';
  close.addEventListener('click', () => dialog.close());
  // Native dialog provides focus trapping, Escape dismissal and focus restoration.
  dialog.addEventListener('close', () => onToggle(false));
  const list = document.createElement('ol');
  list.className = 'logbook-entries';
  const empty = document.createElement('p');
  empty.textContent = 'Scan and collect deposits to name your first discovery.';
  dialog.append(title, empty, list, close);
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
    update(entries: readonly LogEntry[]) {
      list.replaceChildren();
      empty.hidden = entries.length > 0;
      for (const entry of [...entries].reverse()) {
        const item = document.createElement('li');
        const timestamp = document.createElement('span');
        timestamp.className = 'logbook-day';
        timestamp.textContent = `Day ${entry.day} · `;
        item.append(timestamp, document.createTextNode(entry.text));
        list.appendChild(item);
      }
    },
  };
}
