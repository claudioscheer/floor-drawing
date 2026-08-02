/**
 * Split axis-aligned walls around door / window openings for 3D mesh + collision.
 */

import { normalizeRotation, worldAABB } from "@fp/geometry";
import type { PlanObject, Rect } from "@fp/types";
import { PX_PER_METER } from "@fp/units";
import { OPENING_PAD_M } from "./constants";

/** Solid wall segment in meters (axis-aligned on XZ). */
export interface WallSegmentM {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Full wall height (windows leave sill/header via separate pieces). */
  kind: "full" | "sill" | "header" | "jamb";
  /** For sill/header/jamb: vertical extent in meters. */
  y0?: number;
  y1?: number;
}

/** 1D interval on the wall long axis. */
interface Interval {
  a: number;
  b: number;
}

function pxToM(px: number): number {
  return px / PX_PER_METER;
}

function rectM(r: Rect): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  return {
    minX: pxToM(r.x),
    maxX: pxToM(r.x + r.width),
    minZ: pxToM(r.y),
    maxZ: pxToM(r.y + r.height),
  };
}

/** Nearly axis-aligned (rotation near multiples of 90°). */
function isAxisAligned(obj: PlanObject): boolean {
  const r = normalizeRotation(obj.rotation);
  const near = (a: number) => Math.min(Math.abs(r - a), Math.abs(r - a - 360)) < 3;
  return near(0) || near(90) || near(180) || near(270);
}

/**
 * True when opening significantly overlaps wall footprint.
 */
