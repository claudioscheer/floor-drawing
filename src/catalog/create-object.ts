/**
 * Factory for plan objects from catalog defaults.
 */

import type {
  CatalogListItem,
  MinSize,
  ObjectType,
  PlanObject,
  PlanObjectOverrides,
} from "@fp/types";
import { clampOpacity, normalizeRotation } from "@fp/geometry";
import { m } from "@fp/units";
import { CATALOG } from "./catalog-data";
import { nextId } from "./ids";

/**
 * Create a plan object of the given type.
 * @param type - Catalog type
 * @param overrides - Field overrides (position, size, door config, …)
 * @throws If `type` is not in the catalog
 */
export function createObject(
  type: ObjectType,
  overrides: PlanObjectOverrides = {}
): PlanObject {
  const def = CATALOG[type];
  if (!def) throw new Error(`Unknown component type: ${type}`);

  const width = overrides.width ?? def.defaults.width;
  const height = overrides.height ?? def.defaults.height;

  const obj: PlanObject = {
    id: overrides.id || nextId(type),
    type,
    name: overrides.name !== undefined ? overrides.name : def.defaults.name,
    notes: overrides.notes ?? "",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width,
    height,
    rotation: normalizeRotation(
      overrides.rotation !== undefined ? overrides.rotation : (def.defaults.rotation ?? 0)
    ),
    labelRotation: normalizeRotation(
      overrides.labelRotation !== undefined
        ? overrides.labelRotation
        : (def.defaults.labelRotation ?? 0)
    ),
    visible: overrides.visible !== undefined ? !!overrides.visible : true,
    locked: overrides.locked !== undefined ? !!overrides.locked : false,
    groupId:
      overrides.groupId != null && overrides.groupId !== ""
        ? String(overrides.groupId)
        : null,
    opacity: clampOpacity(
      overrides.opacity !== undefined ? overrides.opacity : (def.defaults.opacity ?? 1)
    ),
    showDimensions:
      overrides.showDimensions !== undefined ? !!overrides.showDimensions : true,
    dimOffW: {
      x: overrides.dimOffW?.x ?? 0,
      y: overrides.dimOffW?.y ?? 0,
    },
    dimOffH: {
      x: overrides.dimOffH?.x ?? 0,
      y: overrides.dimOffH?.y ?? 0,
    },
  };

  if (type === "door") {
    obj.hinge = overrides.hinge ?? def.defaults.hinge ?? "start";
    obj.opens = overrides.opens ?? def.defaults.opens ?? "neg";
  }

  return obj;
}

/**
 * Catalog entries for the left tools palette.
 * @returns List of type / label / description
 */
export function getCatalogList(): CatalogListItem[] {
  return Object.values(CATALOG).map((c) => ({
    type: c.type,
    label: c.label,
    description: c.description,
  }));
}

/**
 * Minimum width/height for a type (world pixels).
 * @param type - Object type
 */
export function getMinSize(type: ObjectType | string): MinSize {
  const def = CATALOG[type as ObjectType];
  return def ? { minW: def.minW, minH: def.minH } : { minW: m(0.08), minH: m(0.08) };
}
