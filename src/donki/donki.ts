// DONKI (NASA Space Weather Database) client + event-to-gameplay mapper.
// Fetches real CME/GST events, caches them, and converts them into storm
// parameters for the simulation (startStorm in src/sim).

import type { SimEvent } from '../sim';

export interface StormSpec {
  /** Shield damage per second while the storm is active. */
  damagePerSecond: number;
  durationSeconds: number;
  /** Real DONKI activity id, shown in the event feed for attribution. */
  sourceId: string;
  /** Human-readable classification, e.g. "CME 1600 km/s" or "G5 storm (Kp 9)". */
  summary: string;
  /** Peak Kp for GST storms, null for CME. */
  peakKp: number | null;
  /** Seconds of mission time between event start and when it hits the outpost. */
  leadTimeSeconds: number;
}

// ---- DONKI payload types (subset we consume) ----

export interface DonkiCmeAnalysis {
  isMostAccurate?: boolean;
  speed?: number;
  halfAngle?: number;
}

export interface DonkiCme {
  activityID: string;
  startTime: string;
  cmeAnalyses?: DonkiCmeAnalysis[];
  note?: string;
}

export interface DonkiKpEntry {
  kpIndex: number;
  observedTime: string;
}

export interface DonkiGst {
  gstID: string;
  startTime: string;
  allKpIndex?: DonkiKpEntry[];
}

export interface DonkiOptions {
  /** NASA api key (DEMO_KEY by default; users register their own). */
  apiKey?: string;
  /** Fetch window start (YYYY-MM-DD), defaults to 30 days ago. */
  startDate?: string;
  endDate?: string;
  /** Abort signal passthrough. */
  signal?: AbortSignal;
}

const DONKI_BASE = 'https://api.nasa.gov/DONKI';

// ---- mapping: real data -> gameplay ----

// Design targets: weak storms ~0.5 dmg/s for ~25s, extreme ~3.5 dmg/s for ~8s.
const DAMAGE_MIN = 0.35;
const DAMAGE_MAX = 3.5;
const CME_SPEED_MIN = 400;
const CME_SPEED_MAX = 2000;
const DURATION_MAX = 28;
const DURATION_MIN = 8;
/** 1 real day of CME travel time compresses to this many game seconds. */
const LEAD_TIME_SCALE = 12;

function lerpDamage(t: number): number {
  return DAMAGE_MIN + (DAMAGE_MAX - DAMAGE_MIN) * t;
}

function lerpDuration(t: number): number {
  return DURATION_MAX + (DURATION_MIN - DURATION_MAX) * t;
}

/** Map a DONKI CME to a storm; null when the CME lacks usable analysis. */
export function mapCmeToStorm(cme: DonkiCme): StormSpec | null {
  const analyses = cme.cmeAnalyses ?? [];
  const best = analyses.find((a) => a.isMostAccurate) ?? analyses[0];
  const speed = best?.speed;
  if (!speed || speed <= 0) return null;

  const t = Math.min(1, Math.max(0, (speed - CME_SPEED_MIN) / (CME_SPEED_MAX - CME_SPEED_MIN)));
  return {
    damagePerSecond: lerpDamage(t),
    durationSeconds: lerpDuration(t),
    sourceId: cme.activityID,
    summary: `CME ${Math.round(speed)} km/s`,
    peakKp: null,
    leadTimeSeconds: LEAD_TIME_SCALE,
  };
}

/** Map a DONKI geomagnetic storm to a storm; null when Kp < 5 (no gameplay effect). */
export function mapGstToStorm(gst: DonkiGst): StormSpec | null {
  const kps = (gst.allKpIndex ?? []).map((k) => k.kpIndex).filter((k) => k > 0);
  if (kps.length === 0) return null;
  const peak = Math.max(...kps);
  if (peak < 5) return null;

  const t = Math.min(1, (peak - 5) / 4); // Kp 5..9 -> 0..1
  return {
    damagePerSecond: lerpDamage(t),
    durationSeconds: lerpDuration(t),
    sourceId: gst.gstID,
    summary: `Geomagnetic storm Kp ${peak.toFixed(1)}`,
    peakKp: peak,
    leadTimeSeconds: 0, // already hitting
  };
}

// ---- fetching ----

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fetch recent CME and GST events from DONKI. Throws on network/HTTP errors. */
export async function fetchDonkiEvents(opts: DonkiOptions = {}): Promise<{ cmes: DonkiCme[]; gsts: DonkiGst[] }> {
  const key = opts.apiKey ?? 'DEMO_KEY';
  const end = opts.endDate ?? isoDate(new Date());
  const start = opts.startDate ?? isoDate(new Date(Date.now() - 30 * 24 * 3600 * 1000));
  const range = `startDate=${start}&endDate=${end}&api_key=${key}`;

  const [cmeRes, gstRes] = await Promise.all([
    fetch(`${DONKI_BASE}/CME?${range}`, { signal: opts.signal }),
    fetch(`${DONKI_BASE}/GST?${range}`, { signal: opts.signal }),
  ]);
  if (!cmeRes.ok || !gstRes.ok) {
    throw new Error(`DONKI request failed: CME ${cmeRes.status}, GST ${gstRes.status}`);
  }
  const cmes = (await cmeRes.json()) as unknown;
  const gsts = (await gstRes.json()) as unknown;
  // The gateway can answer 200 with an error object (e.g. DEMO_KEY rate limit).
  if (!Array.isArray(cmes) || !Array.isArray(gsts)) {
    throw new Error('DONKI returned a non-list payload (rate limit or gateway error)');
  }
  return { cmes: cmes as DonkiCme[], gsts: gsts as DonkiGst[] };
}

/** Convert fetched DONKI payloads into playable storm specs (deduped, strongest first). */
export function stormsFromEvents(cmes: DonkiCme[], gsts: DonkiGst[]): StormSpec[] {
  const storms: StormSpec[] = [];
  for (const cme of cmes) {
    const s = mapCmeToStorm(cme);
    if (s) storms.push(s);
  }
  for (const gst of gsts) {
    const s = mapGstToStorm(gst);
    if (s) storms.push(s);
  }
  storms.sort((a, b) => b.damagePerSecond - a.damagePerSecond);
  const seen = new Set<string>();
  return storms.filter((s) => (seen.has(s.sourceId) ? false : (seen.add(s.sourceId), true)));
}

export type { SimEvent };
