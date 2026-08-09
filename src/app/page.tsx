"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { importRoutineFile, removeRoutine, useRoutines } from "@/lib/store";
import { exportRoutine } from "@/lib/storage";
import { formatDuration, routineDuration, type Routine } from "@/lib/types";

export default function HomePage() {
  const routines = useRoutines();
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleImport(file: File) {
    setError(null);
    try {
      await importRoutineFile(file);
    } catch {
      setError("Couldn't read that file — expected a routine export.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-center text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
        Interval Timer
      </h1>

      <Link
        href="/routines/new"
        className="mt-8 block rounded-2xl border border-zinc-800 bg-zinc-900/40 py-4 text-center font-medium text-zinc-300 transition duration-300 hover:border-blue-800 hover:bg-blue-950 hover:text-blue-100"
      >
        New routine
      </Link>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {routines.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
          No routines yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {routines.map((routine) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              open={menuFor === routine.id}
              setMenuFor={setMenuFor}
            />
          ))}
        </ul>
      )}

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100/5 hover:text-zinc-300"
        >
          Import a routine
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = "";
        }}
      />
    </main>
  );
}

function RoutineRow({
  routine,
  open,
  setMenuFor,
}: {
  routine: Routine;
  open: boolean;
  setMenuFor: (id: string | null) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuFor(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setMenuFor]);

  return (
    <li
      className={`group relative rounded-xl border border-zinc-800 bg-zinc-900/40 transition duration-300 hover:border-emerald-800 hover:bg-emerald-950 ${
        open ? "z-20" : ""
      }`}
    >
      {/* The whole card runs the routine; the menu sits above it. */}
      <Link href={`/run/${routine.id}`} className="block py-3.5 pl-4 pr-14">
        <span className="block font-medium transition group-hover:text-emerald-100">
          {routine.name}
        </span>
        <span className="mt-0.5 block text-sm text-zinc-500 transition group-hover:text-emerald-200/60">
          {routine.blocks.length}{" "}
          {routine.blocks.length === 1 ? "block" : "blocks"} ·{" "}
          {formatDuration(routineDuration(routine))}
        </span>
      </Link>

      <div ref={menuRef} className="absolute inset-y-0 right-2 flex items-center">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Options for ${routine.name}`}
          onClick={() => setMenuFor(open ? null : routine.id)}
          className={`rounded-lg px-2 py-2 transition hover:bg-black/25 hover:text-emerald-100 group-hover:text-emerald-200/70 ${
            open ? "bg-zinc-100/10 text-zinc-100" : "text-zinc-600"
          }`}
        >
          <DotsIcon />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 w-36 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 py-1 text-sm shadow-2xl"
          >
            <Link
              role="menuitem"
              href={`/routines/${routine.id}/edit`}
              className="block px-3.5 py-2 text-zinc-300 transition hover:bg-zinc-100/10 hover:text-zinc-100"
            >
              Edit
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                exportRoutine(routine);
                setMenuFor(null);
              }}
              className="block w-full px-3.5 py-2 text-left text-zinc-300 transition hover:bg-sky-400/15 hover:text-sky-200"
            >
              Export
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuFor(null);
                if (confirm(`Delete "${routine.name}"?`)) removeRoutine(routine.id);
              }}
              className="block w-full px-3.5 py-2 text-left text-zinc-300 transition hover:bg-red-400/15 hover:text-red-200"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
