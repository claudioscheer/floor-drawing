/**
 * Geometry helpers: rotation, opacity, AABB.
 * DOM-free; operates on plan rectangles in world pixels.
 */

import type {
  MinSize,
  Point,
  Rect,
  ResizeEdges,
  ResizeHandle,
  TransformedRect,
} from "@fp/types";

/**
 * Normalize rotation to [0, 360).
 * @param deg - Degrees (any number or non-finite)
 * @returns Degrees in [0, 360)
 */
export function normalizeRotation(deg: unknown): number {
  let r = Number(deg);
  if (!Number.isFinite(r)) r = 0;
  r = ((r % 360) + 360) % 360;
  if (r > 359.999) r = 0;
  return r;
}

/**
 * Clamp opacity to [0, 1]. Values greater than 1 are treated as percent (50 → 0.5).
 * @param value - Opacity as 0–1 or 0–100 percent
 * @returns Opacity in [0, 1], rounded to 3 decimals
 */
export function clampOpacity(value: unknown): number {
  let n = Number(value);
  if (!Number.isFinite(n)) return 1;
  if (n > 1) n = n / 100;
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return Math.round(n * 1000) / 1000;
}

/**
 * Rotate point (x, y) around (cx, cy) by degrees.
 * Screen y-down, clockwise positive (matches CSS rotate).
 * @returns Rotated point
 */
export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deg: number
): Point {
  const r = (Number(deg) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/**
 * Center of an unrotated object box.
 * @param obj - Object with x, y, width, height
 */
export function objectCenter(obj: Rect): Point {
  return {
    x: (Number(obj.x) || 0) + (Number(obj.width) || 0) / 2,
    y: (Number(obj.y) || 0) + (Number(obj.height) || 0) / 2,
  };
}

/**
 * Axis-aligned bounding box of a (possibly rotated) object in world space.
 * Local x/y/width/height describe the unrotated box; rotation is around center.
 * @param obj - Transformed rect
 * @returns World AABB
 */
export function worldAABB(obj: TransformedRect): Rect {
  const x = Number(obj.x) || 0;
  const y = Number(obj.y) || 0;
  const w = Number(obj.width) || 0;
  const h = Number(obj.height) || 0;
  const rot = normalizeRotation(obj.rotation);
  if (!rot) {
    return { x, y, width: w, height: h };
  }
  const c = objectCenter({ x, y, width: w, height: h });
  const corners = [
    rotatePoint(x, y, c.x, c.y, rot),
    rotatePoint(x + w, y, c.x, c.y, rot),
    rotatePoint(x + w, y + h, c.x, c.y, rot),
    rotatePoint(x, y + h, c.x, c.y, rot),
  ];
  let minX = corners[0]!.x;
  let maxX = corners[0]!.x;
  let minY = corners[0]!.y;
  let maxY = corners[0]!.y;
  for (let i = 1; i < 4; i++) {
    const p = corners[i]!;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Resize a rectangle from a pointer movement in world coordinates.
 *
 * The pointer movement is projected onto the object's rotated local axes. This
 * means that, for example, dragging the visual east handle of a 90° object
 * changes its width as the pointer moves down the screen. The opposite local
 * edge (or corner) remains fixed in world space.
 *
 * @param rect - Current unrotated local box in world px
 * @param worldDelta - Pointer movement since the previous event, in world px
 * @param edges - Active local resize edges
 * @param rotation - Clockwise CSS rotation in degrees
 * @param mins - Minimum width and height in world px
 * @returns Resized local box in world px
 */
export function resizeRotatedRect(
  rect: Rect,
  worldDelta: Point,
  edges: ResizeEdges,
  rotation: number,
  mins: MinSize
): Rect {
  const degrees = normalizeRotation(rotation);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // Unit vectors of the object's local width and height axes in world space.
  const widthAxis = { x: cos, y: sin };
  const heightAxis = { x: -sin, y: cos };
  const widthMotion = worldDelta.x * widthAxis.x + worldDelta.y * widthAxis.y;
  const heightMotion =
    worldDelta.x * heightAxis.x + worldDelta.y * heightAxis.y;

  let width = rect.width;
  let height = rect.height;
  if (edges.left) width -= widthMotion;
  if (edges.right) width += widthMotion;
  if (edges.top) height -= heightMotion;
  if (edges.bottom) height += heightMotion;
  width = Math.max(mins.minW, width);
  height = Math.max(mins.minH, height);

  const widthChange = width - rect.width;
  const heightChange = height - rect.height;
  const center = objectCenter(rect);

  // Move the center by half of each actual size change so the edge opposite
  // the handle is invariant after rotation and minimum-size clamping.
  let centerX = center.x;
  let centerY = center.y;
  if (edges.left) {
    centerX -= (widthAxis.x * widthChange) / 2;
    centerY -= (widthAxis.y * widthChange) / 2;
  }
  if (edges.right) {
    centerX += (widthAxis.x * widthChange) / 2;
    centerY += (widthAxis.y * widthChange) / 2;
  }
  if (edges.top) {
    centerX -= (heightAxis.x * heightChange) / 2;
    centerY -= (heightAxis.y * heightChange) / 2;
  }
  if (edges.bottom) {
    centerX += (heightAxis.x * heightChange) / 2;
    centerY += (heightAxis.y * heightChange) / 2;
  }

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

/** CSS resize cursor keywords supported by all target browsers. */
export type ResizeCursor = "ew-resize" | "ns-resize" | "nwse-resize" | "nesw-resize";

/**
 * Select the screen-space cursor for a handle after object rotation.
 *
 * CSS cursor keywords describe screen axes, while handle names describe local
 * object axes. This converts between them and rounds to the nearest supported
 * horizontal, vertical, or diagonal cursor.
 *
 * @param handle - Handle on the unrotated local box
 * @param rotation - Clockwise CSS rotation in degrees
 * @returns Screen-space CSS cursor keyword
 */
export function resizeCursorForHandle(
  handle: ResizeHandle,
  rotation: number
): ResizeCursor {
  const localAngle: Record<ResizeHandle, number> = {
    e: 0,
    se: 45,
    s: 90,
    sw: 135,
    w: 180,
    nw: 225,
    n: 270,
    ne: 315,
  };
  const lineAngle = normalizeRotation(localAngle[handle] + rotation) % 180;

  if (lineAngle < 22.5 || lineAngle >= 157.5) return "ew-resize";
  if (lineAngle < 67.5) return "nwse-resize";
  if (lineAngle < 112.5) return "ns-resize";
  return "nesw-resize";
}
