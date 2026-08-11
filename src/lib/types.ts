export type ExerciseBlock = {
  id: string;
  type: "exercise";
  name: string;
  reps: number;
  workSec: number;
  restSec: number;
};

/** A break has no name — it's always just a break, and the colour says so. */
export type RestBlock = {
  id: string;
  type: "rest";
  durationSec: number;
};

export type Block = ExerciseBlock | RestBlock;

export type Routine = {
  id: string;
  name: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
};

/**
 * - `work`   — a rep (green)
 * - `rest`   — the generated break *between* reps (blue)
 * - `break`  — a standalone break block (purple)
 */
export type SegmentKind = "work" | "rest" | "break";

/** One countdown in the flattened timeline the runner actually plays. */
export type Segment = {
  key: string;
  blockId: string;
  blockIndex: number;
  kind: SegmentKind;
  label: string;
  detail: string;
  duration: number;
  /** 1-based rep this segment is (or, for a break, leads into). 0 off a set. */
  rep: number;
  /** Reps in the owning set; 0 for a break block. */
  reps: number;
};

export function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyExercise(): ExerciseBlock {
  return {
    id: newId(),
    type: "exercise",
    name: "Set",
    reps: 3,
    workSec: 30,
    restSec: 20,
  };
}

export function emptyRest(): RestBlock {
  return { id: newId(), type: "rest", durationSec: 60 };
}

/** Flatten a routine into the timeline of countdowns. */
export function expandRoutine(routine: Routine): Segment[] {
  const segments: Segment[] = [];

  routine.blocks.forEach((block, blockIndex) => {
    if (block.type === "rest") {
      if (block.durationSec <= 0) return;
      segments.push({
        key: `${block.id}:rest`,
        blockId: block.id,
        blockIndex,
        kind: "break",
        label: "Break",
        detail: "",
        duration: block.durationSec,
        rep: 0,
        reps: 0,
      });
      return;
    }

    const reps = Math.max(1, block.reps);
    for (let rep = 0; rep < reps; rep++) {
      if (block.workSec > 0) {
        segments.push({
          key: `${block.id}:w${rep}`,
          blockId: block.id,
          blockIndex,
          kind: "work",
          label: block.name || "Set",
          detail: reps > 1 ? `${rep + 1} / ${reps}` : "",
          duration: block.workSec,
          rep: rep + 1,
          reps,
        });
      }
      // Rests sit *between* reps, so the block never ends on one.
      if (rep < reps - 1 && block.restSec > 0) {
        segments.push({
          key: `${block.id}:r${rep}`,
          blockId: block.id,
          blockIndex,
          kind: "rest",
          // Keeps the set's name on screen through its own breaks; the colour
          // and the sub-line say it's a break.
          label: block.name || "Set",
          // Which rep comes next when the break ends.
          detail: `${rep + 2} / ${reps}`,
          duration: block.restSec,
          rep: rep + 2,
          reps,
        });
      }
    }
  });

  return segments;
}

export function blockDuration(block: Block): number {
  if (block.type === "rest") return Math.max(0, block.durationSec);
  const reps = Math.max(1, block.reps);
  return reps * Math.max(0, block.workSec) + (reps - 1) * Math.max(0, block.restSec);
}

export function routineDuration(routine: Routine): number {
  return routine.blocks.reduce((total, block) => total + blockDuration(block), 0);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
