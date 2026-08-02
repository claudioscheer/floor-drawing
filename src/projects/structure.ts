/**
 * Building structure helpers: levels (stories) and units (house / apartment).
 * Pure — no DOM.
 */

import type { Level, PlanObject, Unit } from "@fp/types";

/** Default ground-level id for new / migrated projects. */
export const DEFAULT_LEVEL_ID = "level-1";
/** Default main unit id for new / migrated projects. */
export const DEFAULT_UNIT_ID = "unit-1";

/**
 * Default single-level, single-unit structure (house or one unit on ground).
 * @returns levels, units, and sequence counters
 */
export function createDefaultStructure(): {
  levels: Level[];
  units: Unit[];
  levelSeq: number;
  unitSeq: number;
} {
  return {
    levels: [{ id: DEFAULT_LEVEL_ID, name: "Ground", order: 0 }],
    units: [
      { id: DEFAULT_UNIT_ID, name: "Main", levelId: DEFAULT_LEVEL_ID },
    ],
    levelSeq: 1,
    unitSeq: 1,
  };
}

/**
 * Normalize levels array; ensure at least one level exists.
 * @param raw - Stored levels
 */
export function normalizeLevels(raw: unknown): Level[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultStructure().levels;
  }
  const levels: Level[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : `level-${i + 1}`;
    const name =
      typeof r.name === "string" && r.name.trim()
        ? r.name.trim()
        : i === 0
          ? "Ground"
          : `Level ${i + 1}`;
    const order =
      typeof r.order === "number" && Number.isFinite(r.order) ? r.order : i;
    levels.push({ id, name, order });
  }
  if (!levels.length) return createDefaultStructure().levels;
  levels.sort((a, b) => a.order - b.order);
  return levels;
}

/**
 * Normalize units; ensure each level has at least one unit.
 * @param raw - Stored units
 * @param levels - Normalized levels
 */
export function normalizeUnits(raw: unknown, levels: Level[]): Unit[] {
  const levelIds = new Set(levels.map((l) => l.id));
  const units: Unit[] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === "string" && r.id ? r.id : `unit-${i + 1}`;
      const levelId =
        typeof r.levelId === "string" && levelIds.has(r.levelId)
          ? r.levelId
          : levels[0].id;
      const name =
        typeof r.name === "string" && r.name.trim()
          ? r.name.trim()
          : "Main";
      units.push({ id, name, levelId });
    }
  }
  // Every level needs ≥1 unit
  for (const level of levels) {
    if (!units.some((u) => u.levelId === level.id)) {
      units.push({
        id: `unit-${level.id}`,
        name: "Main",
        levelId: level.id,
      });
    }
  }
  return units;
}

/**
 * Assign levelId on objects that lack it. unitId may stay null (shared on level).
 * Invalid unit ids are cleared to null (level-only), not forced onto a unit.
 * @param objects - Plan objects
 * @param levels - Levels
 * @param units - Units
 */
export function ensureObjectStructure(
  objects: PlanObject[],
  levels: Level[],
  units: Unit[]
): PlanObject[] {
  const defaultLevel = levels[0]?.id || DEFAULT_LEVEL_ID;
  const unitIds = new Set(units.map((u) => u.id));
  const levelIds = new Set(levels.map((l) => l.id));

  return objects.map((o) => {
    let levelId =
      typeof o.levelId === "string" && levelIds.has(o.levelId)
        ? o.levelId
        : defaultLevel;
    let unitId: string | null = null;
    if (typeof o.unitId === "string" && o.unitId && unitIds.has(o.unitId)) {
      unitId = o.unitId;
      const unit = units.find((u) => u.id === unitId);
      // Keep object on the unit's level
      if (unit) levelId = unit.levelId;
    }
    // null / missing / invalid unitId → shared on the level
    return { ...o, levelId, unitId };
  });
}

/**
 * Units that belong to a level, in list order.
 * @param units - All units
 * @param levelId - Level id
 */
export function unitsOnLevel(units: Unit[], levelId: string): Unit[] {
  return units.filter((u) => u.levelId === levelId);
}

/**
 * Next level name suggestion.
 * @param levels - Existing levels
 */
export function nextLevelName(levels: Level[]): string {
  if (!levels.length) return "Ground";
  return `Level ${levels.length}`;
}

/**
 * Next unit name on a level (house, apartment, suite…).
 * @param units - Units on that level
 */
export function nextUnitName(units: Unit[]): string {
  const n = units.length + 1;
  if (n === 1) return "Main";
  return `Unit ${n}`;
}
