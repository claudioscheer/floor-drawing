/**
 * SVG path builders for door symbols (Maket-style plan drawing).
 */

import type { DoorHingeRect, PlanObject } from "@fp/types";
import { doorGeometry, toLocal } from "./geometry";

/**
 * Legacy combined path. Prefer {@link doorArcPath} + leaf/sector helpers.
 * @param obj - Door object
 */
export function doorSymbolPath(obj: PlanObject): string {
  return doorArcPath(obj);
}

/**
 * Light-filled swing sector: hinge → closed free end → arc → open free end → hinge.
 * @param obj - Door object
 * @returns SVG path `d` string in door-local coords
 */
export function doorSectorPath(obj: PlanObject): string {
  const g = doorGeometry(obj);
  const h = toLocal(g, { x: g.hx, y: g.hy });
  const c = toLocal(g, g.closedEnd);
  const steps = 32;
  let d = "M " + h.x + " " + h.y + " L " + c.x + " " + c.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = g.aClosed + g.angleDelta * t;
    const wx = g.hx + g.R * Math.cos(a);
    const wy = g.hy + g.R * Math.sin(a);
    d += " L " + (wx - g.minX) + " " + (wy - g.minY);
  }
  d += " Z";
  return d;
}

/**
 * Dashed quarter-circle swing: free end of closed leaf → free end of open leaf.
 * @param obj - Door object
 */
export function doorArcPath(obj: PlanObject): string {
  const g = doorGeometry(obj);
  const steps = 32;
  const c = toLocal(g, g.closedEnd);
  let d = "M " + c.x + " " + c.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = g.aClosed + g.angleDelta * t;
    const wx = g.hx + g.R * Math.cos(a);
    const wy = g.hy + g.R * Math.sin(a);
    d += " L " + (wx - g.minX) + " " + (wy - g.minY);
  }
  return d;
}

/**
 * Solid open leaf at 90°: hinge → open free end.
 * @param obj - Door object
 */
export function doorLeafPath(obj: PlanObject): string {
  const g = doorGeometry(obj);
  const h = toLocal(g, { x: g.hx, y: g.hy });
  const o = toLocal(g, g.openEnd);
  return "M " + h.x + " " + h.y + " L " + o.x + " " + o.y;
}

/**
 * Closed leaf line along the opening: hinge → closed free end.
 * @param obj - Door object
 */
export function doorClosedLeafPath(obj: PlanObject): string {
  const g = doorGeometry(obj);
  const h = toLocal(g, { x: g.hx, y: g.hy });
  const c = toLocal(g, g.closedEnd);
  return "M " + h.x + " " + h.y + " L " + c.x + " " + c.y;
}

/**
 * Small square hinge marker in door-local SVG coords.
 * @param obj - Door object
 */
export function doorHingeRect(obj: PlanObject): DoorHingeRect {
  const g = doorGeometry(obj);
  const h = toLocal(g, { x: g.hx, y: g.hy });
  const s = 3;
  return { x: h.x - s / 2, y: h.y - s / 2, s };
}

/** @deprecated Empty stub kept for API parity. */
export function doorJambPath(): string {
  return "";
}

/** Alias of {@link doorLeafPath}. */
export function doorOpenLeafPath(obj: PlanObject): string {
  return doorLeafPath(obj);
}

/** @deprecated Empty stub kept for API parity. */
export function doorSweepPath(): string {
  return "";
}
