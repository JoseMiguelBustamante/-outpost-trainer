import { describe, expect, it } from 'vitest';
import { mapCmeToStorm, mapGstToStorm, type DonkiCme, type DonkiGst } from './donki';

describe('mapCmeToStorm', () => {
  it('returns null for a CME without analysis data', () => {
    const cme: DonkiCme = { activityID: 'X', startTime: '2026-11-01T00:00Z', cmeAnalyses: [] };
    expect(mapCmeToStorm(cme)).toBeNull();
  });

  it('slow CME (<500 km/s) maps to a weak long storm', () => {
    const cme: DonkiCme = {
      activityID: 'slow',
      startTime: '2026-11-01T00:00Z',
      cmeAnalyses: [{ isMostAccurate: true, speed: 336, halfAngle: 41 }],
    };
    const storm = mapCmeToStorm(cme)!;
    expect(storm.damagePerSecond).toBeGreaterThan(0);
    expect(storm.damagePerSecond).toBeLessThan(1.5);
    expect(storm.durationSeconds).toBeGreaterThan(20);
  });

  it('fast CME (>1500 km/s) maps to a strong short storm', () => {
    const cme: DonkiCme = {
      activityID: 'fast',
      startTime: '2026-11-01T00:00Z',
      cmeAnalyses: [{ isMostAccurate: true, speed: 2000, halfAngle: 60 }],
    };
    const storm = mapCmeToStorm(cme)!;
    expect(storm.damagePerSecond).toBeGreaterThan(2.5);
    expect(storm.durationSeconds).toBeLessThan(15);
  });

  it('prefers the most accurate analysis entry', () => {
    const cme: DonkiCme = {
      activityID: 'multi',
      startTime: '2026-11-01T00:00Z',
      cmeAnalyses: [
        { isMostAccurate: false, speed: 900, halfAngle: 30 },
        { isMostAccurate: true, speed: 1600, halfAngle: 50 },
      ],
    };
    const storm = mapCmeToStorm(cme)!;
    expect(storm.damagePerSecond).toBeGreaterThan(2.5);
  });

  it('includes the real event id for attribution', () => {
    const cme: DonkiCme = {
      activityID: '2026-10-25T03:12:00-CME-001',
      startTime: '2026-10-25T03:12Z',
      cmeAnalyses: [{ isMostAccurate: true, speed: 800, halfAngle: 30 }],
    };
    expect(mapCmeToStorm(cme)!.sourceId).toBe('2026-10-25T03:12:00-CME-001');
  });
});

describe('mapGstToStorm', () => {
  it('returns null for a weak storm (Kp < 5)', () => {
    const gst: DonkiGst = {
      gstID: 'g1',
      startTime: '2024-05-10T15:00Z',
      allKpIndex: [{ kpIndex: 4.0, observedTime: '2024-05-10T18:00Z' }],
    };
    expect(mapGstToStorm(gst)).toBeNull();
  });

  it('scales damage with peak Kp (Gannon storm Kp 9 = strong)', () => {
    const gst: DonkiGst = {
      gstID: 'g2',
      startTime: '2024-05-10T15:00Z',
      allKpIndex: [
        { kpIndex: 7.67, observedTime: 't1' },
        { kpIndex: 9.0, observedTime: 't2' },
        { kpIndex: 8.33, observedTime: 't3' },
      ],
    };
    const storm = mapGstToStorm(gst)!;
    expect(storm.damagePerSecond).toBeGreaterThan(2);
    expect(storm.peakKp).toBeCloseTo(9.0, 5);
  });

  it('moderate Kp 5-6 storm is mild', () => {
    const gst: DonkiGst = {
      gstID: 'g3',
      startTime: '2024-05-10T15:00Z',
      allKpIndex: [{ kpIndex: 5.33, observedTime: 't1' }],
    };
    const storm = mapGstToStorm(gst)!;
    expect(storm.damagePerSecond).toBeLessThan(1.5);
  });
});
