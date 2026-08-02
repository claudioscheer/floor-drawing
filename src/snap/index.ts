/**
 * Edge-aware snapping for floor-plan objects.
 * Works in world coordinates (independent of zoom/pan for positions);
 * the snap *threshold* is screen-space so it stays easy to catch at any zoom.
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

/**
 * Fallback snap range in world pixels when zoom is unknown (~12 cm).
 * Prefer {@link snapRangeForZoom} so the pull distance tracks the cursor.
 */
export const DEFAULT_RANGE = 12;

/**
 * Magnetic snap distance in **screen** pixels at zoom = 1.
 * Scaled with a mild zoom curve (sqrt) so zoomed-out magnets grow, but not
 * enough to yank objects across half a room.
 */
export const SNAP_SCREEN_PX = 14;

/** Minimum world snap range (cm) when zoomed in hard. */
export const SNAP_RANGE_MIN = 8;

/**
 * Maximum world snap range (cm) when zoomed far out.
 * Kept tight so tiny drags at min zoom cannot jump ~1 m to a distant edge.
 */
export const SNAP_RANGE_MAX = 36;

/**
 * Convert a screen-pixel snap threshold into world units for the current zoom.
 *
 * Uses `screenPx / sqrt(zoom)` instead of `/ zoom` so the pull grows when
 * zoomed out (easier to catch edges) without becoming a room-wide magnet.
 *
 * @param zoom - Canvas zoom (world → screen scale)
 * @param screenPx - Base screen threshold (default {@link SNAP_SCREEN_PX})
 * @returns World-pixel range, clamped to [{@link SNAP_RANGE_MIN}, {@link SNAP_RANGE_MAX}]
 */
export function snapRangeForZoom(
  zoom: number,
  screenPx: number = SNAP_SCREEN_PX
): number {
  const z = Number(zoom);
  const safeZ = Number.isFinite(z) && z > 0.05 ? z : 1;
  // Milder than 1/z: at 0.22 → ~30 cm; at 1 → 14 cm; at 3 → floor to MIN
  const world = screenPx / Math.sqrt(safeZ);
  return Math.min(SNAP_RANGE_MAX, Math.max(SNAP_RANGE_MIN, world));
}

/**
 * Resolve the effective world snap range from options.
 * Explicit `range` wins; otherwise zoom-aware; otherwise {@link DEFAULT_RANGE}.
 * @param options - Snap options
 */
export function resolveSnapRange(options: SnapOptions = {}): number {
  if (options.range != null && Number.isFinite(options.range)) {
    return Math.max(0, Number(options.range));
  }
  if (options.zoom != null && Number.isFinite(options.zoom)) {
    return snapRangeForZoom(options.zoom);
  }
  return DEFAULT_RANGE;
}

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
  others: ReadonlyArray<
    Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">
  >,
  movingType: string,
  partnersMap: Readonly<Record<string, readonly string[]>>
): { xs: number[]; ys: number[] } {
  const allowed = new Set(partnersMap[movingType] || []);
  const xs: number[] = [];
  const ys: number[] = [];

  for (const o of others) {
    if (!allowed.has(o.type)) continue;
    const e = edgesOf(o);
    // Edges only (no center) for partner collection — centers added per-axis
    // when building alignment candidates so edge-to-edge wins more often.
    xs.push(e.left, e.right);
    ys.push(e.top, e.bottom);
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
 * Pick the best axis snap by testing every moving edge against every partner edge.
 * Prefer pure edge alignments over center when distances are within a tiny epsilon.
 *
 * @param movingEdges - [start, end, center] of the moving AABB on this axis
 * @param partnerEdges - Partner edge coordinates (and optional centers)
 * @param range - World snap threshold
 * @returns Delta to apply to the moving start edge, and the guide line position
 */
export function bestAxisSnap(
  movingEdges: readonly [number, number, number],
  partnerEdges: readonly number[],
  range: number
): { delta: number; guide: number | null; dist: number } {
  const [start, end, center] = movingEdges;
  let bestDelta = 0;
  let bestGuide: number | null = null;
  let bestDist = range + 1;
  let bestIsCenter = false;

  for (const partner of partnerEdges) {
    const trials: Array<{ moving: number; isCenter: boolean }> = [
      { moving: start, isCenter: false },
      { moving: end, isCenter: false },
      { moving: center, isCenter: true },
    ];
    for (const t of trials) {
      const d = Math.abs(t.moving - partner);
      if (d > range) continue;
      const delta = partner - t.moving;
      // Closer wins; on a tie, prefer edge alignment over center.
      if (d < bestDist || (d === bestDist && bestIsCenter && !t.isCenter)) {
        bestDist = d;
        bestDelta = delta;
        bestGuide = partner;
        bestIsCenter = t.isCenter;
      }
    }
  }

  if (bestGuide === null) {
    return { delta: 0, guide: null, dist: Infinity };
  }
  return { delta: bestDelta, guide: bestGuide, dist: bestDist };
}

/**
 * Extra snap targets: doors/windows center onto wall thickness + wall ends.
 * @param others - Partner objects
 * @param movingType - Type being moved
 */
export function collectMountTargets(
  others: ReadonlyArray<
    Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">
  >,
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
    // Wall centerline so openings sit in the wall thickness
    xs.push(e.cx);
    ys.push(e.cy);
    xs.push(e.left, e.right);
    ys.push(e.top, e.bottom);
  }
  return { xs, ys };
}

/**
 * Partner centers for mid-alignment (secondary to edges).
 */
function collectCenters(
  others: ReadonlyArray<
    Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">
  >,
  movingType: string,
  partnersMap: Readonly<Record<string, readonly string[]>>
): { xs: number[]; ys: number[] } {
  const allowed = new Set(partnersMap[movingType] || []);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const o of others) {
    if (!allowed.has(o.type)) continue;
    const e = edgesOf(o);
    xs.push(e.cx);
    ys.push(e.cy);
  }
  return { xs, ys };
}

