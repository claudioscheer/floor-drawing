import { describe, expect, it } from "vitest";
import {
  circleHitsAabb,
  collidesAny,
  moveWithSlide,
  type SolidAABB,
} from "../../src/visualizer/collision";

const wall: SolidAABB = { minX: 0, maxX: 2, minZ: 0, maxZ: 0.2 };

describe("circleHitsAabb", () => {
  it("detects overlap", () => {
    expect(circleHitsAabb(1, 0.1, 0.2, wall)).toBe(true);
  });

  it("misses when clear", () => {
    expect(circleHitsAabb(1, 1, 0.2, wall)).toBe(false);
  });
});

describe("moveWithSlide", () => {
  it("blocks into wall but allows slide along it", () => {
    // Approach wall from +Z side
    const blocked = moveWithSlide(1, 0.5, 0, -0.4, 0.2, [wall]);
    expect(blocked.z).toBe(0.5);

    // Slide along X while pressed against wall zone
    const slide = moveWithSlide(1, 0.5, 0.3, 0, 0.2, [wall]);
    expect(slide.x).toBeCloseTo(1.3);
    expect(slide.z).toBe(0.5);
  });

  it("allows free movement with no solids", () => {
    const p = moveWithSlide(0, 0, 1, 1, 0.2, []);
    expect(p).toEqual({ x: 1, z: 1 });
  });
});

describe("collidesAny", () => {
  it("returns false for empty list", () => {
    expect(collidesAny(0, 0, 0.2, [])).toBe(false);
  });
});
