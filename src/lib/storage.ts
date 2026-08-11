import type { Block, Routine } from "./types";
import { newId } from "./types";

const ROUTINES_KEY = "climbing-timer:routines:v1";
const SOUND_KEY = "climbing-timer:sound:v1";

export type SoundSettings = {
  /** Tone when one block hands off to the next. */
  transition: boolean;
  /** Ticks on the final three seconds. */
  countdown: boolean;
};

export const defaultSound: SoundSettings = { transition: true, countdown: true };

export function loadSound(): SoundSettings {
  if (typeof window === "undefined") return defaultSound;
  try {
    const raw = window.localStorage.getItem(SOUND_KEY);
    if (!raw) return defaultSound;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      transition: parsed.transition ?? defaultSound.transition,
      countdown: parsed.countdown ?? defaultSound.countdown,
    };
  } catch {
    return defaultSound;
  }
}

export function saveSound(settings: SoundSettings): void {
  try {
    window.localStorage.setItem(SOUND_KEY, JSON.stringify(settings));
  } catch {
    // Storage disabled — settings just won't persist.
  }
}

export function loadRoutines(): Routine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ROUTINES_KEY);
    if (!raw) return [];
    return sanitizeRoutines(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRoutines(routines: Routine[]): void {
  try {
    window.localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
  } catch {
    // Storage disabled or full.
  }
}

export function upsertRoutine(routine: Routine): Routine[] {
  const routines = loadRoutines();
  const index = routines.findIndex((r) => r.id === routine.id);
  if (index >= 0) routines[index] = routine;
  else routines.push(routine);
  saveRoutines(routines);
  return routines;
}

export function deleteRoutine(id: string): Routine[] {
  const routines = loadRoutines().filter((r) => r.id !== id);
  saveRoutines(routines);
  return routines;
}

/** Stored order is display order, so reordering is just a splice. */
export function moveRoutine(from: number, to: number): Routine[] {
  const routines = loadRoutines();
  if (from === to || from < 0 || to < 0 || from >= routines.length || to >= routines.length) {
    return routines;
  }
  const [moved] = routines.splice(from, 1);
  routines.splice(to, 0, moved);
  saveRoutines(routines);
  return routines;
}

export function getRoutine(id: string): Routine | null {
  return loadRoutines().find((r) => r.id === id) ?? null;
}

export function exportRoutines(routines: Routine[], filename?: string): void {
  const blob = new Blob([JSON.stringify({ version: 1, routines }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ?? `routines-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRoutine(routine: Routine): void {
  const slug =
    routine.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "routine";
  exportRoutines([routine], `${slug}.json`);
}

/** Imported routines get fresh ids so they never clobber existing ones. */
export async function importRoutines(file: File): Promise<Routine[]> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const incoming = sanitizeRoutines(
    Array.isArray(parsed)
      ? parsed
      : (parsed as { routines?: unknown })?.routines,
  );
  if (incoming.length === 0) throw new Error("No routines found in that file.");

  const existing = loadRoutines();
  const merged = [
    ...existing,
    ...incoming.map((r) => ({ ...r, id: newId(), updatedAt: Date.now() })),
  ];
  saveRoutines(merged);
  return merged;
}

function sanitizeRoutines(value: unknown): Routine[] {
  if (!Array.isArray(value)) return [];
  const routines: Routine[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const blocks = sanitizeBlocks(r.blocks);
    routines.push({
      id: typeof r.id === "string" ? r.id : newId(),
      name: typeof r.name === "string" && r.name.trim() ? r.name : "Untitled routine",
      blocks,
      createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
      updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
    });
  }

  return routines;
}

function sanitizeBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const blocks: Block[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const id = typeof b.id === "string" ? b.id : newId();

    if (b.type === "rest") {
      // Older exports carried a name here; it's dropped on read.
      blocks.push({ id, type: "rest", durationSec: num(b.durationSec, 60) });
    } else if (b.type === "exercise") {
      blocks.push({
        id,
        type: "exercise",
        name: typeof b.name === "string" ? b.name : "Set",
        reps: Math.max(1, num(b.reps, 1)),
        workSec: num(b.workSec, 7),
        restSec: num(b.restSec, 3),
      });
    }
  }

  return blocks;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}
