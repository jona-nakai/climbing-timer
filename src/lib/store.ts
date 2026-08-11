"use client";

import { useSyncExternalStore } from "react";
import {
  deleteRoutine as deleteFromStorage,
  importRoutines as importToStorage,
  loadRoutines,
  loadSound,
  moveRoutine as moveInStorage,
  saveSound,
  upsertRoutine as upsertToStorage,
  defaultSound,
  type SoundSettings,
} from "./storage";
import type { Routine } from "./types";

/**
 * A tiny external store over localStorage. Using useSyncExternalStore (rather
 * than loading in an effect) keeps SSR honest and syncs across browser tabs.
 */

const EMPTY: Routine[] = [];
const listeners = new Set<() => void>();

let routineCache: Routine[] | null = null;
let soundCache: SoundSettings | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function onStorageEvent() {
  routineCache = null;
  soundCache = null;
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorageEvent);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorageEvent);
    }
  };
}

function getRoutinesSnapshot(): Routine[] {
  routineCache ??= loadRoutines();
  return routineCache;
}

function getSoundSnapshot(): SoundSettings {
  soundCache ??= loadSound();
  return soundCache;
}

export function useRoutines(): Routine[] {
  return useSyncExternalStore(subscribe, getRoutinesSnapshot, () => EMPTY);
}

export function useRoutine(id: string): Routine | null {
  const routines = useRoutines();
  return routines.find((r) => r.id === id) ?? null;
}

/** False during server render and hydration, true once the client owns the UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function useSound(): SoundSettings {
  return useSyncExternalStore(subscribe, getSoundSnapshot, () => defaultSound);
}

export function setSound(next: SoundSettings): void {
  saveSound(next);
  soundCache = next;
  emit();
}

export function saveRoutine(routine: Routine): void {
  routineCache = upsertToStorage(routine);
  emit();
}

export function removeRoutine(id: string): void {
  routineCache = deleteFromStorage(id);
  emit();
}

export function reorderRoutines(from: number, to: number): void {
  routineCache = moveInStorage(from, to);
  emit();
}

export async function importRoutineFile(file: File): Promise<void> {
  routineCache = await importToStorage(file);
  emit();
}
