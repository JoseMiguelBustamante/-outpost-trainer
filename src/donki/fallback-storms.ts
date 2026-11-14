// Embedded real DONKI events as offline fallback (brief-allowed: "a curated
// real dataset embedded directly into your tool is a reasonable and honest
// alternative"). Captured live from api.nasa.gov on 2026-11-14.
// - CME 2026-10-25T03:12:00-CME-001: speed 336 km/s, halfAngle 41 (SWPC_CAT)
// - GST 2024-05-10T15:00:00-GST-001: Gannon storm, peak Kp 9.0 (NOAA)

import type { StormSpec } from './donki';

export const FALLBACK_STORMS: StormSpec[] = [
  {
    damagePerSecond: 0.5,
    durationSeconds: 25,
    sourceId: '2026-10-25T03:12:00-CME-001',
    summary: 'CME 336 km/s',
    peakKp: null,
    leadTimeSeconds: 12,
  },
  {
    damagePerSecond: 3.2,
    durationSeconds: 10,
    sourceId: '2024-05-10T15:00:00-GST-001',
    summary: 'Geomagnetic storm Kp 9.0',
    peakKp: 9.0,
    leadTimeSeconds: 0,
  },
  {
    damagePerSecond: 1.4,
    durationSeconds: 18,
    sourceId: '2024-05-11T00:00:00-GST-001',
    summary: 'Geomagnetic storm Kp 7.7',
    peakKp: 7.67,
    leadTimeSeconds: 0,
  },
];
