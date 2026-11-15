import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, type PowerAllocation } from '../sim';
import { adjustAllocation, createHud } from './hud';
import * as THREE from 'three';
import { buildOutpost } from '../scene/outpost';
import { createPlayerAstronaut } from '../scene/astronaut';
import { createAlerts } from './alerts';
import { scheduleStorms } from '../donki/storms';

const keys = ['shield', 'oxygen', 'comms'] as const;

describe('adjustAllocation', () => {
  it('keeps the changed shield value and scales the other systems proportionally', () => {
    expect(adjustAllocation({ shield: 60, oxygen: 30, comms: 10 }, 'shield'))
      .toEqual({ shield: 60, oxygen: 30, comms: 10 });
    expect(adjustAllocation({ shield: 40, oxygen: 30, comms: 10 }, 'shield'))
      .toEqual({ shield: 40, oxygen: 45, comms: 15 });
  });

  it('splits proportionally when oxygen changes and both other values are nonzero', () => {
    expect(adjustAllocation({ shield: 20, oxygen: 25, comms: 40 }, 'oxygen'))
      .toEqual({ shield: 25, oxygen: 25, comms: 50 });
  });

  it('preserves a zero share when only one other system has power', () => {
    expect(adjustAllocation({ shield: 0, oxygen: 20, comms: 40 }, 'comms'))
      .toEqual({ shield: 0, oxygen: 60, comms: 40 });
  });

  it('splits the remainder evenly when both other values are zero', () => {
    expect(adjustAllocation({ shield: 15, oxygen: 0, comms: 0 }, 'shield'))
      .toEqual({ shield: 15, oxygen: 43, comms: 42 });
    expect(adjustAllocation({ shield: 0, oxygen: 0, comms: 0 }, 'comms'))
      .toEqual({ shield: 50, oxygen: 50, comms: 0 });
  });

  it.each([100, 125])('clamps a changed value of %s to the whole budget', (shield) => {
    expect(adjustAllocation({ shield, oxygen: 30, comms: 20 }, 'shield'))
      .toEqual({ shield: 100, oxygen: 0, comms: 0 });
  });

  it('handles the lower bound without hidden scaling of the changed value', () => {
    expect(adjustAllocation({ shield: 10, oxygen: 0, comms: 30 }, 'oxygen'))
      .toEqual({ shield: 25, oxygen: 0, comms: 75 });
    expect(adjustAllocation({ shield: 10, oxygen: -5, comms: 30 }, 'oxygen'))
      .toEqual({ shield: 25, oxygen: 0, comms: 75 });
  });

  it.each(keys)('keeps bounded allocations totaling 100 when %s changes', (changedKey) => {
    for (const shield of [0, 5, 33.4, 65, 100]) {
      for (const oxygen of [0, 15, 33.3, 70, 100]) {
        for (const comms of [0, 25, 33.3, 85, 100]) {
          const input = { shield, oxygen, comms };
          const result = adjustAllocation(input, changedKey);
          expect(result[changedKey]).toBe(Math.round(input[changedKey]));
          expect(result.shield + result.oxygen + result.comms).toBe(100);
          for (const key of keys) {
            expect(Number.isInteger(result[key])).toBe(true);
            expect(result[key]).toBeGreaterThanOrEqual(0);
            expect(result[key]).toBeLessThanOrEqual(100);
          }
          expect(input).toEqual({ shield, oxygen, comms });
        }
      }
    }
  });

  it.each(keys)('leaves already balanced values untouched when %s changes', (changedKey) => {
    const input = Object.freeze({ shield: 20, oxygen: 35, comms: 45 });
    expect(adjustAllocation(input, changedKey)).toEqual(input);
  });
});

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
  it('rounds fractional balanced allocations and preserves exact totals', () => {
    const input = Object.freeze({ shield: 60.52083333333333, oxygen: 25.25, comms: 14.22916666666667 });
    expect(adjustAllocation(input, 'shield')).toEqual({ shield: 61, oxygen: 25, comms: 14 });
  });

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
    expect(render(130, 10).map((item) => item.textContent)).toEqual(['🌪️ Storm in progress — power the shield!']);
    expect(render(131, 0)).toHaveLength(0);
    expect(render(211, 209)).toHaveLength(0);
    expect(render(110, 0, false)[0].children[0].textContent).toContain('impact in 10s');
  });
});

