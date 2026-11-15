import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, type PowerAllocation } from '../sim';
import { adjustAllocation, createHud } from './hud';

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
      .toEqual({ shield: 15, oxygen: 42.5, comms: 42.5 });
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
          expect(result[changedKey]).toBe(input[changedKey]);
          expect(result.shield + result.oxygen + result.comms).toBeCloseTo(100, 12);
          for (const key of keys) {
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

function mountHud() {
  vi.stubGlobal('document', { createElement: () => new TestElement() });
  const container = new TestElement();
  const onAllocate = vi.fn<(allocation: PowerAllocation) => void>();
  createHud(container as unknown as HTMLElement, onAllocate);
  const root = container.children[0];
  const panel = root.children.find((child) => child.className === 'hud-alloc')!;
  const rows = panel.children.filter((child) => child.className === 'hud-alloc-row');
  const sliders = rows.map((row) => row.children[1]);
  const labels = rows.map((row) => row.children[2]);
  return { onAllocate, sliders, labels, title: panel.children[0] };
}

afterEach(() => vi.unstubAllGlobals());

describe('HUD power controls', () => {
  it('starts with the simulation allocation and retains accessible slider labels', () => {
    const { onAllocate, sliders, labels, title } = mountHud();
    const initial = createInitialState().allocation;
    expect(sliders.map((slider) => Number(slider.value))).toEqual(keys.map((key) => initial[key]));
    expect(labels.map((label) => label.textContent)).toEqual(keys.map((key) => `${initial[key]}%`));
    expect(sliders.map((slider) => slider.attributes.get('aria-label')))
      .toEqual(['Shield power', 'Oxygen power', 'Comms power']);
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
