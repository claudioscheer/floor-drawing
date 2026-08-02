/**
 * World scale and length/area formatting.
 *
 * Scale contract:
 * - 1 world pixel = 1 centimeter
 * - 100 world pixels = 1 meter
 */

import type { DisplayUnit } from "@fp/types";

/** World pixels per meter. */
export const PX_PER_METER = 100;

/** World pixels per centimeter (identity under the scale contract). */
export const PX_PER_CM = 1;

/** Default display unit for labels and property fields. */
export const DISPLAY_UNIT: DisplayUnit = "m";

/** Default snap grid step in world pixels (5 cm). */
export const GRID = 5;

/**
 * Convert meters to world pixels.
 * @param meters - Length in meters
 * @returns World pixels (rounded)
 */
export function m(meters: number): number {
  return Math.round(Number(meters) * PX_PER_METER);
}

/**
 * Convert centimeters to world pixels.
 * @param centimeters - Length in centimeters
 * @returns World pixels (rounded)
 */
export function cm(centimeters: number): number {
  return Math.round(Number(centimeters) * PX_PER_CM);
}

/**
 * Convert world pixels to a display unit value.
 * @param px - Length in world pixels
 * @param unit - Target unit (default meters)
 */
export function pxToUnit(px: number, unit: DisplayUnit = DISPLAY_UNIT): number {
  const n = Number(px) || 0;
  if (unit === "cm") return n / PX_PER_CM;
  return n / PX_PER_METER;
}

/**
 * Convert a display unit value to world pixels.
 * @param value - Length in the given unit
 * @param unit - Source unit (default meters)
 * @returns World pixels
 */
export function unitToPx(value: number, unit: DisplayUnit = DISPLAY_UNIT): number {
  const n = Number(value) || 0;
  if (unit === "cm") return n * PX_PER_CM;
  return n * PX_PER_METER;
}

/**
 * Format a world-pixel length for UI labels.
 * Meters: two decimals + " m". Centimeters: integer + " cm".
 * @param px - Length in world pixels
 * @param unit - Display unit
 */
export function formatLength(px: number, unit: DisplayUnit = DISPLAY_UNIT): string {
  if (unit === "cm") {
    return Math.round(pxToUnit(px, "cm")) + " cm";
  }
  return pxToUnit(px, "m").toFixed(2) + " m";
}

/**
 * Format an area from pixel² to m² (two decimals).
 * @param px2 - Area in world pixel²
 */
export function formatArea(px2: number): string {
  const m2 = (Number(px2) || 0) / (PX_PER_METER * PX_PER_METER);
  return m2.toFixed(2) + " m²";
}

/**
 * Snap a scalar to the nearest grid step.
 * @param value - World-pixel value
 * @param grid - Grid step (default {@link GRID})
 */
export function snapToGrid(value: number, grid: number = GRID): number {
  return Math.round(value / grid) * grid;
}

/**
 * Clamp a number into [min, max].
 * @param n - Input
 * @param min - Inclusive lower bound
 * @param max - Inclusive upper bound
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
