import { describe, expect, it } from "vitest";
import {
  clampOpacity,
  normalizeRotation,
  objectCenter,
  rotatePoint,
  worldAABB,
} from "@fp/geometry";

describe("geometry", () => {
  it("normalizes rotation into [0, 360)", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(NaN)).toBe(0);
  });

  it("clamps opacity and accepts percent values", () => {
    expect(clampOpacity(0.4)).toBe(0.4);
    expect(clampOpacity(40)).toBe(0.4);
    expect(clampOpacity(-1)).toBe(0);
    expect(clampOpacity(undefined)).toBe(1);
  });

  it("computes object center and unrotated AABB", () => {
    const box = { x: 10, y: 20, width: 100, height: 40 };
    expect(objectCenter(box)).toEqual({ x: 60, y: 40 });
    expect(worldAABB(box)).toEqual(box);
  });

  it("expands AABB when rotated 90°", () => {
    const box = { x: 0, y: 0, width: 100, height: 20, rotation: 90 };
    const aabb = worldAABB(box);
    // Center at (50, 10); after 90° CW the AABB is wider in Y
    expect(aabb.width).toBeCloseTo(20, 5);
    expect(aabb.height).toBeCloseTo(100, 5);
  });

  it("rotates points clockwise (CSS y-down)", () => {
    const p = rotatePoint(1, 0, 0, 0, 90);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(1, 5);
  });
});
