/**
 * Pure helpers for plan documents stored on projects.
 * No DOM / fetch — unit-testable.
 */

import type {
  Group,
  LabelOffsetsMap,
  PlanDocument,
  PlanExport,
  PlanObject,
} from "@fp/types";

/** Input needed to build a {@link PlanDocument} from live editor state. */
export interface PlanDocumentSource {
  objects: PlanObject[];
  groups: Group[];
  groupSeq: number;
  labelOffsets: LabelOffsetsMap;
  showDimensionsGlobal: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
}

/**
 * Build an empty plan document for a new project.
 * @returns Empty {@link PlanDocument}
 */
export function emptyPlanDocument(): PlanDocument {
  return {
    objects: [],
    groups: [],
    groupSeq: 1,
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
    labelOffsets: cloneJson(source.labelOffsets || {}),
    showDimensionsGlobal: !!source.showDimensionsGlobal,
    zoom: typeof source.zoom === "number" ? source.zoom : undefined,
    panX: typeof source.panX === "number" ? source.panX : undefined,
    panY: typeof source.panY === "number" ? source.panY : undefined,
  };
}

/**
 * Normalize an unknown API payload into a PlanDocument with safe defaults.
 * @param value - Raw document from API
 * @returns Normalized {@link PlanDocument}
 */
export function normalizePlanDocument(value: unknown): PlanDocument {
  const base = emptyPlanDocument();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  return {
    objects: Array.isArray(v.objects) ? (v.objects as PlanObject[]) : [],
    groups: Array.isArray(v.groups) ? (v.groups as Group[]) : [],
    groupSeq:
      typeof v.groupSeq === "number" && Number.isFinite(v.groupSeq)
        ? v.groupSeq
        : 1,
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
