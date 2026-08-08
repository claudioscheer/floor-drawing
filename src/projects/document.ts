/** Pure helpers for plan documents stored on projects. No DOM / fetch. */

import { normalizeObjectType } from "@fp/catalog";
import type {
  Floor,
  Group,
  LabelOffsetsMap,
  PlanDocument,
  PlanExport,
  PlanObject,
} from "@fp/types";
import {
  createDefaultStructure,
  ensureObjectStructure,
  normalizeFloors,
} from "./structure";

/** Normalize one stored plan object. */
function normalizePlanObject(raw: unknown): PlanObject | null {
  if (!raw || typeof raw !== "object") return null;
  const object = raw as PlanObject & { type: string };
  const name = typeof object.name === "string" ? object.name : "";
  return {
    ...object,
    type: normalizeObjectType(String(object.type || "room"), name),
    name,
    floorId: typeof object.floorId === "string" ? object.floorId : "",
  } as PlanObject;
}

/** Input needed to build a {@link PlanDocument} from live editor state. */
export interface PlanDocumentSource {
  objects: PlanObject[];
  groups: Group[];
  groupSeq: number;
  floors: Floor[];
  floorSeq: number;
  snapToFloorBelow: boolean;
  labelOffsets: LabelOffsetsMap;
  showDimensionsGlobal: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
}

/** @returns An empty Ground-floor plan document. */
export function emptyPlanDocument(): PlanDocument {
  const structure = createDefaultStructure();
  return {
    objects: [],
    groups: [],
    groupSeq: 1,
    floors: structure.floors,
    floorSeq: structure.floorSeq,
    snapToFloorBelow: false,
    labelOffsets: {},
    showDimensionsGlobal: false,
  };
}

/** @returns Deep copy of JSON-serializable data. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Snapshot editor fields into a persistable document (no selection).
 * @param source - Live editor fields
 * @returns Deep-cloned plan document
 */
export function buildPlanDocument(source: PlanDocumentSource): PlanDocument {
  return {
    objects: cloneJson(source.objects),
    groups: cloneJson(source.groups),
    groupSeq: Number(source.groupSeq) || 1,
    floors: cloneJson(source.floors || []),
    floorSeq: Number(source.floorSeq) || 1,
    snapToFloorBelow: !!source.snapToFloorBelow,
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
 * @returns Normalized plan document
 */
export function normalizePlanDocument(value: unknown): PlanDocument {
  const base = emptyPlanDocument();
  if (!value || typeof value !== "object") return base;
  const valueRecord = value as Record<string, unknown>;
  const floors = normalizeFloors(valueRecord.floors);
  let objects = Array.isArray(valueRecord.objects)
    ? (valueRecord.objects as unknown[])
        .map(normalizePlanObject)
        .filter((object): object is PlanObject => object != null)
    : [];
  objects = ensureObjectStructure(objects, floors);
  const maxFloorN = floors.reduce((max, floor) => {
    const numberPart = Number(String(floor.id).replace(/^floor-/, ""));
    return Number.isFinite(numberPart) ? Math.max(max, numberPart) : max;
  }, 0);

  return {
    objects,
    groups: Array.isArray(valueRecord.groups)
      ? (valueRecord.groups as Group[])
      : [],
    groupSeq:
      typeof valueRecord.groupSeq === "number" &&
      Number.isFinite(valueRecord.groupSeq)
        ? valueRecord.groupSeq
        : 1,
    floors,
    floorSeq: Math.max(
      typeof valueRecord.floorSeq === "number" ? valueRecord.floorSeq : 0,
      maxFloorN,
      floors.length
    ),
    snapToFloorBelow: !!valueRecord.snapToFloorBelow,
    labelOffsets:
      valueRecord.labelOffsets &&
      typeof valueRecord.labelOffsets === "object" &&
      !Array.isArray(valueRecord.labelOffsets)
        ? (valueRecord.labelOffsets as LabelOffsetsMap)
        : {},
    showDimensionsGlobal:
      valueRecord.showDimensionsGlobal === undefined
        ? false
        : !!valueRecord.showDimensionsGlobal,
    zoom: typeof valueRecord.zoom === "number" ? valueRecord.zoom : undefined,
    panX: typeof valueRecord.panX === "number" ? valueRecord.panX : undefined,
    panY: typeof valueRecord.panY === "number" ? valueRecord.panY : undefined,
  };
}

/**
 * Build a downloadable export payload from name + document.
 * @param name - Project / plan name
 * @param doc - Plan document
 * @returns Export payload
 */
export function planDocumentToExport(name: string, doc: PlanDocument): PlanExport {
  const labelOffsets = doc.labelOffsets || {};
  return {
    name: name || "floor-plan",
    exportedAt: new Date().toISOString(),
    groups: doc.groups,
    floors: doc.floors,
    snapToFloorBelow: doc.snapToFloorBelow,
    objects: doc.objects.map((object) => {
      const offsets = labelOffsets[object.id] || {
        w: { x: 0, y: 0 },
        h: { x: 0, y: 0 },
        n: { x: 0, y: 0 },
      };
      return {
        ...object,
        dimOffW: { ...offsets.w },
        dimOffH: { ...offsets.h },
        dimOffN: { ...(offsets.n || { x: 0, y: 0 }) },
      };
    }),
    labelOffsets: cloneJson(labelOffsets),
  };
}
