/**
 * Edge-aware snapping for floor-plan objects.
 * Works in world coordinates (independent of zoom/pan).
 */

import type {
  MinSize,
  ObjectType,
  PlanObject,
  Rect,
  ResizeEdges,
  SnapOptions,
  SnapPositionResult,
  SnapResizeResult,
  TransformedRect,
} from "@fp/types";
import { SNAP_PARTNERS } from "@fp/catalog";
import { worldAABB } from "@fp/geometry";
import { GRID, snapToGrid } from "@fp/units";

/** Default snap range in world pixels (12 cm). */
export const DEFAULT_RANGE = 12;

export interface EdgeSet {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

/**
 * Build edge lists for an object (rotated → world AABB).
 * @param r - Object rect (may include rotation)
 */
export function edgesOf(r: TransformedRect): EdgeSet {
  const box = worldAABB(r);
  return {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
  };
}

/**
 * Collect snap candidate edges from partner objects based on type rules.
 * @param others - Partner objects
 * @param movingType - Type of the object being moved/resized
 * @param partnersMap - Type → allowed partner types
 */
export function collectEdges(
  others: ReadonlyArray<Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">>,
  movingType: string,
  partnersMap: Readonly<Record<string, readonly string[]>>
): { xs: number[]; ys: number[] } {
  const allowed = new Set(partnersMap[movingType] || []);
  const xs: number[] = [];
  const ys: number[] = [];

  for (const o of others) {
    if (!allowed.has(o.type)) continue;
    const e = edgesOf(o);
    xs.push(e.left, e.right, e.cx);
    ys.push(e.top, e.bottom, e.cy);
  }

  return { xs, ys };
}

/**
 * Snap a single value to the nearest candidate within range.
 * @returns Snapped value, guide position, and distance
 */
export function snapValue(
  value: number,
  candidates: readonly number[],
  range: number
): { value: number; guide: number | null; dist: number } {
  let best: number | null = null;
  let bestDist = range + 1;

  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  if (best === null) {
    return { value, guide: null, dist: Infinity };
  }
  return { value: best, guide: best, dist: bestDist };
}

/**
 * Extra snap targets: doors/windows center onto wall thickness.
 * @param others - Partner objects
 * @param movingType - Type being moved
 */
export function collectMountTargets(
  others: ReadonlyArray<Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">>,
  movingType: string
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  if (movingType !== "door" && movingType !== "window") {
    return { xs, ys };
  }
  for (const o of others) {
    if (o.type !== "wall") continue;
    const e = edgesOf(o);
    xs.push(e.cx);
    ys.push(e.cy);
    xs.push(e.left, e.right);
    ys.push(e.top, e.bottom);
  }
  return { xs, ys };
}

function closestEdge(a: number, b: number, c: number, candidates: readonly number[]): number {
  let best = a;
  let bestDist = Infinity;
  for (const val of [a, b, c]) {
    for (const cand of candidates) {
      const d = Math.abs(val - cand);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
      }
    }
  }
  return bestDist <= DEFAULT_RANGE * 2 ? best : a;
}

/**
 * Snap position (top-left of local box) so the visual AABB edges/center align.
 * Rotation is around the object center; x/y are the unrotated top-left.
 * @param rect - Moving rect
 * @param others - Other objects for edge candidates
 * @param type - Moving object type
 * @param options - Range, partners, grid
 */
