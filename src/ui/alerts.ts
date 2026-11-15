// Event banner + alert queue in the HUD: announces storms with lead time,
// shows the real NASA event id for attribution.

import type { ScheduledStorm } from '../donki';

export interface AlertHandle {
  root: HTMLElement;
  /** Poll the schedule and show/update banners accordingly. */
  update: (schedule: ScheduledStorm[], elapsed: number, stormRemaining?: number) => void;
}

export function createAlerts(container: HTMLElement): AlertHandle {
  const root = document.createElement('div');
  root.className = 'hud-alerts';
  container.appendChild(root);

  const update = (schedule: ScheduledStorm[], elapsed: number, stormRemaining?: number): void => {
    root.innerHTML = '';
    for (const storm of schedule) {
      if (!storm.announced || storm.hit) continue;
      const remaining = Math.max(0, storm.startAt - elapsed);
      const urgency = remaining <= storm.leadTimeSeconds * 0.5 ? 'hud-alert urgent' : 'hud-alert';
      const item = document.createElement('div');
      item.className = urgency;
      const headline = document.createElement('strong');
      headline.textContent = `⚠ STORM INCOMING — ${storm.summary} — impact in ${Math.ceil(remaining)}s`;
      const source = document.createElement('small');
      source.textContent = `NASA DONKI · ${storm.sourceId}`;
      item.append(headline, source);
      root.appendChild(item);
    }
    for (const storm of schedule) {
      // Never outlive the simulation; cap stale/oversized schedule banners too.
      if (storm.hit && (stormRemaining === undefined || stormRemaining > 0)
        && elapsed >= storm.startAt
        && elapsed < storm.startAt + Math.min(storm.durationSeconds, 90)) {
        const item = document.createElement('div');
        item.className = 'hud-alert active';
        item.textContent = '🌪️ Storm in progress — power the shield!';
        root.appendChild(item);
      }
    }
  };

  return { root, update };
}
