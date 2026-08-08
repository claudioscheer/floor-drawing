import { describe, expect, it } from "vitest";
import {
  clampOpacity,
  normalizeRotation,
  objectCenter,
  resizeCursorForHandle,
  resizeRotatedRect,
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

  it.each([
    [0, { right: true }, { x: 30, y: 0 }, 130, 40],
    [90, { right: true }, { x: 0, y: 30 }, 130, 40],
    [180, { right: true }, { x: -30, y: 0 }, 130, 40],
    [270, { right: true }, { x: 0, y: -30 }, 130, 40],
    [45, { bottom: true }, { x: -20, y: 20 }, 100, 40 + Math.sqrt(800)],
    [
      45,
      { left: true, top: true },
      { x: -20, y: -10 },
      100 + 15 * Math.sqrt(2),
      40 - 5 * Math.sqrt(2),
    ],
  ] as const)(
    "resizes along local axes at %i°",
    (rotation, edges, delta, expectedWidth, expectedHeight) => {
      const next = resizeRotatedRect(
        { x: 100, y: 200, width: 100, height: 40 },
        delta,
        edges,
        rotation,
        { minW: 20, minH: 20 }
      );
      expect(next.width).toBeCloseTo(expectedWidth, 6);
      expect(next.height).toBeCloseTo(expectedHeight, 6);
    }
  );

  it("keeps the opposite rotated corner fixed for every handle", () => {
    const raw = { x: 100, y: 200, width: 120, height: 60 };
    const rotation = 37;
    const cases = [
      { edges: { left: true }, delta: { x: -20, y: -10 }, anchor: [1, 0] },
      { edges: { right: true }, delta: { x: 20, y: 10 }, anchor: [0, 0] },
      { edges: { top: true }, delta: { x: 10, y: -20 }, anchor: [0, 1] },
      { edges: { bottom: true }, delta: { x: -10, y: 20 }, anchor: [0, 0] },
      { edges: { left: true, top: true }, delta: { x: -15, y: -15 }, anchor: [1, 1] },
      { edges: { right: true, top: true }, delta: { x: 15, y: -15 }, anchor: [0, 1] },
      { edges: { left: true, bottom: true }, delta: { x: -15, y: 15 }, anchor: [1, 0] },
      { edges: { right: true, bottom: true }, delta: { x: 15, y: 15 }, anchor: [0, 0] },
    ] as const;

    for (const { edges, delta, anchor } of cases) {
      const beforeCenter = objectCenter(raw);
      const before = rotatePoint(
        raw.x + raw.width * anchor[0],
        raw.y + raw.height * anchor[1],
        beforeCenter.x,
        beforeCenter.y,
        rotation
      );
      const next = resizeRotatedRect(raw, delta, edges, rotation, {
        minW: 20,
        minH: 20,
      });
      const afterCenter = objectCenter(next);
      const after = rotatePoint(
        next.x + next.width * anchor[0],
        next.y + next.height * anchor[1],
        afterCenter.x,
        afterCenter.y,
        rotation
      );
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });

  it("enforces minimum dimensions without shifting the fixed opposite edge", () => {
    const raw = { x: 50, y: 60, width: 40, height: 30 };
    const rotation = 45;
    const beforeCenter = objectCenter(raw);
    const beforeRight = rotatePoint(90, 60, beforeCenter.x, beforeCenter.y, rotation);
    const next = resizeRotatedRect(
      raw,
      { x: 100, y: 100 },
      { left: true },
      rotation,
      { minW: 30, minH: 20 }
    );
    const afterCenter = objectCenter(next);
    const afterRight = rotatePoint(
      next.x + next.width,
      next.y,
      afterCenter.x,
      afterCenter.y,
      rotation
    );
    expect(next.width).toBe(30);
    expect(next.height).toBe(30);
    expect(afterRight.x).toBeCloseTo(beforeRight.x, 6);
    expect(afterRight.y).toBeCloseTo(beforeRight.y, 6);
  });

  it("uses a screen-space resize cursor after rotation", () => {
    // The top handle of a 90° object is on the screen's right edge, so its
    // cursor must be horizontal (the issue shown in the reported screenshot).
    expect(resizeCursorForHandle("n", 90)).toBe("ew-resize");
    expect(resizeCursorForHandle("e", 90)).toBe("ns-resize");
    expect(resizeCursorForHandle("ne", 90)).toBe("nwse-resize");
    expect(resizeCursorForHandle("sw", 45)).toBe("ew-resize");
    expect(resizeCursorForHandle("se", 45)).toBe("ns-resize");
  });
});
