"use client";

import Link from "next/link";
import { use } from "react";
import { RoutineEditor } from "@/components/RoutineEditor";
import { useHydrated, useRoutine } from "@/lib/store";

export default function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const routine = useRoutine(id);

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

  return <RoutineEditor key={routine.id} initial={routine} />;
}
