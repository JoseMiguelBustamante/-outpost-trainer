// HUD: renders mission banner, meter chips and battery/clock from the sim state.
// Power allocation is fixed (33/33/33, log L16): no sliders by product decision.
// Presentation lives in style.css (#hud children).

import type { GameState } from '../sim';
import { MAX_RESOURCE, batteryCapacity } from '../sim';

export interface HudHandle {
  root: HTMLElement;
  /** Re-render meter values from state (cheap, called every frame). */
  update: (s: GameState) => void;
}

const METERS: Array<{ key: 'shield' | 'oxygen' | 'comms'; icon: string; label: string; color: string; hint: string; powerHint: string }> = [
  { key: 'shield', icon: '🛡️', label: 'Escudo', color: 'var(--shield)', hint: 'Frena tormentas solares reales. Las reparaciones necesitan energía y materiales recolectados.', powerHint: 'frena el daño de las tormentas' },
  { key: 'oxygen', icon: '💨', label: 'Oxígeno', color: 'var(--oxygen)', hint: 'La tripulación respira todo el tiempo. Reciclar oxígeno requiere energía y materiales. Si llega a 0, la misión termina.', powerHint: 'mantiene con vida a la tripulación' },
  { key: 'comms', icon: '📡', label: 'Comunicaciones', color: 'var(--comms)', hint: 'Contacto con la Tierra. Las reparaciones necesitan energía y materiales recolectados.', powerHint: 'contacto con la Tierra' },
];

const CHIPS = [
  ...METERS.map((meter) => ({ ...meter, critical: 20 })),
  { key: 'materials' as const, icon: '🧪', label: 'Materiales', color: 'var(--battery)',
    hint: 'Recolecta depósitos para reparar o construir en las zonas cian: Banco de Baterías 20, Reciclador 25, Pilar de Escudo 20. Repara el rover por 10 para duplicar el alcance de escaneo.', critical: 15 },
];

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function createHud(container: HTMLElement): HudHandle {
  const root = el('div', 'hud-root');

  // --- mission banner ---
  const mission = el('div', 'hud-mission');
  const missionTag = el('div', 'hud-mission-tag');
  missionTag.textContent = 'MISIÓN 01';
  const missionGoal = el('div', 'hud-mission-goal');
  missionGoal.textContent = 'Sobrevive el día y la noche lunar';
  mission.appendChild(missionTag);
  mission.appendChild(missionGoal);
  root.appendChild(mission);

  // --- meters panel ---
  const panel = el('div', 'hud-panel');
  panel.setAttribute('aria-label', 'Indicadores de soporte vital');
  const bars = new Map<string, { row: HTMLElement; fill: HTMLElement; value: HTMLElement }>();

  for (const m of CHIPS) {
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

  const modules = el('div', 'hud-modules');
  modules.setAttribute('aria-label', 'Módulos construidos');
  panel.appendChild(modules);

  // battery + clock row
  const info = el('div', 'hud-info');
  const batteryIcon = el('span', 'hud-meter-icon');
  batteryIcon.textContent = '🔋';
  batteryIcon.setAttribute('aria-hidden', 'true');
  const batteryLabel = el('span', 'hud-meter-label');
  batteryLabel.textContent = 'Batería';
  const battery = el('div', 'hud-battery hud-value');
  const clock = el('div', 'hud-clock');
  const batteryTrack = el('div', 'hud-track');
  const batteryFill = el('div', 'hud-fill');
  batteryFill.style.background = 'var(--battery)';
  batteryTrack.appendChild(batteryFill);
  info.append(batteryIcon, batteryLabel, battery, batteryTrack, clock);
  panel.appendChild(info);
  root.appendChild(panel);

  // HUD must be interactive even though the container ignores pointer events.
  panel.style.pointerEvents = 'auto';
  container.appendChild(root);

  const update = (s: GameState): void => {
    for (const m of CHIPS) {
      const b = bars.get(m.key)!;
      const v = s[m.key];
      b.fill.style.width = `${(v / MAX_RESOURCE) * 100}%`;
      b.value.textContent = `${Math.round(v)}`;
      b.row.classList.toggle('crit', v < m.critical);
    }
    battery.textContent = `${Math.round(s.battery)}`;
    batteryFill.style.width = `${(s.battery / batteryCapacity(s)) * 100}%`;
    battery.title = `Capacidad de la batería: ${batteryCapacity(s)}`;
    const builtNames = [s.built.batteryBank && '🔋 Banco de Baterías', s.built.recycler && '♻ Reciclador', s.built.pylon && '🛡 Pilar de Escudo'].filter(Boolean);
    modules.textContent = builtNames.length ? `🏗 ${builtNames.join(' · ')}` : '';
    modules.hidden = builtNames.length === 0;
    info.classList.toggle('crit', s.battery < 20);
    clock.textContent = `${s.isDay ? '☀️ Día' : '🌑 Noche'} · ${Math.floor(s.elapsed / 60)}:${String(Math.floor(s.elapsed % 60)).padStart(2, '0')}`;

  };

  return { root, update };
}
