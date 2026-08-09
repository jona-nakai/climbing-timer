"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { setSound, useHydrated, useRoutine, useSound } from "@/lib/store";
import type { SoundSettings } from "@/lib/storage";
import {
  blockDuration,
  expandRoutine,
  formatClock,
  formatDuration,
  routineDuration,
  type Routine,
} from "@/lib/types";
import { PREV_RESTART_MS, useRunner } from "@/lib/useRunner";

export default function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const routine = useRoutine(id);
  const sound = useSound();

  if (!hydrated) return null;

  if (!routine) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <p className="text-zinc-300">That routine no longer exists.</p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm text-emerald-400 transition hover:text-emerald-300"
        >
          ← Back to routines
        </Link>
      </main>
    );
  }

  return (
    <Runner
      key={routine.id}
      routine={routine}
      sound={sound}
      onSoundChange={setSound}
    />
  );
}

function Runner({
  routine,
  sound,
  onSoundChange,
}: {
  routine: Routine;
  sound: SoundSettings;
  onSoundChange: (next: SoundSettings) => void;
}) {
  const segments = useMemo(() => expandRoutine(routine), [routine]);
  const runner = useRunner(segments, sound);
  const total = useMemo(() => routineDuration(routine), [routine]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Where each block starts in the flattened timeline, for sidebar jumps.
  const blockStarts = useMemo(() => {
    const starts = new Map<number, number>();
    segments.forEach((segment, index) => {
      if (!starts.has(segment.blockIndex)) starts.set(segment.blockIndex, index);
    });
    return starts;
  }, [segments]);

  useSpaceKey(runner.toggle, settingsOpen);
  useWakeLock(runner.running);

  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [runner.current?.blockIndex]);

  const current = runner.current;
  const kind = runner.done ? "done" : (current?.kind ?? "rest");
  const seconds = Math.ceil(runner.remainingMs / 1000);

  // Going back restarts the current segment once it's underway, so the button
  // says what it will actually do.
  const intoSegment = current
    ? current.duration * 1000 - runner.remainingMs
    : 0;
  const willRestart = intoSegment > PREV_RESTART_MS;
  const backDisabled = !willRestart && runner.index === 0;

  const accent =
    kind === "work"
      ? "text-emerald-300"
      : kind === "rest"
        ? "text-sky-300"
        : "text-zinc-300";
  const stageBg =
    kind === "work"
      ? "bg-emerald-950/40"
      : kind === "rest"
        ? "bg-sky-950/30"
        : "bg-zinc-900/40";

  return (
    <div className="flex min-h-screen flex-col-reverse md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-t border-zinc-900 md:h-screen md:w-80 md:border-r md:border-t-0">
        <div className="border-b border-zinc-900 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              ← Routines
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="-mr-1 rounded-lg px-2 py-1 text-zinc-600 transition hover:text-zinc-200"
            >
              <GearIcon />
            </button>
          </div>

          <h1 className="mt-1 truncate font-medium">{routine.name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500 tabular">
            <span className="text-zinc-300">
              {formatClock(runner.elapsedTotal)}
            </span>{" "}
            / {formatClock(total)}
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto p-2.5">
          {routine.blocks.map((block, index) => {
            const start = blockStarts.get(index);
            const isCurrent = current?.blockIndex === index;
            const isPast =
              runner.done || (current ? current.blockIndex > index : false);

            return (
              <li key={block.id} ref={isCurrent ? activeRef : null}>
                <button
                  type="button"
                  disabled={start === undefined}
                  onClick={() => start !== undefined && runner.jumpTo(start)}
                  className={`mb-2 w-full rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-40 ${
                    isCurrent
                      ? block.type === "exercise"
                        ? "border-emerald-500 bg-emerald-950/50"
                        : "border-sky-500 bg-sky-950/40"
                      : `border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 ${
                          isPast ? "opacity-45" : ""
                        }`
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        block.type === "exercise" ? "bg-emerald-400" : "bg-sky-400"
                      }`}
                    />
                    <span className="truncate text-sm font-medium">
                      {block.name ||
                        (block.type === "exercise" ? "Set" : "Break")}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-zinc-500 tabular">
                      {formatDuration(blockDuration(block))}
                    </span>
                  </span>
                  {block.type === "exercise" && (
                    <span className="mt-0.5 block pl-3.5 text-xs text-zinc-500 tabular">
                      {`${block.reps} × ${block.workSec}s` +
                        (block.reps > 1 && block.restSec > 0
                          ? ` · ${block.restSec}s break`
                          : "")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main
        className={`flex flex-1 flex-col items-center justify-center px-6 py-16 transition-colors duration-500 ${stageBg}`}
      >
        {segments.length === 0 ? (
          <p className="text-zinc-400">This routine has no timed blocks yet.</p>
        ) : (
          <>
            {/* No stage label — the colour already says hang vs rest. */}
            <h2 className="max-w-full truncate text-2xl font-medium sm:text-3xl">
              {runner.done ? "Complete" : current?.label}
            </h2>
            <p className="mt-1 h-5 text-sm text-zinc-500 tabular">
              {runner.done ? routine.name : current?.detail}
            </p>

            <div
              className={`mt-6 text-[5.5rem] font-semibold leading-none tabular sm:text-[9rem] ${accent}`}
            >
              {formatClock(seconds)}
            </div>

            {/* Equal-weight side columns keep the play button dead centre, so
                the hint below it stays aligned as the labels change. */}
            <div className="mt-12 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <button
                type="button"
                onClick={runner.skipPrev}
                disabled={backDisabled}
                className="justify-self-end rounded-lg px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-100 disabled:opacity-25 disabled:hover:text-zinc-500"
              >
                {willRestart ? "Reset" : "Back"}
              </button>

              <button
                type="button"
                onClick={runner.toggle}
                className={`flex min-w-44 flex-col items-center gap-0.5 rounded-full px-7 py-3 font-medium transition duration-300 ${
                  kind === "work"
                    ? "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/20 hover:shadow-[0_0_28px_-16px_rgba(52,211,153,0.5)]"
                    : kind === "rest"
                      ? "bg-sky-400/15 text-sky-200 hover:bg-sky-400/20 hover:shadow-[0_0_28px_-16px_rgba(56,189,248,0.5)]"
                      : "bg-zinc-100/10 text-zinc-100 hover:bg-zinc-100/15 hover:shadow-[0_0_28px_-16px_rgba(244,244,245,0.35)]"
                }`}
              >
                <span>
                  {runner.done ? "Restart" : runner.running ? "Pause" : "Start"}
                </span>
                <span className="text-xs font-normal opacity-45">space bar</span>
              </button>

              <button
                type="button"
                onClick={runner.skipNext}
                className="justify-self-start rounded-lg px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-100"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </main>

      {settingsOpen && (
        <SettingsDialog
          sound={sound}
          onSoundChange={onSoundChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function SettingsDialog({
  sound,
  onSoundChange,
  onClose,
}: {
  sound: SoundSettings;
  onSoundChange: (next: SoundSettings) => void;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg px-2 py-1 text-zinc-500 transition hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Sound
        </p>
        <div className="mt-2 divide-y divide-zinc-900">
          <Toggle
            label="Transition beep"
            hint="Tone when a block hands off to the next"
            on={sound.transition}
            onChange={(on) => onSoundChange({ ...sound, transition: on })}
          />
          <Toggle
            label="3·2·1 countdown"
            hint="Ticks on the last three seconds"
            on={sound.countdown}
            onChange={(on) => onSoundChange({ ...sound, countdown: on })}
          />
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Turn both off for a silent session.
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-4 py-3.5 text-left"
    >
      <span className="flex-1">
        <span className="block text-sm">{label}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${
          on ? "bg-emerald-500" : "bg-zinc-800"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
            on ? "left-5" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Space plays and pauses; nothing else is bound. */
function useSpaceKey(toggle: () => void, suspended: boolean) {
  const ref = useRef({ toggle, suspended });
  useEffect(() => {
    ref.current = { toggle, suspended };
  }, [toggle, suspended]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || ref.current.suspended) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault(); // Stops page scroll and re-triggering a focused button.
      ref.current.toggle();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Keeps the phone screen on mid-set; silently no-ops where unsupported. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        if (released) void lock.release();
        else sentinel = lock;
      })
      .catch(() => {});

    return () => {
      released = true;
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
