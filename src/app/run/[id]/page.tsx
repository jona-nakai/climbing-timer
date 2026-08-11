"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { HomeIcon } from "@/components/HomeIcon";
import { setSound, useHydrated, useRoutine, useSound } from "@/lib/store";
import type { SoundSettings } from "@/lib/storage";
import {
  blockDuration,
  expandRoutine,
  formatClock,
  formatDuration,
  routineDuration,
  type Routine,
  type SegmentKind,
} from "@/lib/types";
import { PREV_RESTART_MS, useRunner } from "@/lib/useRunner";

/** How far below the top of the sidebar the running block sits. */
const TOP_INSET = 12;

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
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-400 transition hover:text-emerald-300"
        >
          <HomeIcon />
          Home
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

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useSpaceKey(runner.toggle, settingsOpen);
  useWakeLock(runner.running);

  const listRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const blockIndex = runner.current?.blockIndex;
  // Bumped to re-run the positioning when the block itself hasn't changed.
  const [recentre, setRecentre] = useState(0);

  // Position the active block inside the sidebar's own scroller. scrollIntoView
  // would walk up and scroll the page too, dragging the timer off screen.
  useEffect(() => {
    const list = listRef.current;
    const inner = padRef.current;
    const item = activeRef.current;
    if (!list || !inner || !item) return;

    // The active block parks near the top, so everything below it is what's
    // still to come — the natural reading order for a routine. Centring put
    // half the panel to work showing blocks already done.
    //
    // Padding goes on the inner list, never on the scroller itself: with
    // border-box sizing, padding on a content-sized scroller feeds back into
    // the clientHeight this reads, and each pass adds more than the last.
    const view = list.clientHeight;
    const last = inner.lastElementChild as HTMLElement | null;
    // Enough tail room for the final block to reach the top too, plus slack.
    const tail = view - (last?.offsetHeight ?? 0) - TOP_INSET + view * 0.15;
    inner.style.paddingBottom = `${Math.max(0, tail)}px`;

    // Read after writing the padding, so offsetTop accounts for it.
    list.scrollTo({ top: item.offsetTop - TOP_INSET, behavior: "smooth" });
  }, [blockIndex, sidebarOpen, recentre]);

  const current = runner.current;
  const kind = runner.done ? "done" : (current?.kind ?? "rest");
  const seconds = Math.ceil(runner.remainingMs / 1000);

  const stage = !runner.done && current && current.kind !== "work" ? "Break" : "";
  // On a break block the title is the set ahead, flagged as such; everywhere
  // else it's the set you're already in.
  const lookahead = !runner.done && current?.kind === "break";
  const title = runner.done
    ? "Complete"
    : lookahead
      ? (runner.next?.label ?? "Finish")
      : (current?.label ?? "");
  // Rep counter — on sets and on the breaks inside them, never on a break
  // block, which isn't part of any set.
  const counter =
    !runner.done && current && current.kind !== "break" ? current.detail : "";
  // How far into the current countdown, for the active cell of the rep bar.
  const progress = current?.duration
    ? Math.min(1, Math.max(0, 1 - runner.remainingMs / (current.duration * 1000)))
    : 0;

  // Going back restarts the current segment once it's underway, so the button
  // says what it will actually do.
  const intoSegment = current
    ? current.duration * 1000 - runner.remainingMs
    : 0;
  const willRestart = intoSegment > PREV_RESTART_MS;
  const backDisabled = !willRestart && runner.index === 0;

  const accent = accentFor(kind);
  const stageBg =
    kind === "work"
      ? "bg-emerald-950/40"
      : kind === "rest"
        ? "bg-sky-950/30"
        : kind === "break"
          ? "bg-purple-950/30"
          : "bg-zinc-900/40";

  const elapsedLabel = (
    <>
      <span className="text-zinc-300">{formatClock(runner.elapsedTotal)}</span> /{" "}
      {formatClock(total)}
    </>
  );

  return (
    // Fixed to the viewport: the page itself never scrolls, so nothing the
    // sidebar does can push the clock out of view.
    <div className="flex h-[100dvh] flex-col-reverse overflow-hidden md:flex-row">
      {!sidebarOpen ? (
        <aside className="flex shrink-0 items-center gap-3 border-t border-zinc-900 px-4 py-2 md:h-full md:w-14 md:flex-col md:gap-4 md:border-r md:border-t-0 md:px-0 md:py-3.5">
          {/* A house, not an arrow: an arrow here reads as "expand". */}
          <Link
            href="/"
            aria-label="Back to routines"
            title="Back to routines"
            className="text-zinc-600 transition hover:text-zinc-200"
          >
            <HomeIcon />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Show routine"
            aria-expanded={false}
            title="Show routine"
            className="text-zinc-600 transition hover:text-zinc-200"
          >
            <PanelIcon open={false} />
          </button>
          <span className="ml-auto text-xs text-zinc-500 tabular md:hidden">
            {elapsedLabel}
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="text-zinc-600 transition hover:text-zinc-200 md:mt-auto"
          >
            <GearIcon />
          </button>
        </aside>
      ) : (
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-zinc-900 md:h-full md:w-80 md:border-r md:border-t-0">
          <div className="border-b border-zinc-900 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              {/* Same house as the collapsed rail — one way home, one icon. */}
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-200"
              >
                <HomeIcon />
                Home
              </Link>
              <div className="-mr-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Hide routine"
                  aria-expanded
                  title="Hide routine"
                  className="rounded-lg px-2 py-1 text-zinc-600 transition hover:text-zinc-200"
                >
                  <PanelIcon open />
                </button>
              </div>
            </div>

            <h1 className="mt-1 truncate font-medium">{routine.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500 tabular">{elapsedLabel}</p>
          </div>

          {/* The scroller keeps a height of its own so measuring it can't be
              affected by what the centring effect writes inside. */}
          <div
            ref={listRef}
            // Mandatory, not proximity: a short break block sits inside the
            // proximity threshold of its neighbours, so it was the one thing
            // that never caught.
            className="sidebar-fade relative h-[38dvh] snap-y snap-mandatory overflow-y-auto md:h-auto md:min-h-0 md:flex-1"
          >
            {/* Vertical padding here is owned by the centring effect. */}
            <ul ref={padRef} className="px-2.5 pt-2.5">
              {routine.blocks.map((block, index) => {
                const start = blockStarts.get(index);
                const isCurrent = current?.blockIndex === index;
                const isPast =
                  runner.done || (current ? current.blockIndex > index : false);

                return (
                  <li
                    key={block.id}
                    ref={isCurrent ? activeRef : null}
                    // Snapping to the same inset the effect scrolls to, so a
                    // hand-scroll lands exactly where the timer parks it. The
                    // gap between cards is padding *inside* the item: as a
                    // margin on the card it collapsed out of the snap area,
                    // leaving dead bands that short blocks fell into.
                    className="snap-start scroll-mt-3 pb-2"
                  >
                    <button
                      type="button"
                      disabled={start === undefined}
                      onClick={() => {
                        // Clicking the block you're already on just brings it
                        // back to the top — it doesn't restart the countdown.
                        if (isCurrent) setRecentre((n) => n + 1);
                        else if (start !== undefined) runner.jumpTo(start);
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-40 ${
                        isCurrent
                          ? block.type === "exercise"
                            ? "border-emerald-500 bg-emerald-950/50"
                            : "border-purple-500 bg-purple-950/40"
                          : `border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 ${
                              isPast ? "opacity-45" : ""
                            }`
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            block.type === "exercise"
                              ? "bg-emerald-400"
                              : "bg-purple-400"
                          }`}
                        />
                        <span className="truncate text-sm font-medium">
                          {block.type === "exercise" ? block.name || "Set" : "Break"}
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
          </div>

          {/* Settings lives at the foot of the panel, the same place it sits
              on the collapsed rail. */}
          <div className="border-t border-zinc-900 px-3 py-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-zinc-600 transition hover:text-zinc-200"
            >
              <GearIcon />
              Settings
            </button>
          </div>
        </aside>
      )}

      <main
        className={`flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 transition-colors duration-500 sm:py-16 ${stageBg}`}
      >
        {segments.length === 0 ? (
          <p className="text-zinc-400">This routine has no timed blocks yet.</p>
        ) : (
          <>
            {/* Only breaks get a word — on a set the colour says it. Both
                halves ride the same centred line, so nothing hangs off to one
                side of the title: purple for the state you're in, grey for the
                bit that qualifies the name below. */}
            <p className="flex h-4 items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.25em]">
              <span className={`opacity-60 ${accent}`}>{stage}</span>
              {lookahead && <span className="text-zinc-600">· Up next</span>}
            </p>
            <h2 className="mt-1.5 max-w-full truncate text-2xl font-medium sm:text-3xl">
              {title}
            </h2>

            <div
              className={`mt-4 text-[5rem] font-semibold leading-none tabular sm:mt-5 sm:text-[9rem] ${accent}`}
            >
              {formatClock(seconds)}
            </div>

            {/* Same slot on a set and on its breaks, so the rep you're on (or
                about to start) never moves. */}
            <div className="mt-5 flex h-10 w-full max-w-sm flex-col items-center gap-2">
              {current && current.reps > 1 && !runner.done && (
                <>
                  <div className={`flex w-full items-center gap-1.5 ${accent}`}>
                    {Array.from({ length: current.reps }, (_, i) => (
                      <span
                        key={i}
                        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100/10"
                      >
                        {i === current.rep - 1 && current.kind === "rest" ? (
                          // Up next: pulses instead of filling, so the break's
                          // own countdown can't read as rep progress.
                          <span className="animate-rep-pulse absolute inset-0 rounded-full bg-current" />
                        ) : (
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-current"
                            style={{
                              width:
                                i < current.rep - 1
                                  ? "100%"
                                  : i === current.rep - 1
                                    ? `${progress * 100}%`
                                    : "0%",
                            }}
                          />
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm tabular text-zinc-500">{counter}</p>
                </>
              )}

            </div>

            {/* Equal-weight side columns keep the play button dead centre as
                the labels beside it change width. */}
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mt-5">
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
                className={`min-w-44 rounded-full px-7 py-3.5 font-medium transition duration-300 ${
                  kind === "work"
                    ? "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/20 hover:shadow-[0_0_28px_-16px_rgba(52,211,153,0.5)]"
                    : kind === "rest"
                      ? "bg-sky-400/15 text-sky-200 hover:bg-sky-400/20 hover:shadow-[0_0_28px_-16px_rgba(56,189,248,0.5)]"
                      : kind === "break"
                        ? "bg-purple-400/15 text-purple-200 hover:bg-purple-400/20 hover:shadow-[0_0_28px_-16px_rgba(192,132,252,0.5)]"
                        : "bg-zinc-100/10 text-zinc-100 hover:bg-zinc-100/15 hover:shadow-[0_0_28px_-16px_rgba(244,244,245,0.35)]"
                }`}
              >
                {runner.done ? "Restart" : runner.running ? "Pause" : "Start"}
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

/** Stage colours, shared by the clock and by the title when it looks ahead. */
function accentFor(kind: SegmentKind | "done" | undefined): string {
  return kind === "work"
    ? "text-emerald-300"
    : kind === "rest"
      ? "text-sky-300"
      : kind === "break"
        ? "text-purple-300"
        : "text-zinc-300";
}

/**
 * The same panel glyph in both states — one icon that toggles reads as a
 * toggle, where a hamburger next to a back arrow reads as two ways out.
 */
function PanelIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
      {/* The panel half is filled in when it's showing. */}
      {open && (
        <rect
          x="4.2"
          y="5.2"
          width="3.6"
          height="13.6"
          rx="1"
          fill="currentColor"
          stroke="none"
          opacity="0.45"
        />
      )}
    </svg>
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