/**
 * Snap position (top-left of local box) so the visual AABB edges/center align.
 * Rotation is around the object center; x/y are the unrotated top-left.
 * @param rect - Moving rect
 * @param others - Other objects for edge candidates
 * @param type - Moving object type
 * @param options - Range, zoom, partners, grid
 */
export function snapPosition(
  rect: TransformedRect,
  others: ReadonlyArray<
    Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">
  >,
  type: ObjectType | string,
  options: SnapOptions = {}
): SnapPositionResult {
  const range = resolveSnapRange(options);
  const partnersMap = options.partnersMap || SNAP_PARTNERS;
  const grid = options.grid ?? GRID;
  const useGrid = options.useGrid !== false;

  const { xs: edgeXs, ys: edgeYs } = collectEdges(others, type, partnersMap);
  const mount = collectMountTargets(others, type);
  const centers = collectCenters(others, type, partnersMap);

  // Edges first in the list so equal-distance ties favor edges in scan order;
  // bestAxisSnap also prefers non-center alignments explicitly.
  const xs = [...edgeXs, ...mount.xs, ...centers.xs];
  const ys = [...edgeYs, ...mount.ys, ...centers.ys];

  const box = edgesOf(rect);
  const boxW = box.right - box.left;
  const boxH = box.bottom - box.top;

  let boxX = box.left;
  let boxY = box.top;
  let guideV: number | null = null;
  let guideH: number | null = null;

  const sx = bestAxisSnap([box.left, box.right, box.cx], xs, range);
  if (sx.guide !== null) {
    boxX = box.left + sx.delta;
    guideV = sx.guide;
  } else if (useGrid) {
    boxX = snapToGrid(boxX, grid);
  }

  const sy = bestAxisSnap([box.top, box.bottom, box.cy], ys, range);
  if (sy.guide !== null) {
    boxY = box.top + sy.delta;
    guideH = sy.guide;
  } else if (useGrid) {
    boxY = snapToGrid(boxY, grid);
  }

  // Preserve local size; shift so AABB center matches snapped AABB center.
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
  others: ReadonlyArray<
    Pick<PlanObject, "type" | "x" | "y" | "width" | "height" | "rotation">
  >,
  type: ObjectType | string,
  mins: MinSize,
  options: SnapOptions = {}
): SnapResizeResult {
  const range = resolveSnapRange(options);
  const partnersMap = options.partnersMap || SNAP_PARTNERS;
  const grid = options.grid ?? GRID;
  const useGrid = options.useGrid !== false;

  const { xs: edgeXs, ys: edgeYs } = collectEdges(others, type, partnersMap);
  const centers = collectCenters(others, type, partnersMap);
  const xs = [...edgeXs, ...centers.xs];
  const ys = [...edgeYs, ...centers.ys];

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
