// Overlay helpers: pure text/logic for tutorial + game over screens.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim';
import { gameOverTitle, gameOverDetail, missionSummary } from './overlays';

describe('gameOverTitle', () => {
  it('names oxygen loss as the failure', () => {
    expect(gameOverTitle('oxygen')).toBe('Oxygen ran out!');
  });

  it('names shield loss as the failure', () => {
    expect(gameOverTitle('shield')).toBe('Shield destroyed!');
  });

  it('celebrates survival', () => {
    expect(gameOverTitle('survived')).toBe('Mission accomplished! 🌕');
  });

  it('falls back to generic mission end for unknown reasons', () => {
    expect(gameOverTitle('unknown')).toBe('Mission ended');
  });
});

describe('gameOverDetail', () => {
  it('explains why the crew ran out of oxygen', () => {
    expect(gameOverDetail('oxygen')).toContain('oxygen');
  });

  it('explains a destroyed shield', () => {
    expect(gameOverDetail('shield')).toContain('shield');
  });

  it('points to the science page after surviving', () => {
    expect(gameOverDetail('survived')).toContain('Science');
  });
});

describe('missionSummary', () => {
  it('reports storms survived and days elapsed', () => {
    const s = { ...createInitialState(600), stormsSurvived: 3, elapsed: 245 };
    const text = missionSummary(s);
    expect(text).toContain('3');
    expect(text).toContain('storm');
    expect(text).toMatch(/day/i);
  });

  it('uses singular for one storm', () => {
    const s = { ...createInitialState(600), stormsSurvived: 1, elapsed: 10 };
    expect(missionSummary(s)).toContain('1 storm survived');
  });
});
