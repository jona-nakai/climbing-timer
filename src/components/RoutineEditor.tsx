"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HomeIcon } from "./HomeIcon";
import { NumberField } from "./NumberField";
import { saveRoutine } from "@/lib/store";
import { useDragList } from "@/lib/useDragList";
import {
  blockDuration,
  emptyExercise,
  emptyRest,
  formatDuration,
  newId,
  routineDuration,
  type Block,
  type Routine,
} from "@/lib/types";

export function RoutineEditor({ initial }: { initial: Routine | null }) {
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine>(
    () =>
      initial ?? {
        id: newId(),
        name: "",
        blocks: [emptyExercise()],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
  );

  function patchBlock(id: string, patch: Partial<Block>) {
    setRoutine((r) => ({
      ...r,
      blocks: r.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
    }));
  }

  function removeBlock(id: string) {
    setRoutine((r) => ({ ...r, blocks: r.blocks.filter((b) => b.id !== id) }));
  }

  function moveBlock(index: number, delta: number) {
    moveTo(index, index + delta);
  }

  function moveTo(from: number, to: number) {
    setRoutine((r) => {
      if (to < 0 || to >= r.blocks.length || from === to) return r;
      const blocks = [...r.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...r, blocks };
    });
  }

  const drag = useDragList(routine.blocks, moveTo);

  function addBlock(block: Block) {
    setRoutine((r) => ({ ...r, blocks: [...r.blocks, block] }));
  }

  function save() {
    saveRoutine({
      ...routine,
      name: routine.name.trim() || "Untitled routine",
      updatedAt: Date.now(),
    });
    router.push("/");
  }

  const total = routineDuration(routine);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-200"
      >
        <HomeIcon />
        Home
      </Link>

      <input
        value={routine.name}
        onChange={(e) => setRoutine((r) => ({ ...r, name: e.target.value }))}
        placeholder="Routine name"
        // Only on a brand-new routine, where the name is the first thing you
        // need. Editing an existing one shouldn't grab the cursor.
        autoFocus={initial === null}
        className="mt-5 w-full border-b border-zinc-800 bg-transparent pb-2 text-2xl font-semibold tracking-tight outline-none transition placeholder:text-zinc-700 focus:border-emerald-600"
      />

      <p className="mt-3 text-sm text-zinc-500">
        {routine.blocks.length} {routine.blocks.length === 1 ? "block" : "blocks"} ·{" "}
        {formatDuration(total)} total
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {routine.blocks.map((block, index) => (
          <li
            key={block.id}
            {...drag.rowProps(block.id)}
            className={`rounded-xl border p-4 transition ${
              drag.dragId === block.id ? "opacity-40" : ""
            } ${
              block.type === "exercise"
                ? "border-emerald-900/60 bg-emerald-950/20"
                : "border-purple-900/60 bg-purple-950/20"
            }`}
          >
            {/* The header strip is the drag handle. */}
            <div
              {...drag.handleProps(block.id)}
              title="Drag to reorder"
              className="flex cursor-grab select-none items-center gap-2 active:cursor-grabbing"
            >
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  block.type === "exercise"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-purple-500/15 text-purple-300"
                }`}
              >
                {block.type === "exercise" ? "Set" : "Break"}
              </span>
              <span className="text-xs text-zinc-500 tabular">
                {formatDuration(blockDuration(block))}
              </span>
              <div
                {...drag.stopArming}
                className="ml-auto flex cursor-default items-center gap-1 text-zinc-500"
              >
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                  className="rounded px-2 py-1 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === routine.blocks.length - 1}
                  className="rounded px-2 py-1 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove block"
                  onClick={() => removeBlock(block.id)}
                  className="rounded px-2 py-1 transition hover:bg-red-950 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>

            {block.type === "exercise" ? (
              <>
                {/* Labelled like the number fields below it, so the card reads
                    as one row of fields. */}
                <label className="mt-3 flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Name
                  </span>
                  <input
                    value={block.name}
                    onChange={(e) => patchBlock(block.id, { name: e.target.value })}
                    placeholder="Set name"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none transition placeholder:text-zinc-700 focus:border-emerald-600"
                  />
                </label>
                <div className="mt-3 flex gap-3">
                  <NumberField
                    label="Reps"
                    min={1}
                    value={block.reps}
                    onChange={(reps) => patchBlock(block.id, { reps })}
                  />
                  <NumberField
                    label="Duration"
                    suffix="sec"
                    value={block.workSec}
                    onChange={(workSec) => patchBlock(block.id, { workSec })}
                  />
                  <NumberField
                    label="Break"
                    suffix="sec"
                    value={block.restSec}
                    onChange={(restSec) => patchBlock(block.id, { restSec })}
                  />
                </div>
              </>
            ) : (
              <div className="mt-3 flex gap-3">
                <NumberField
                  label="Length"
                  suffix="sec"
                  value={block.durationSec}
                  onChange={(durationSec) => patchBlock(block.id, { durationSec })}
                />
                {/* Keeps the field the same width as the ones on a Set card. */}
                <div className="flex-[2]" />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => addBlock(emptyExercise())}
          className="flex-1 rounded-lg border border-dashed border-emerald-900 py-3 text-sm font-medium text-emerald-300 transition hover:border-emerald-700 hover:bg-emerald-950/30"
        >
          + Set
        </button>
        <button
          type="button"
          onClick={() => addBlock(emptyRest())}
          className="flex-1 rounded-lg border border-dashed border-purple-900 py-3 text-sm font-medium text-purple-300 transition hover:border-purple-700 hover:bg-purple-950/30"
        >
          + Break
        </button>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={routine.blocks.length === 0}
          className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-200 transition duration-300 hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save routine
        </button>
        <Link
          href="/"
          className="rounded-lg px-4 py-2.5 text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
