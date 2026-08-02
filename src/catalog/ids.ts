/**
 * Stable id generation for plan objects.
 * Module-local counter; seed from existing objects after load/undo.
 */

import type { ObjectType, PlanObject } from "@fp/types";

let idCounter = 1;

/**
 * Allocate the next id for a type (`floor-3`, `wall-12`, …).
 * @param type - Object type prefix
 */
export function nextId(type: ObjectType | string): string {
  return `${type}-${idCounter++}`;
}

/**
 * Advance the counter past the highest numeric suffix in `objects`.
 * Call after loading a plan or restoring history so new ids do not collide.
 * @param objects - Existing plan objects
 */
export function seedIdCounter(objects: ReadonlyArray<Pick<PlanObject, "id">>): void {
  let max = 0;
  for (const obj of objects) {
    const mMatch = String(obj.id).match(/-(\d+)$/);
    if (mMatch) max = Math.max(max, Number(mMatch[1]));
  }
  idCounter = max + 1;
}

/** Reset counter (tests only). */
export function resetIdCounter(value = 1): void {
  idCounter = value;
}