function overlapsWall(wall: Rect, opening: Rect, padPx: number): boolean {
  return !(
    opening.x + opening.width < wall.x - padPx ||
    opening.x > wall.x + wall.width + padPx ||
    opening.y + opening.height < wall.y - padPx ||
    opening.y > wall.y + wall.height + padPx
  );
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((p, q) => p.a - q.a);
  const out: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.a <= last.b + 1e-6) {
      last.b = Math.max(last.b, cur.b);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function subtractIntervals(span: Interval, cuts: Interval[]): Interval[] {
  const merged = mergeIntervals(cuts);
  const result: Interval[] = [];
  let cursor = span.a;
  for (const c of merged) {
    if (c.b <= span.a || c.a >= span.b) continue;
    const ca = Math.max(c.a, span.a);
    const cb = Math.min(c.b, span.b);
    if (ca > cursor + 1e-4) {
      result.push({ a: cursor, b: ca });
    }
    cursor = Math.max(cursor, cb);
  }
  if (cursor < span.b - 1e-4) {
    result.push({ a: cursor, b: span.b });
  }
  return result;
}

export interface OpeningCut {
  /** Door: full-height gap. Window: mid-height glass band. */
  kind: "door" | "window";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Plan width along long axis of parent wall (for door leaf). */
  openingLengthM: number;
  /** Wall thickness in meters. */
  thicknessM: number;
  /** Horizontal wall (long axis X) vs vertical (long axis Z). */
  horizontal: boolean;
  /** Center of opening. */
  cx: number;
  cz: number;
  name: string;
  hinge?: string;
  opens?: string;
}

/**
 * Build wall solid segments and door/window cut records for one plan.
 * @param objects - All plan objects
 * @param wallHeightM - Full wall height
 * @param doorHeightM - Door clear height
 * @param windowSillM - Window sill height
 * @param windowHeightM - Window opening height
 */
export function buildWallSegments(
  objects: readonly PlanObject[],
  wallHeightM: number,
  doorHeightM: number,
  windowSillM: number,
  windowHeightM: number
): { segments: WallSegmentM[]; openings: OpeningCut[] } {
  const walls = objects.filter((o) => o.type === "wall" && o.visible !== false);
  const doors = objects.filter((o) => o.type === "door" && o.visible !== false);
  const windows = objects.filter((o) => o.type === "window" && o.visible !== false);

  const segments: WallSegmentM[] = [];
  const openings: OpeningCut[] = [];
  const padPx = OPENING_PAD_M * PX_PER_METER;

  for (const wall of walls) {
    const wAABB = worldAABB(wall);
    const wM = rectM(wAABB);
    const wallW = wM.maxX - wM.minX;
    const wallD = wM.maxZ - wM.minZ;
    const horizontal = wallW >= wallD;

    if (!isAxisAligned(wall)) {
      // Rotated wall: solid box, no cutouts (rare in demo).
      segments.push({ ...wM, kind: "full" });
      continue;
    }

    const doorCuts: Interval[] = [];
    const windowCuts: Interval[] = [];

    for (const door of doors) {
      const dAABB = worldAABB(door);
      if (!overlapsWall(wAABB, dAABB, padPx)) continue;
      const dM = rectM(dAABB);
      if (horizontal) {
        doorCuts.push({
          a: Math.max(wM.minX, dM.minX - OPENING_PAD_M),
          b: Math.min(wM.maxX, dM.maxX + OPENING_PAD_M),
        });
        openings.push({
          kind: "door",
          minX: dM.minX,
          maxX: dM.maxX,
          minZ: wM.minZ,
          maxZ: wM.maxZ,
          openingLengthM: dM.maxX - dM.minX,
          thicknessM: wallD,
          horizontal: true,
          cx: (dM.minX + dM.maxX) / 2,
          cz: (wM.minZ + wM.maxZ) / 2,
          name: door.name,
          hinge: door.hinge,
          opens: door.opens,
        });
      } else {
        doorCuts.push({
          a: Math.max(wM.minZ, dM.minZ - OPENING_PAD_M),
          b: Math.min(wM.maxZ, dM.maxZ + OPENING_PAD_M),
        });
        openings.push({
          kind: "door",
          minX: wM.minX,
          maxX: wM.maxX,
          minZ: dM.minZ,
          maxZ: dM.maxZ,
          openingLengthM: dM.maxZ - dM.minZ,
          thicknessM: wallW,
          horizontal: false,
          cx: (wM.minX + wM.maxX) / 2,
          cz: (dM.minZ + dM.maxZ) / 2,
          name: door.name,
          hinge: door.hinge,
          opens: door.opens,
        });
      }
    }

    for (const win of windows) {
      const vAABB = worldAABB(win);
      if (!overlapsWall(wAABB, vAABB, padPx)) continue;
      const vM = rectM(vAABB);
      if (horizontal) {
        windowCuts.push({
          a: Math.max(wM.minX, vM.minX - OPENING_PAD_M),
          b: Math.min(wM.maxX, vM.maxX + OPENING_PAD_M),
        });
        openings.push({
          kind: "window",
          minX: vM.minX,
          maxX: vM.maxX,
          minZ: wM.minZ,
          maxZ: wM.maxZ,
          openingLengthM: vM.maxX - vM.minX,
          thicknessM: wallD,
          horizontal: true,
          cx: (vM.minX + vM.maxX) / 2,
          cz: (wM.minZ + wM.maxZ) / 2,
          name: win.name,
        });
      } else {
        windowCuts.push({
          a: Math.max(wM.minZ, vM.minZ - OPENING_PAD_M),
          b: Math.min(wM.maxZ, vM.maxZ + OPENING_PAD_M),
        });
        openings.push({
          kind: "window",
          minX: wM.minX,
          maxX: wM.maxX,
          minZ: vM.minZ,
          maxZ: vM.maxZ,
          openingLengthM: vM.maxZ - vM.minZ,
          thicknessM: wallW,
          horizontal: false,
          cx: (wM.minX + wM.maxX) / 2,
          cz: (vM.minZ + vM.maxZ) / 2,
          name: win.name,
        });
      }
    }

    // Door gaps are full-height: remove from all wall pieces.
    // Window gaps: sill (0..sill) + header (sill+h..wallH) + solid sides at full height.
    const span: Interval = horizontal
      ? { a: wM.minX, b: wM.maxX }
      : { a: wM.minZ, b: wM.maxZ };

    const doorMerged = mergeIntervals(doorCuts);
    const solidAlong = subtractIntervals(span, doorMerged);

    // Full-height pieces where no door; windows still need vertical split.
    for (const solid of solidAlong) {
      const winInSolid = windowCuts
        .map((c) => ({
          a: Math.max(c.a, solid.a),
          b: Math.min(c.b, solid.b),
        }))
        .filter((c) => c.b - c.a > 0.05);

      if (winInSolid.length === 0) {
        pushFull(segments, horizontal, solid, wM);
        continue;
      }

      const fullBesideWindows = subtractIntervals(solid, winInSolid);
      for (const piece of fullBesideWindows) {
        pushFull(segments, horizontal, piece, wM);
      }

      for (const win of winInSolid) {
        // Sill
        pushBand(segments, horizontal, win, wM, "sill", 0, windowSillM);
        // Header
        const headerY0 = windowSillM + windowHeightM;
        if (headerY0 < wallHeightM - 0.02) {
          pushBand(segments, horizontal, win, wM, "header", headerY0, wallHeightM);
        }
      }
    }

    // Door headers (lintel above opening)
    for (const d of doorMerged) {
      if (d.b - d.a < 0.05) continue;
      if (doorHeightM < wallHeightM - 0.02) {
        pushBand(segments, horizontal, d, wM, "header", doorHeightM, wallHeightM);
      }
    }
  }

  return { segments, openings };
}

function pushFull(
  segments: WallSegmentM[],
  horizontal: boolean,
  span: Interval,
  wM: { minX: number; maxX: number; minZ: number; maxZ: number }
): void {
  if (span.b - span.a < 0.02) return;
  if (horizontal) {
    segments.push({
      minX: span.a,
      maxX: span.b,
      minZ: wM.minZ,
      maxZ: wM.maxZ,
      kind: "full",
    });
  } else {
    segments.push({
      minX: wM.minX,
      maxX: wM.maxX,
      minZ: span.a,
      maxZ: span.b,
      kind: "full",
    });
  }
}

function pushBand(
  segments: WallSegmentM[],
  horizontal: boolean,
  span: Interval,
  wM: { minX: number; maxX: number; minZ: number; maxZ: number },
  kind: "sill" | "header" | "jamb",
  y0: number,
  y1: number
): void {
  if (span.b - span.a < 0.02 || y1 - y0 < 0.02) return;
  if (horizontal) {
    segments.push({
      minX: span.a,
      maxX: span.b,
      minZ: wM.minZ,
      maxZ: wM.maxZ,
      kind,
      y0,
      y1,
    });
  } else {
    segments.push({
      minX: wM.minX,
      maxX: wM.maxX,
      minZ: span.a,
      maxZ: span.b,
      kind,
      y0,
      y1,
    });
  }
}
