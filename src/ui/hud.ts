// HUD: renders meters and power sliders from the simulation state.
// Mission Console: compact resource chips and touch-friendly power controls.
// Presentation lives in style.css (#hud children).

import type { GameState, PowerAllocation } from '../sim';
import { MAX_RESOURCE } from '../sim';

export interface HudHandle {
  root: HTMLElement;
  /** Re-render meter values from state (cheap, called every frame). */
  update: (s: GameState) => void;
}

const METERS: Array<{ key: 'shield' | 'oxygen' | 'comms'; icon: string; label: string; color: string; hint: string }> = [
  { key: 'shield', icon: '🛡️', label: 'Shield', color: 'var(--shield)', hint: 'Blocks real solar storms. When the alarm sounds, give it more power.' },
  { key: 'oxygen', icon: '💨', label: 'Oxygen', color: 'var(--oxygen)', hint: 'The crew breathes constantly. If it hits 0, the mission fails.' },
  { key: 'comms', icon: '📡', label: 'Comms', color: 'var(--comms)', hint: 'Contact with Earth. Missions need comms alive to score.' },
];

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function createHud(container: HTMLElement, onAllocate: (alloc: PowerAllocation) => void): HudHandle {
  const root = el('div', 'hud-root');

  // --- mission banner ---
  const mission = el('div', 'hud-mission');
  const missionTag = el('div', 'hud-mission-tag');
  missionTag.textContent = 'MISSION 01';
  const missionGoal = el('div', 'hud-mission-goal');
  missionGoal.textContent = 'Survive the lunar day & night';
  mission.appendChild(missionTag);
  mission.appendChild(missionGoal);
  root.appendChild(mission);

  // --- meters panel ---
  const panel = el('div', 'hud-panel');
  panel.setAttribute('aria-label', 'Life support meters');
  const bars = new Map<string, { row: HTMLElement; fill: HTMLElement; value: HTMLElement }>();

  for (const m of METERS) {
    const row = el('div', 'hud-meter');
    const label = el('div', 'hud-meter-label');
    const icon = el('span', 'hud-meter-icon');
    icon.textContent = m.icon;
    icon.setAttribute('aria-hidden', 'true');
    label.textContent = m.label;
    label.title = m.hint;
    label.setAttribute('aria-label', `${m.label}: ${m.hint}`);
    const track = el('div', 'hud-track');
    const fill = el('div', 'hud-fill');
    fill.style.background = m.color;
    const value = el('div', 'hud-value');
    track.appendChild(fill);
    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(value);
    row.appendChild(track);
    panel.appendChild(row);
    bars.set(m.key, { row, fill, value });
  }

  // battery + clock row
  const info = el('div', 'hud-info');
  const batteryIcon = el('span', 'hud-meter-icon');
  batteryIcon.textContent = '🔋';
  batteryIcon.setAttribute('aria-hidden', 'true');
  const batteryLabel = el('span', 'hud-meter-label');
  batteryLabel.textContent = 'Battery';
  const battery = el('div', 'hud-battery hud-value');
  const clock = el('div', 'hud-clock');
  const batteryTrack = el('div', 'hud-track');
  const batteryFill = el('div', 'hud-fill');
  batteryFill.style.background = 'var(--battery)';
  batteryTrack.appendChild(batteryFill);
  info.append(batteryIcon, batteryLabel, battery, batteryTrack, clock);
  panel.appendChild(info);
  root.appendChild(panel);

  // --- power allocation sliders ---
  const allocPanel = el('div', 'hud-alloc');
  const allocTitle = el('div', 'hud-alloc-title');
  allocTitle.textContent = '⚡ Power';
  allocPanel.setAttribute('aria-label', 'Power allocation — shared battery');
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
    slider.setAttribute('aria-label', `${m.label} power`);
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
      b.row.classList.toggle('crit', v < 20);
    }
    battery.textContent = `${Math.round(s.battery)}`;
    batteryFill.style.width = `${(s.battery / MAX_RESOURCE) * 100}%`;
    info.classList.toggle('crit', s.battery < 20);
    clock.textContent = `${s.isDay ? '☀️ Day' : '🌑 Night'} · ${Math.floor(s.elapsed / 60)}:${String(Math.floor(s.elapsed % 60)).padStart(2, '0')}`;

  };

  return { root, update };
}
