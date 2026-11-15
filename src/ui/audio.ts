// Tiny Web Audio sound engine: no assets, all synthesized. Kid-friendly blips.
// The AudioContext starts locked (browsers require a user gesture); unlock()
// must be called from a click/touch handler. Every method is a no-op until
// then, so the game works fine even if the player never interacts first.

export interface AudioHandle {
  /** Call from a real user gesture (click/touch) to create the context. */
  unlock: () => void;
  /** Rising-danger alarm when a storm impact is announced. */
  stormAlarm: () => void;
  /** Short pop when a resource deposit is collected. */
  harvest: () => void;
  /** Descending sting on mission failure. */
  defeat: () => void;
  /** Small victory arpeggio. */
  victory: () => void;
}

type Ctor = typeof AudioContext;

function buildSound(ctx: AudioContext, notes: Array<[freq: number, at: number, dur: number, type: OscillatorType, vol: number]>, master: GainNode): void {
  for (const [freq, at, dur, type, vol] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
    gain.gain.setValueAtTime(0, ctx.currentTime + at);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.05);
  }
}

export function createAudio(): AudioHandle {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;

  const unlock = (): void => {
    if (ctx) return;
    const AC: Ctor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22; // gentle volume for kids' ears
    master.connect(ctx.destination);
  };

  const play = (
    notes: Array<[number, number, number, OscillatorType, number]>,
  ): void => {
    if (!ctx || !master) return;
    if (ctx.state === 'suspended') void ctx.resume();
    buildSound(ctx, notes, master);
  };

  return {
    unlock,
    stormAlarm: () =>
      play([
        [740, 0, 0.16, 'square', 0.5],
        [560, 0.2, 0.16, 'square', 0.5],
        [740, 0.44, 0.16, 'square', 0.5],
        [560, 0.64, 0.22, 'square', 0.5],
      ]),
    harvest: () =>
      play([
        [880, 0, 0.08, 'sine', 0.6],
        [1320, 0.07, 0.12, 'sine', 0.5],
      ]),
    defeat: () =>
      play([
        [330, 0, 0.3, 'sawtooth', 0.4],
        [247, 0.3, 0.35, 'sawtooth', 0.4],
        [165, 0.65, 0.6, 'sawtooth', 0.45],
      ]),
    victory: () =>
      play([
        [523, 0, 0.14, 'triangle', 0.5],
        [659, 0.14, 0.14, 'triangle', 0.5],
        [784, 0.28, 0.14, 'triangle', 0.5],
        [1047, 0.42, 0.35, 'triangle', 0.55],
      ]),
  };
}
