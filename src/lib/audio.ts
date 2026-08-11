import type { SegmentKind } from "./types";

let ctx: AudioContext | null = null;

/** Must be called from a user gesture the first time, or the context stays suspended. */
export function ensureAudio(): void {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, durationMs: number, gain: number, delayMs = 0): void {
  if (!ctx) return;
  const start = ctx.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  // Short attack/release so the tone doesn't click.
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.01);
  amp.gain.setValueAtTime(gain, end - 0.03);
  amp.gain.linearRampToValueAtTime(0, end);

  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Tick on each of the last three seconds. */
export function playTick(): void {
  tone(880, 70, 0.18);
}

/** Fires as a new segment begins — pitch tells you which kind. */
export function playTransition(kind: SegmentKind): void {
  if (kind === "work") tone(1047, 200, 0.25);
  else if (kind === "rest") tone(659, 200, 0.22);
  // A block break is the longer pause: drop another third so it's obvious.
  else tone(523, 220, 0.22);
}

export function playFinish(): void {
  tone(659, 160, 0.22, 0);
  tone(784, 160, 0.22, 170);
  tone(1047, 320, 0.25, 340);
}
