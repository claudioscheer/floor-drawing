/**
 * Pure helpers for plan documents stored on projects.
 * No DOM / fetch — unit-testable.
 */

import { normalizeObjectType } from "@fp/catalog";
import type {
  Group,
  LabelOffsetsMap,
  Level,
  PlanDocument,
  PlanExport,
  PlanObject,
  Unit,
} from "@fp/types";
import {
  createDefaultStructure,
  ensureObjectStructure,
  normalizeLevels,
  normalizeUnits,
} from "./structure";

/**
 * Normalize one plan object (legacy type `"floor"` → room | furniture).
 * @param raw - Stored object
 */
function normalizePlanObject(raw: unknown): PlanObject | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as PlanObject & { type: string };
  const name = typeof o.name === "string" ? o.name : "";
  const type = normalizeObjectType(String(o.type || "room"), name);
  let unitId: string | null = null;
  if (o.unitId === null || o.unitId === undefined || o.unitId === "") {
    unitId = null;
  } else if (typeof o.unitId === "string") {
    unitId = o.unitId;
  }
  return {
    ...o,
    type,
    name,
    levelId: typeof o.levelId === "string" ? o.levelId : "",
    unitId,
  } as PlanObject;
}

/** Input needed to build a {@link PlanDocument} from live editor state. */
export interface PlanDocumentSource {
  objects: PlanObject[];
  groups: Group[];
  groupSeq: number;
  levels: Level[];
  units: Unit[];
  levelSeq: number;
  unitSeq: number;
  labelOffsets: LabelOffsetsMap;
  showDimensionsGlobal: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
}

/**
 * Build an empty plan document for a new project (Ground + Main unit).
 * @returns Empty {@link PlanDocument}
 */
export function emptyPlanDocument(): PlanDocument {
  const structure = createDefaultStructure();
  return {
    objects: [],
    groups: [],
    groupSeq: 1,
    levels: structure.levels,
    units: structure.units,
    levelSeq: structure.levelSeq,
    unitSeq: structure.unitSeq,
    labelOffsets: {},
    showDimensionsGlobal: false,
  };
}

/**
 * Deep-clone plain JSON data.
 * Uses JSON round-trip so Alpine/Vue-style reactive Proxies still clone
 * (structuredClone cannot clone Proxy-wrapped arrays/objects).
 * @param value - JSON-serializable value
 * @returns Deep copy
 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Snapshot editor fields into a persistable document (no selection).
 * @param source - Live editor fields
 * @returns Deep-cloned {@link PlanDocument}
 */
export function buildPlanDocument(source: PlanDocumentSource): PlanDocument {
  return {
    objects: cloneJson(source.objects),
    groups: cloneJson(source.groups),
    groupSeq: Number(source.groupSeq) || 1,
    levels: cloneJson(source.levels || []),
    units: cloneJson(source.units || []),
    levelSeq: Number(source.levelSeq) || 1,
    unitSeq: Number(source.unitSeq) || 1,
    labelOffsets: cloneJson(source.labelOffsets || {}),
    showDimensionsGlobal: !!source.showDimensionsGlobal,
    zoom: typeof source.zoom === "number" ? source.zoom : undefined,
    panX: typeof source.panX === "number" ? source.panX : undefined,
    panY: typeof source.panY === "number" ? source.panY : undefined,
  };
}

/**
 * Normalize an unknown API payload into a PlanDocument with safe defaults.
 * Ensures levels/units exist and every object has levelId + unitId.
 * @param value - Raw document from API
 * @returns Normalized {@link PlanDocument}
 */
export function normalizePlanDocument(value: unknown): PlanDocument {
  const base = emptyPlanDocument();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  const levels = normalizeLevels(v.levels);
  const units = normalizeUnits(v.units, levels);
  let objects = Array.isArray(v.objects)
    ? (v.objects as unknown[])
        .map(normalizePlanObject)
        .filter((o): o is PlanObject => o != null)
    : [];
  objects = ensureObjectStructure(objects, levels, units);

  const maxLevelN = levels.reduce((m, l) => {
    const n = Number(String(l.id).replace(/^level-/, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  const maxUnitN = units.reduce((m, u) => {
    const n = Number(String(u.id).replace(/^unit-/, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);

  return {
    objects,
    groups: Array.isArray(v.groups) ? (v.groups as Group[]) : [],
    groupSeq:
      typeof v.groupSeq === "number" && Number.isFinite(v.groupSeq)
        ? v.groupSeq
        : 1,
    levels,
    units,
    levelSeq: Math.max(
      typeof v.levelSeq === "number" ? v.levelSeq : 0,
      maxLevelN,
      levels.length
    ),
    unitSeq: Math.max(
      typeof v.unitSeq === "number" ? v.unitSeq : 0,
      maxUnitN,
      units.length
    ),
    labelOffsets:
      v.labelOffsets &&
      typeof v.labelOffsets === "object" &&
      !Array.isArray(v.labelOffsets)
        ? (v.labelOffsets as LabelOffsetsMap)
        : {},
    showDimensionsGlobal:
      v.showDimensionsGlobal === undefined ? false : !!v.showDimensionsGlobal,
    zoom: typeof v.zoom === "number" ? v.zoom : undefined,
    panX: typeof v.panX === "number" ? v.panX : undefined,
    panY: typeof v.panY === "number" ? v.panY : undefined,
  };
}

/**
 * Build a downloadable export payload from name + document.
 * @param name - Project / plan name
 * @param doc - Plan document
 * @returns {@link PlanExport}
 */
export function planDocumentToExport(
  name: string,
  doc: PlanDocument
): PlanExport {
  const labelOffsets = doc.labelOffsets || {};
  return {
    name: name || "floor-plan",
    exportedAt: new Date().toISOString(),
    groups: doc.groups,
    levels: doc.levels,
    units: doc.units,
    objects: doc.objects.map((o) => {
      const off = labelOffsets[o.id] || {
        w: { x: 0, y: 0 },
        h: { x: 0, y: 0 },
        n: { x: 0, y: 0 },
      };
      return {
        ...o,
        dimOffW: { ...off.w },
        dimOffH: { ...off.h },
        dimOffN: { ...(off.n || { x: 0, y: 0 }) },
      };
    }),
    labelOffsets: cloneJson(labelOffsets),
  };
}