export function snapPosition(
  rect: TransformedRect,
  others: ReadonlyArray<Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">>,
  type: ObjectType | string,
  options: SnapOptions = {}
): SnapPositionResult {
  const range = options.range ?? DEFAULT_RANGE;
  const partnersMap = options.partnersMap || SNAP_PARTNERS;
  const grid = options.grid ?? GRID;
  const useGrid = options.useGrid !== false;

  const { xs, ys } = collectEdges(others, type, partnersMap);
  const mount = collectMountTargets(others, type);
  xs.push(...mount.xs);
  ys.push(...mount.ys);

  const box = edgesOf(rect);
  const boxW = box.right - box.left;
  const boxH = box.bottom - box.top;

  const xCandidates: number[] = [];
  for (const edge of xs) {
    xCandidates.push(edge);
    xCandidates.push(edge - boxW);
    xCandidates.push(edge - boxW / 2);
  }

  const yCandidates: number[] = [];
  for (const edge of ys) {
    yCandidates.push(edge);
    yCandidates.push(edge - boxH);
    yCandidates.push(edge - boxH / 2);
  }

  let boxX = box.left;
  let boxY = box.top;
  let guideV: number | null = null;
  let guideH: number | null = null;

  const sx = snapValue(boxX, xCandidates, range);
  if (sx.guide !== null) {
    boxX = sx.value;
    guideV = closestEdge(boxX, boxX + boxW, boxX + boxW / 2, xs);
  } else if (useGrid) {
    boxX = snapToGrid(boxX, grid);
  }

  const sy = snapValue(boxY, yCandidates, range);
  if (sy.guide !== null) {
    boxY = sy.value;
    guideH = closestEdge(boxY, boxY + boxH, boxY + boxH / 2, ys);
  } else if (useGrid) {
    boxY = snapToGrid(boxY, grid);
  }

  const scx = boxX + boxW / 2;
  const scy = boxY + boxH / 2;
  const x = scx - rect.width / 2;
  const y = scy - rect.height / 2;

  return {
    x,
    y,
    guides: { v: guideV, h: guideH },
    active: guideV !== null || guideH !== null,
  };
}

/**
 * Snap resize: keep opposite edge fixed, snap the moving edges.
 * @param rect - Current rect
 * @param edges - Which edges are being dragged
 * @param others - Partner objects
 * @param type - Object type
 * @param mins - Minimum size
 * @param options - Snap options
 */
export function snapResize(
  rect: Rect,
  edges: ResizeEdges,
  others: ReadonlyArray<Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">>,
  type: ObjectType | string,
  mins: MinSize,
  options: SnapOptions = {}
): SnapResizeResult {
  const range = options.range ?? DEFAULT_RANGE;
  const partnersMap = options.partnersMap || SNAP_PARTNERS;
  const grid = options.grid ?? GRID;
  const useGrid = options.useGrid !== false;

  const { xs, ys } = collectEdges(others, type, partnersMap);

  let { x, y, width, height } = rect;
  let guideV: number | null = null;
  let guideH: number | null = null;

  if (edges.left) {
    const right = x + width;
    let left = x;
    const s = snapValue(left, xs, range);
    if (s.guide !== null) {
      left = s.value;
      guideV = s.guide;
    } else if (useGrid) {
      left = snapToGrid(left, grid);
    }
    const newW = right - left;
    if (newW >= mins.minW) {
      width = newW;
      x = left;
    }
  }

  if (edges.right) {
    let right = x + width;
    const s = snapValue(right, xs, range);
    if (s.guide !== null) {
      right = s.value;
      guideV = s.guide;
    } else if (useGrid) {
      right = snapToGrid(right, grid);
    }
    const newW = right - x;
    if (newW >= mins.minW) {
      width = newW;
    }
  }

  if (edges.top) {
    const bottom = y + height;
    let top = y;
    const s = snapValue(top, ys, range);
    if (s.guide !== null) {
      top = s.value;
      guideH = s.guide;
    } else if (useGrid) {
      top = snapToGrid(top, grid);
    }
    const newH = bottom - top;
    if (newH >= mins.minH) {
      height = newH;
      y = top;
    }
  }

  if (edges.bottom) {
    let bottom = y + height;
    const s = snapValue(bottom, ys, range);
    if (s.guide !== null) {
      bottom = s.value;
      guideH = s.guide;
    } else if (useGrid) {
      bottom = snapToGrid(bottom, grid);
    }
    const newH = bottom - y;
    if (newH >= mins.minH) {
      height = newH;
    }
  }

  return {
    x,
    y,
    width,
    height,
    guides: { v: guideV, h: guideH },
    active: guideV !== null || guideH !== null,
  };
}
