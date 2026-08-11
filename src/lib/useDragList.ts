"use client";

import { useState, type DragEvent, type PointerEvent } from "react";

/**
 * Drag-to-reorder wiring shared by the routine list and the block editor.
 *
 * The dragged row is tracked by *id*, never by index. An index captured at
 * dragstart goes stale the moment the list reorders under the cursor, which is
 * what made a different row than the one you grabbed appear to move.
 *
 * A reorder only happens once the pointer crosses the midpoint of the row it's
 * over, so hovering the seam between two rows can't flip them back and forth.
 */
export function useDragList<T extends { id: string }>(
  items: readonly T[],
  move: (from: number, to: number) => void,
) {
  // Set on pointer-down over a handle: HTML5 drag stays off until then, so
  // text selection and clicks elsewhere in the row keep working.
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  /** Spread onto the row element (the one that moves). */
  function rowProps(id: string) {
    return {
      draggable: armedId === id,
      onDragStart(e: DragEvent<HTMLElement>) {
        setDragId(id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
      },
      onDragOver(e: DragEvent<HTMLElement>) {
        e.preventDefault();
        if (!dragId || dragId === id) return;

        const from = items.findIndex((item) => item.id === dragId);
        const to = items.findIndex((item) => item.id === id);
        if (from < 0 || to < 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const pastMiddle = e.clientY > rect.top + rect.height / 2;
        if (from < to ? !pastMiddle : pastMiddle) return;

        move(from, to);
      },
      onDrop(e: DragEvent<HTMLElement>) {
        e.preventDefault();
      },
      onDragEnd() {
        setDragId(null);
        setArmedId(null);
      },
    };
  }

  /** Spread onto whatever part of the row is the grab area. */
  function handleProps(id: string) {
    return {
      onPointerDown() {
        setArmedId(id);
      },
      onPointerUp() {
        setArmedId(null);
      },
    };
  }

  /** Spread onto controls inside the handle that shouldn't arm a drag. */
  const stopArming = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      e.stopPropagation();
    },
  };

  return { dragId, rowProps, handleProps, stopArming };
}