function mountHud() {
  vi.stubGlobal('document', { createElement: () => new TestElement() });
  const container = new TestElement();
  const onAllocate = vi.fn<(allocation: PowerAllocation) => void>();
  const hud = createHud(container as unknown as HTMLElement, onAllocate);
  const root = container.children[0];
  const panel = root.children.find((child) => child.className === 'hud-alloc')!;
  const rows = panel.children.filter((child) => child.className === 'hud-alloc-row');
  const sliders = rows.map((row) => row.children[1]);
  const labels = rows.map((row) => row.children[2]);
  return { hud, root, onAllocate, sliders, labels, title: panel.children[0] };
}

afterEach(() => vi.unstubAllGlobals());

describe('HUD materials chip', () => {
  it('renders an accessible materials value and bar with a strict below-15 warning', () => {
    const { hud, root, sliders } = mountHud();
    const panel = root.children.find((child) => child.className === 'hud-panel')!;
    const chip = panel.children.find((row) => row.children[1]?.textContent === 'Materials');
    expect(chip).toBeDefined();
    expect(chip!.children[0].textContent).toBe('🧪');
    expect(chip!.children[0].attributes.get('aria-hidden')).toBe('true');
    expect(chip!.children[1].attributes.get('aria-label')).toContain('Materials:');
    for (const value of [40, 15, 14, 0, 100]) {
      hud.update({ ...createInitialState(), materials: value });
      expect(chip!.children[2].textContent).toBe(String(value));
      expect(Number.parseFloat(chip!.children[3].children[0].style.width)).toBeCloseTo(value);
      expect(chip!.classList.toggle).toHaveBeenLastCalledWith('crit', value < 15);
    }
    expect(sliders).toHaveLength(3);
  });
});

describe('HUD power controls', () => {
  it('starts with the simulation allocation and retains accessible slider labels', () => {
    const { onAllocate, sliders, labels, title } = mountHud();
    const initial = createInitialState().allocation;
    expect(sliders.map((slider) => Number(slider.value))).toEqual(keys.map((key) => initial[key]));
    expect(labels.map((label) => label.textContent)).toEqual(keys.map((key) => `${Math.round(initial[key])}%`));
    expect(sliders.map((slider) => slider.attributes.get('aria-label')))
      .toEqual([
        'Shield power — stops storm damage',
        'Oxygen power — keeps the crew alive',
        'Comms power — contact with Earth',
      ]);
    for (const slider of sliders) {
      expect([slider.type, slider.min, slider.max, slider.step]).toEqual(['range', '0', '100', 'any']);
    }
    expect(title.textContent).toBe('⚡ Power (auto-balances to 100%)');
    expect(onAllocate).not.toHaveBeenCalled();
  });

  it.each(keys)('updates all positions and labels and emits effective power on %s input', (changedKey) => {
    const { onAllocate, sliders, labels } = mountHud();
    sliders.forEach((slider, index) => { slider.value = String([20, 30, 50][index]); });
    const changed = sliders[keys.indexOf(changedKey)];
    changed.value = '15';
    const raw = Object.fromEntries(keys.map((key, index) => [key, Number(sliders[index].value)])) as unknown as PowerAllocation;
    const expected = adjustAllocation(raw, changedKey);
    changed.listeners.get('input')!();
    expect(onAllocate).toHaveBeenCalledExactlyOnceWith(expected);
    expect(sliders.map((slider) => Number(slider.value))).toEqual(keys.map((key) => expected[key]));
    expect(labels.map((label) => label.textContent)).toEqual(keys.map((key) => `${expected[key]}%`));
    expect(labels.reduce((sum, label) => sum + Number.parseFloat(label.textContent), 0)).toBeCloseTo(100, 12);

    // A second input must use the newly visible allocation, not stale raw values.
    const nextKey = keys[(keys.indexOf(changedKey) + 1) % keys.length];
    sliders[keys.indexOf(nextKey)].value = '100';
    sliders[keys.indexOf(nextKey)].listeners.get('input')!();
    const allPower = { shield: 0, oxygen: 0, comms: 0, [nextKey]: 100 };
    expect(onAllocate).toHaveBeenLastCalledWith(allPower);
    expect(sliders.map((slider) => Number(slider.value))).toEqual(keys.map((key) => allPower[key]));
    expect(labels.map((label) => label.textContent)).toEqual(keys.map((key) => `${allPower[key]}%`));
  });
});
