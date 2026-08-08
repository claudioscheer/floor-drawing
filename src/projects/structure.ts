/**
 * Building structure helpers for floors.
 * Pure — no DOM.
 */

import type { Floor, PlanObject } from "@fp/types";

/** Default ground-floor id for new projects. */
export const DEFAULT_FLOOR_ID = "floor-1";

/**
 * Default single-floor structure.
 * @returns Floors and sequence counter
 */
export function createDefaultStructure(): {
  floors: Floor[];
  floorSeq: number;
} {
  return {
    floors: [{ id: DEFAULT_FLOOR_ID, name: "Ground", order: 0 }],
    floorSeq: 1,
  };
}

/**
 * Normalize floors array; ensure at least one floor exists.
 * @param raw - Stored floors
 * @returns Normalized floors
 */
export function normalizeFloors(raw: unknown): Floor[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultStructure().floors;
  }
  const floors: Floor[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : `floor-${i + 1}`;
    const name =
      typeof r.name === "string" && r.name.trim()
        ? r.name.trim()
        : i === 0
          ? "Ground"
          : `Floor ${i + 1}`;
    const order =
      typeof r.order === "number" && Number.isFinite(r.order) ? r.order : i;
    floors.push({ id, name, order });
  }
  if (!floors.length) return createDefaultStructure().floors;
  floors.sort((a, b) => a.order - b.order);
  return floors;
}

/**
 * Assign a valid floorId on every object. Terrain always belongs to Ground.
 * @param objects - Plan objects
 * @param floors - Floors
 * @returns Objects with valid floor ownership
 */
export function ensureObjectStructure(
  objects: PlanObject[],
  floors: Floor[]
): PlanObject[] {
  const defaultFloor = floors[0]?.id || DEFAULT_FLOOR_ID;
  const floorIds = new Set(floors.map((floor) => floor.id));
  return objects.map((object) => ({
    ...object,
    floorId:
      object.type === "terrain"
        ? defaultFloor
        : typeof object.floorId === "string" && floorIds.has(object.floorId)
          ? object.floorId
          : defaultFloor,
  }));
}

/**
 * Next floor name suggestion.
 * @param floors - Existing floors
 * @returns Suggested floor name
 */
export function nextFloorName(floors: Floor[]): string {
  if (!floors.length) return "Ground";
  return `Floor ${floors.length}`;
}
