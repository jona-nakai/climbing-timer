"use client";

import { useState } from "react";

type Props = {
  label: string;
  value: number;
  min?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

/**
 * Number input that tolerates a temporarily empty box while typing, and only
 * reports valid numbers upward. `draft` is null whenever the input isn't being
 * edited, so the committed value always wins.
 */
export function NumberField({ label, value, min = 0, suffix, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          value={draft ?? String(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(parsed)) {
              onChange(Math.max(min, Math.round(parsed)));
            }
          }}
          onBlur={() => setDraft(null)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm tabular outline-none transition focus:border-emerald-600"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-xs text-zinc-600">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}
