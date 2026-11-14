// HUD: renders meters and power sliders from the simulation state.
// Kid-friendly: big bars, emoji icons, plain language. Minimal styling lives
// in style.css (#hud children).

import type { GameState, PowerAllocation } from '../sim';
import { MAX_RESOURCE } from '../sim';

export interface HudHandle {
  root: HTMLElement;
  /** Re-render meter values from state (cheap, called every frame). */
  update: (s: GameState) => void;
}

const METERS: Array<{ key: 'shield' | 'oxygen' | 'comms'; icon: string; label: string; color: string }> = [
  { key: 'shield', icon: '🛡️', label: 'Shield', color: '#4f9df7' },
  { key: 'oxygen', icon: '💨', label: 'Oxygen', color: '#43d17c' },
  { key: 'comms', icon: '📡', label: 'Comms', color: '#f7b84f' },
];

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function createHud(container: HTMLElement, onAllocate: (alloc: PowerAllocation) => void): HudHandle {
  const root = el('div', 'hud-root');

  // --- meters panel ---
  const panel = el('div', 'hud-panel');
  const bars = new Map<string, { fill: HTMLElement; value: HTMLElement }>();

  for (const m of METERS) {
    const row = el('div', 'hud-meter');
    const label = el('div', 'hud-meter-label');
    label.textContent = `${m.icon} ${m.label}`;
    const track = el('div', 'hud-track');
    const fill = el('div', 'hud-fill');
    fill.style.background = m.color;
    const value = el('div', 'hud-value');
    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    panel.appendChild(row);
    bars.set(m.key, { fill, value });
  }

  // battery + clock row
  const info = el('div', 'hud-info');
  const battery = el('div', 'hud-battery');
  const clock = el('div', 'hud-clock');
  info.appendChild(battery);
  info.appendChild(clock);
  panel.appendChild(info);
  root.appendChild(panel);

  // --- power allocation sliders ---
  const allocPanel = el('div', 'hud-alloc');
  const allocTitle = el('div', 'hud-alloc-title');
  allocTitle.textContent = '⚡ Power (must add up!)';
  allocPanel.appendChild(allocTitle);

  const sliders = new Map<string, HTMLInputElement>();
  const values = new Map<string, HTMLElement>();

  const emit = (): void => {
    onAllocate({
      shield: Number(sliders.get('shield')!.value),
      oxygen: Number(sliders.get('oxygen')!.value),
      comms: Number(sliders.get('comms')!.value),
    });
  };

  for (const m of METERS) {
    const row = el('div', 'hud-alloc-row');
    const label = el('span', 'hud-alloc-label');
    label.textContent = m.icon;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.value = '33';
    slider.dataset.key = m.key;
    const val = el('span', 'hud-alloc-value');
    val.textContent = `${slider.value}%`;

    slider.addEventListener('input', () => {
      val.textContent = `${slider.value}%`;
      emit();
    });

    sliders.set(m.key, slider);
    values.set(m.key, val);
    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(val);
    allocPanel.appendChild(row);
  }
  root.appendChild(allocPanel);

  // HUD must be interactive even though the container ignores pointer events.
  panel.style.pointerEvents = 'auto';
  allocPanel.style.pointerEvents = 'auto';
  container.appendChild(root);

  const update = (s: GameState): void => {
    for (const m of METERS) {
      const b = bars.get(m.key)!;
      const v = s[m.key];
      b.fill.style.width = `${(v / MAX_RESOURCE) * 100}%`;
      b.value.textContent = `${Math.round(v)}`;
    }
    battery.textContent = `🔋 ${Math.round(s.battery)}`;
    clock.textContent = `${s.isDay ? '☀️ Day' : '🌑 Night'} · ${Math.floor(s.elapsed / 60)}:${String(Math.floor(s.elapsed % 60)).padStart(2, '0')}`;

    // danger flash
    for (const m of METERS) {
      const b = bars.get(m.key)!;
      b.fill.style.opacity = s[m.key] < 20 ? '0.5' : '1';
    }
  };

  return { root, update };
}
