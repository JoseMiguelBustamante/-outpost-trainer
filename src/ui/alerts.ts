// Event banner + alert queue in the HUD: announces storms with lead time,
// shows the real NASA event id for attribution.

import type { ScheduledStorm } from '../donki';

export interface AlertHandle {
  root: HTMLElement;
  /** Poll the schedule and show/update banners accordingly. */
  update: (schedule: ScheduledStorm[], elapsed: number, stormRemaining?: number) => boolean;
}

export function createAlerts(container: HTMLElement): AlertHandle {
  const root = document.createElement('div');
  root.className = 'hud-alerts';
  container.appendChild(root);

  let lastKey = '';
  const update = (schedule: ScheduledStorm[], elapsed: number, stormRemaining?: number): boolean => {
    // Active storms outrank incoming ones; otherwise show the earliest impact.
    const active = schedule.find((storm) => storm.hit
      && (stormRemaining === undefined || stormRemaining > 0)
      && elapsed >= storm.startAt
      && elapsed < storm.startAt + Math.min(storm.durationSeconds, 90));
    const incoming = schedule.filter((storm) => storm.announced && !storm.hit)
      .sort((a, b) => a.startAt - b.startAt)[0];
    const selected = active ?? incoming;
    const key = selected ? `${active ? 'active' : 'incoming'}:${selected.sourceId}:${Math.ceil(Math.max(0, selected.startAt - elapsed))}` : '';
    if (key === lastKey) return Boolean(selected);
    lastKey = key;
    root.innerHTML = '';
    for (const storm of schedule) {
      if (active || storm !== incoming) continue;
      const remaining = Math.max(0, storm.startAt - elapsed);
      const urgency = remaining <= storm.leadTimeSeconds * 0.5 ? 'hud-alert urgent' : 'hud-alert';
      const item = document.createElement('div');
      item.className = urgency;
      const headline = document.createElement('strong');
      headline.textContent = `⚠ TORMENTA EN CAMINO — ${storm.summary.replace('Geomagnetic storm', 'Tormenta geomagnética')} — impacto en ${Math.ceil(remaining)}s`;
      const source = document.createElement('small');
      source.textContent = `NASA DONKI · evento real · ${storm.sourceId}`;
      item.append(headline, source);
      root.appendChild(item);
    }
    for (const storm of schedule) {
      // Never outlive the simulation; cap stale/oversized schedule banners too.
      if (storm === active) {
        const item = document.createElement('div');
        item.className = 'hud-alert active';
        item.textContent = '🌪️ ¡Tormenta en curso — da energía al escudo!';
        root.appendChild(item);
      }
    }
    return Boolean(selected);
  };

  return { root, update };
}
