/**
 * Server-side document shape.
 * Must match `@fp/types` PlanDocument on the frontend.
 */

/** Plan document stored in projects.document (JSONB). */
export interface PlanDocument {
  objects: unknown[];
  groups: unknown[];
  groupSeq: number;
  levels?: unknown[];
  units?: unknown[];
  levelSeq?: number;
  unitSeq?: number;
  labelOffsets: Record<string, unknown>;
  showDimensionsGlobal: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
}

/** Empty document for a new project (frontend normalizes full structure). */
export function emptyPlanDocument(): PlanDocument {
  return {
    objects: [],
    groups: [],
    groupSeq: 1,
    levels: [{ id: "level-1", name: "Ground", order: 0 }],
    units: [{ id: "unit-1", name: "Main", levelId: "level-1" }],
    levelSeq: 1,
    unitSeq: 1,
    labelOffsets: {},
    showDimensionsGlobal: false,
  };
}

/** Project row returned by list endpoints. */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Full project including document. */
export interface Project extends ProjectSummary {
  document: PlanDocument;
}

/**
 * Coerce unknown JSON into a PlanDocument with safe defaults.
 * @param value - Raw JSONB value
 * @returns Normalized document
 */
export function normalizePlanDocument(value: unknown): PlanDocument {
  const base = emptyPlanDocument();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  return {
    objects: Array.isArray(v.objects) ? v.objects : [],
    groups: Array.isArray(v.groups) ? v.groups : [],
    groupSeq: typeof v.groupSeq === "number" && Number.isFinite(v.groupSeq) ? v.groupSeq : 1,
    labelOffsets:
      v.labelOffsets && typeof v.labelOffsets === "object" && !Array.isArray(v.labelOffsets)
        ? (v.labelOffsets as Record<string, unknown>)
        : {},
    showDimensionsGlobal: v.showDimensionsGlobal === undefined ? false : !!v.showDimensionsGlobal,
    zoom: typeof v.zoom === "number" ? v.zoom : undefined,
    panX: typeof v.panX === "number" ? v.panX : undefined,
    panY: typeof v.panY === "number" ? v.panY : undefined,
  };
}
