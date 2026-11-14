// Event banner + alert queue in the HUD: announces storms with lead time,
// shows the real NASA event id for attribution.

import type { ScheduledStorm } from '../donki';

export interface AlertHandle {
  root: HTMLElement;
  /** Poll the schedule and show/update banners accordingly. */
  update: (schedule: ScheduledStorm[], elapsed: number) => void;
}

export function createAlerts(container: HTMLElement): AlertHandle {
  const root = document.createElement('div');
  root.className = 'hud-alerts';
  container.appendChild(root);

  const update = (schedule: ScheduledStorm[], elapsed: number): void => {
    root.innerHTML = '';
    for (const storm of schedule) {
      if (!storm.announced || storm.hit) continue;
      const remaining = Math.max(0, storm.startAt - elapsed);
      const urgency = remaining <= storm.leadTimeSeconds * 0.5 ? 'hud-alert urgent' : 'hud-alert';
      const item = document.createElement('div');
      item.className = urgency;
      item.textContent = `⚠️ INCOMING: ${storm.summary} — impact in ${Math.ceil(remaining)}s (NASA event ${storm.sourceId})`;
      root.appendChild(item);
    }
    for (const storm of schedule) {
      if (storm.hit && elapsed <= storm.startAt + storm.durationSeconds) {
        const item = document.createElement('div');
        item.className = 'hud-alert active';
        item.textContent = `🌪️ ${storm.summary} in progress — power the shield!`;
        root.appendChild(item);
      }
    }
  };

  return { root, update };
}
