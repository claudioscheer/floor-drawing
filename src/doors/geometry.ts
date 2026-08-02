/**
 * AutoCAD-style 2D door geometry in world coordinates.
 *
 * Hinge sits on the wall face toward the swing (not mid-thickness).
 * Leaf is drawn OPEN at 90°; arc is the quarter-circle from closed free
 * end to the open free end.
 */

import type { DoorGeometry, DoorHinge, DoorOpens, PlanObject, Point } from "@fp/types";
import { normalizeRotation, objectCenter, rotatePoint } from "@fp/geometry";

/**
 * Compute door swing geometry for rendering.
 * @param obj - Door plan object (width/height, hinge, opens, rotation)
 * @returns World-space hinge, arc ends, and SVG bounding box
 */
export function doorGeometry(obj: PlanObject): DoorGeometry {
  const w = obj.width;
  const h = obj.height;
  const horizontal = w >= h;
  const R = horizontal ? w : h;
  const hinge: DoorHinge = obj.hinge === "end" ? "end" : "start";
  const opens: DoorOpens = obj.opens === "pos" ? "pos" : "neg";
  const rot = normalizeRotation(obj.rotation);
  const rotRad = (rot * Math.PI) / 180;

  let lx: number;
  let ly: number;
  let aClosed: number;
  let aOpen: number;

  if (horizontal) {
    lx = hinge === "start" ? 0 : w;
    ly = opens === "neg" ? 0 : h;
    aClosed = hinge === "start" ? 0 : Math.PI;
    aOpen = opens === "neg" ? -Math.PI / 2 : Math.PI / 2;
  } else {
    ly = hinge === "start" ? 0 : h;
    lx = opens === "neg" ? 0 : w;
    aClosed = hinge === "start" ? Math.PI / 2 : -Math.PI / 2;
    aOpen = opens === "neg" ? Math.PI : 0;
  }

  let hx = obj.x + lx;
  let hy = obj.y + ly;
  if (rot) {
    const c = objectCenter(obj);
    const hp = rotatePoint(hx, hy, c.x, c.y, rot);
    hx = hp.x;
    hy = hp.y;
    aClosed += rotRad;
    aOpen += rotRad;
  }

  const closedEnd: Point = {
    x: hx + R * Math.cos(aClosed),
    y: hy + R * Math.sin(aClosed),
  };
  const openEnd: Point = {
    x: hx + R * Math.cos(aOpen),
    y: hy + R * Math.sin(aOpen),
  };

  let angleDelta = aOpen - aClosed;
  while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
  while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

  const pad = 3;
  const minX = Math.min(hx, closedEnd.x, openEnd.x) - pad;
  const minY = Math.min(hy, closedEnd.y, openEnd.y) - pad;
  const maxX = Math.max(hx, closedEnd.x, openEnd.x) + pad;
  const maxY = Math.max(hy, closedEnd.y, openEnd.y) + pad;

  return {
    horizontal,
    R,
    hx,
    hy,
    hinge,
    opens,
    rotation: rot,
    aClosed,
    aOpen,
    angleDelta,
    start: closedEnd,
    end: openEnd,
    closedEnd,
    openEnd,
    minX,
    minY,
    maxX,
    maxY,
    boxW: maxX - minX,
    boxH: maxY - minY,
  };
}

/** Map a world point into door SVG local coordinates. */
export function toLocal(g: DoorGeometry, p: Point): Point {
  return { x: p.x - g.minX, y: p.y - g.minY };
}
