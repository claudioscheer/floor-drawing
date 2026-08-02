/**
 * Geometry helpers: rotation, opacity, AABB.
 * DOM-free; operates on plan rectangles in world pixels.
 */

import type { Point, Rect, TransformedRect } from "@fp/types";

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
