"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Segment } from "./types";
import { ensureAudio, playFinish, playTick, playTransition } from "./audio";
import type { SoundSettings } from "./storage";

export type Runner = {
  index: number;
  remainingMs: number;
  running: boolean;
  done: boolean;
  current: Segment | null;
  next: Segment | null;
  elapsedTotal: number;
  toggle: () => void;
  reset: () => void;
  jumpTo: (index: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
};

/** Past this far into a segment, going back restarts it instead of stepping. */
export const PREV_RESTART_MS = 1000;

type Snapshot = {
  index: number;
  remainingMs: number;
  running: boolean;
  done: boolean;
};

/**
 * Drives the timeline off requestAnimationFrame timestamps rather than
 * setInterval, so a slow frame or a backgrounded tab catches up instead of
 * silently losing seconds.
 *
 * `segments` is read once at mount — remount (via a key) to swap routines.
 */
export function useRunner(segments: Segment[], sound: SoundSettings): Runner {
  const firstDuration = (segments[0]?.duration ?? 0) * 1000;

  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    index: 0,
    remainingMs: firstDuration,
    running: false,
    done: false,
  }));

  // Engine state lives in refs so the rAF loop can mutate it between renders.
  const indexRef = useRef(0);
  const remainingRef = useRef(firstDuration);
  const runningRef = useRef(false);
  const doneRef = useRef(false);
  const lastTickRef = useRef(-1);

  const segmentsRef = useRef(segments);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const publish = useCallback(() => {
    setSnapshot({
      index: indexRef.current,
      remainingMs: remainingRef.current,
      running: runningRef.current,
      done: doneRef.current,
    });
  }, []);

  const seek = useCallback((index: number) => {
    const list = segmentsRef.current;
    const clamped = Math.min(Math.max(0, index), Math.max(0, list.length - 1));
    indexRef.current = clamped;
    remainingRef.current = (list[clamped]?.duration ?? 0) * 1000;
    lastTickRef.current = -1;
    doneRef.current = false;
  }, []);

  useEffect(() => {
    if (!snapshot.running) return;

    let raf = 0;
    let last = performance.now();

    const loop = (ts: number) => {
      const list = segmentsRef.current;
      const dt = ts - last;
      last = ts;
      // A backgrounded tab returns one huge delta: catch up, but stay silent.
      const audible = dt < 2000;

      remainingRef.current -= dt;

      if (soundRef.current.countdown && audible) {
        const sec = Math.ceil(remainingRef.current / 1000);
        if (sec !== lastTickRef.current && sec >= 1 && sec <= 3) playTick();
        lastTickRef.current = sec;
      }

      while (remainingRef.current <= 0) {
        if (indexRef.current >= list.length - 1) {
          remainingRef.current = 0;
          runningRef.current = false;
          doneRef.current = true;
          if (soundRef.current.transition && audible) playFinish();
          publish();
          return;
        }
        indexRef.current += 1;
        remainingRef.current += list[indexRef.current].duration * 1000;
        lastTickRef.current = -1;
        if (soundRef.current.transition && audible) {
          playTransition(list[indexRef.current].kind);
        }
      }

      publish();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [snapshot.running, publish]);

  const toggle = useCallback(() => {
    if (segmentsRef.current.length === 0) return;
    ensureAudio(); // Browsers only allow this from a user gesture.

    if (doneRef.current) {
      seek(0);
      runningRef.current = true;
    } else {
      runningRef.current = !runningRef.current;
    }
    publish();
  }, [publish, seek]);

  const reset = useCallback(() => {
    runningRef.current = false;
    seek(0);
    publish();
  }, [publish, seek]);

  const jumpTo = useCallback(
    (index: number) => {
      seek(index);
      publish();
    },
    [publish, seek],
  );

  const skipNext = useCallback(() => {
    jumpTo(indexRef.current + 1);
  }, [jumpTo]);

  /** Restarts the current segment unless you're right at its start. */
  const skipPrev = useCallback(() => {
    const current = segmentsRef.current[indexRef.current];
    const elapsed = (current?.duration ?? 0) * 1000 - remainingRef.current;
    jumpTo(
      elapsed > PREV_RESTART_MS ? indexRef.current : indexRef.current - 1,
    );
  }, [jumpTo]);

  // Running total of the time before each segment, for the overall progress.
  const offsets = useMemo(() => {
    const starts: number[] = [];
    let sum = 0;
    for (const segment of segments) {
      starts.push(sum);
      sum += segment.duration;
    }
    return starts;
  }, [segments]);

  const current = segments[snapshot.index] ?? null;
  const totalDuration = segments.reduce((total, s) => total + s.duration, 0);
  const elapsedTotal = snapshot.done
    ? totalDuration
    : (offsets[snapshot.index] ?? 0) +
      (current ? current.duration - snapshot.remainingMs / 1000 : 0);

  return {
    index: snapshot.index,
    remainingMs: snapshot.remainingMs,
    running: snapshot.running,
    done: snapshot.done,
    current,
    next: segments[snapshot.index + 1] ?? null,
    elapsedTotal,
    toggle,
    reset,
    jumpTo,
    skipNext,
    skipPrev,
  };
}
