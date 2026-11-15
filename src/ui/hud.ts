// Compact mission console. Power allocation stays fixed at 33/33/33.
import type { GameState } from '../sim';
import { MAX_RESOURCE, batteryCapacity } from '../sim';

export interface HudHandle {
  root: HTMLElement;
  warningStrip: HTMLElement;
  update: (s: GameState, stormWarning?: boolean) => void;
  setProgress: (current: number, total: number) => void;
}

const CHIPS = [
  { key: 'oxygen', icon: '💨', label: 'O₂', color: 'var(--oxygen)', critical: 20,
    hint: 'Oxígeno: la tripulación respira todo el tiempo. Reciclar requiere energía y materiales. Si llega a 0, la misión termina.' },
  { key: 'battery', icon: '🔋', label: 'Batería', color: 'var(--battery)', critical: 20,
    hint: 'Alimenta todos los sistemas. Los paneles solares la recargan durante el día.' },
  { key: 'shield', icon: '🛡️', label: 'Escudo', color: 'var(--shield)', critical: 20,
    hint: 'Frena tormentas solares reales. Las reparaciones necesitan energía y materiales recolectados.' },
  { key: 'comms', icon: '📡', label: 'Señal', color: 'var(--comms)', critical: 20,
    hint: 'Contacto con la Tierra. Las reparaciones necesitan energía y materiales recolectados.' },
  { key: 'materials', icon: '🧪', label: 'Materiales', color: 'var(--battery)', critical: 15,
    hint: 'Recolecta depósitos para reparar o construir en las zonas cian: Banco de Baterías 20, Reciclador 25, Pilar de Escudo 20. Repara el rover por 10 para duplicar el alcance de escaneo.' },
] as const;

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function createHud(container: HTMLElement): HudHandle {
  const root = el('div', 'hud-root');
  const mission = el('div', 'hud-mission');
  const missionTag = el('div', 'hud-mission-tag');
  missionTag.textContent = 'MISIÓN 01';
  const missionGoal = el('div', 'hud-mission-goal');
  missionGoal.textContent = 'Sobrevive el día y la noche lunar';
  const progress = el('span', 'hud-progress');
  progress.textContent = '0/3';
  progress.setAttribute('aria-label', 'Progreso de la etapa: 0/3');
  mission.append(missionTag, missionGoal, progress);
  root.appendChild(mission);

  const panel = el('div', 'hud-panel');
  panel.setAttribute('aria-label', 'Indicadores de soporte vital');
  const chips = el('div', 'hud-chip-row');
  const bars = new Map<string, { row: HTMLElement; fill: HTMLElement; value: HTMLElement }>();
  for (const m of CHIPS) {
    const row = el('div', 'hud-meter');
    const icon = el('span', 'hud-meter-icon');
    icon.textContent = m.icon;
    icon.setAttribute('aria-hidden', 'true');
    const label = el('div', 'hud-meter-label');
    label.textContent = m.label;
    label.title = m.hint;
    label.setAttribute('aria-label', `${m.label}: ${m.hint}`);
    const value = el('div', 'hud-value');
    const track = el('div', 'hud-track');
    const fill = el('div', 'hud-fill');
    fill.style.background = m.color;
    track.appendChild(fill);
    row.append(icon, label, value, track);
    chips.appendChild(row);
    bars.set(m.key, { row, fill, value });
  }
  const warningStrip = el('div', 'hud-warning-strip');
  warningStrip.setAttribute('aria-live', 'polite');
  warningStrip.hidden = true;
  const warning = el('div', 'hud-alert hud-resource-warning');
  warningStrip.appendChild(warning);
  const modules = el('div', 'hud-modules');
  modules.setAttribute('aria-label', 'Módulos construidos');
  const clock = el('div', 'hud-clock');
  panel.append(chips, warningStrip, modules, clock);
  root.appendChild(panel);
  chips.style.pointerEvents = 'auto';
  container.appendChild(root);

  return {
    root,
    warningStrip,
    setProgress(current, total) {
      progress.textContent = `${current}/${total}`;
      progress.setAttribute('aria-label', `Progreso de la etapa: ${current}/${total}`);
    },
    update(s, stormWarning = false) {
      for (const m of CHIPS) {
        const b = bars.get(m.key)!;
        const v = s[m.key];
        b.fill.style.width = `${(v / (m.key === 'battery' ? batteryCapacity(s) : MAX_RESOURCE)) * 100}%`;
        b.value.textContent = `${Math.round(v)}`;
        b.row.classList.toggle('crit', v < m.critical);
      }
      bars.get('battery')!.value.title = `Capacidad de la batería: ${batteryCapacity(s)}`;
      const text = s.battery < 15 ? '⚠ Revisa el sistema de energía'
        : s.materials < 8 ? '⚠ Sin materiales: recolecta depósitos' : '';
      if (warning.textContent !== text) warning.textContent = text;
      warning.hidden = stormWarning || !text;
      warningStrip.hidden = !stormWarning && !text;
      const builtNames = [s.built.batteryBank && '🔋 Banco de Baterías', s.built.recycler && '♻ Reciclador', s.built.pylon && '🛡 Pilar de Escudo'].filter(Boolean);
      modules.textContent = builtNames.length ? `🏗 ${builtNames.join(' · ')}` : '';
      modules.hidden = builtNames.length === 0;
      clock.textContent = `${s.isDay ? '☀️ Día' : '🌑 Noche'} · ${Math.floor(s.elapsed / 60)}:${String(Math.floor(s.elapsed % 60)).padStart(2, '0')}`;
    },
  };
}
