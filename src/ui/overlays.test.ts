// Overlay helpers: pure text/logic for tutorial + game over screens.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim';
import { gameOverTitle, gameOverDetail, missionSummary } from './overlays';

describe('gameOverTitle', () => {
  it('names oxygen loss as the failure', () => {
    expect(gameOverTitle('oxygen')).toBe('¡Se acabó el oxígeno!');
  });

  it('names shield loss as the failure', () => {
    expect(gameOverTitle('shield')).toBe('¡Escudo destruido!');
  });

  it('celebrates survival', () => {
    expect(gameOverTitle('survived')).toBe('¡Misión cumplida! 🌕');
  });

  it('falls back to generic mission end for unknown reasons', () => {
    expect(gameOverTitle('unknown')).toBe('Misión terminada');
  });
});

describe('gameOverDetail', () => {
  it('explains why the crew ran out of oxygen', () => {
    expect(gameOverDetail('oxygen')).toContain('oxígeno');
  });

  it('explains a destroyed shield', () => {
    expect(gameOverDetail('shield')).toContain('escudo');
  });

  it('points to the science page after surviving', () => {
    expect(gameOverDetail('survived')).toContain('ciencia');
  });
});

describe('missionSummary', () => {
  it('reports storms survived and days elapsed', () => {
    const s = { ...createInitialState(600), stormsSurvived: 3, elapsed: 245 };
    const text = missionSummary(s);
    expect(text).toContain('3');
    expect(text).toContain('Tormentas');
    expect(text).toMatch(/día/i);
  });

  it('uses singular for one storm', () => {
    const s = { ...createInitialState(600), stormsSurvived: 1, elapsed: 10 };
    expect(missionSummary(s)).toContain('Tormentas sobrevividas: 1');
  });
});
