import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../sim';
import { createHud } from './hud';
import * as THREE from 'three';
import { buildOutpost } from '../scene/outpost';
import { createPlayerAstronaut } from '../scene/astronaut';
import { createAlerts } from './alerts';
import { scheduleStorms } from '../donki/storms';

// Only the element operations used by the HUD, so these integration tests run
// in plain Node without jsdom or a browser dependency.
class TestElement {
  children: TestElement[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, () => void>();
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  classList = { toggle: vi.fn() };
  className = '';
  textContent = '';
  title = '';
  type = '';
  min = '';
  max = '';
  step = '';
  value = '';

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  appendChild(child: TestElement): void { this.children.push(child); }
  append(...children: TestElement[]): void { this.children.push(...children); }
  addEventListener(name: string, listener: () => void): void { this.listeners.set(name, listener); }
}

describe('playtest regressions', () => {
  it('exports solid structure footprints without blocking the pad', () => {
    const outpost = buildOutpost();
    expect(outpost.colliders).toHaveLength(8);
    for (const name of ['habitat-dome', 'greenhouse-dome', 'habitat-module', 'rover', 'antenna', 'solar-array']) {
      const position = outpost.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
      expect(outpost.colliders.some((c) => Math.hypot(position.x - c.x, position.z - c.z) <= c.r)).toBe(true);
    }
    expect(outpost.colliders.every((c) => Math.hypot(c.x, 4.8 - c.z) > c.r)).toBe(true);
  });

  it('slides the player outside overlapping structures while grounding to terrain', () => {
    const direction = new THREE.Vector2(1, 0.5);
    const colliders = [{ x: 0, z: 0, r: 1 }, { x: 0.5, z: 0, r: 1 }];
    const player = createPlayerAstronaut(new THREE.Scene(), {
      terrainHeight: () => 2, center: new THREE.Vector3(), movement: () => direction, colliders,
    });
    player.setPosition(-1.4, 0.4);
    const before = player.getPosition();
    player.update(0.1);
    const after = player.getPosition();
    expect(after.z).toBeGreaterThan(before.z);
    expect(after.y).toBe(2);
    for (const c of colliders) expect(Math.hypot(after.x - c.x, after.z - c.z)).toBeGreaterThanOrEqual(c.r + 0.3 - 1e-6);
    player.setPosition(0, 0);
    expect(Number.isFinite(player.getPosition().x)).toBe(true);
  });

  it('clears completed storms and caps long banners while preserving incoming alerts', () => {
    vi.stubGlobal('document', { createElement: () => new TestElement() });
    const storm = { ...scheduleStorms([], 600, 1)[0], startAt: 120, durationSeconds: 300, announced: true, hit: true };
    const render = (elapsed: number, remaining: number, hit = true) => {
      const container = new TestElement();
      const alerts = createAlerts(container as unknown as HTMLElement);
      alerts.update([{ ...storm, hit }], elapsed, remaining);
      return container.children[0].children;
    };
    expect(render(130, 10).map((item) => item.textContent)).toEqual(['🌪️ ¡Tormenta en curso — da energía al escudo!']);
    expect(render(131, 0)).toHaveLength(0);
    expect(render(211, 209)).toHaveLength(0);
    expect(render(110, 0, false)[0].children[0].textContent).toContain('impacto en 10s');
  });
});

function mountHud() {
  vi.stubGlobal('document', { createElement: () => new TestElement() });
  const container = new TestElement();
  const hud = createHud(container as unknown as HTMLElement);
  const root = container.children[0];
  return { hud, root };
}

afterEach(() => vi.unstubAllGlobals());

describe('HUD materials chip', () => {
  it('renders an accessible materials value and bar with a strict below-15 warning', () => {
    const { hud, root } = mountHud();
    const panel = root.children.find((child) => child.className === 'hud-panel')!;
    const row = panel.children.find((child) => child.className === 'hud-chip-row')!;
    const chip = row.children.find((chip) => chip.children[1]?.textContent === 'Materiales');
    expect(chip).toBeDefined();
    expect(chip!.children[0].textContent).toBe('🧪');
    expect(chip!.children[0].attributes.get('aria-hidden')).toBe('true');
    expect(chip!.children[1].attributes.get('aria-label')).toContain('Materiales:');
    for (const value of [40, 15, 14, 0, 100]) {
      hud.update({ ...createInitialState(), materials: value });
      expect(chip!.children[2].textContent).toBe(String(value));
      expect(Number.parseFloat(chip!.children[3].children[0].style.width)).toBeCloseTo(value);
      expect(chip!.classList.toggle).toHaveBeenLastCalledWith('crit', value < 15);
    }
  });

  it('renders no power allocation panel (fixed 33/33/33, log L16)', () => {
    const { root } = mountHud();
    expect(root.children.some((child) => child.className === 'hud-alloc')).toBe(false);
  });
});
