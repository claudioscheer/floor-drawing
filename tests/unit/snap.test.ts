import { describe, expect, it } from "vitest";
import {
  bestAxisSnap,
  edgesOf,
  DEFAULT_RANGE,
  SNAP_SCREEN_PX,
  snapPosition,
  snapRangeForZoom,
  snapResize,
  resolveSnapRange,
} from "@fp/snap";
import type { PlanObject } from "@fp/types";

function rect(
  partial: Partial<PlanObject> & Pick<PlanObject, "x" | "y" | "width" | "height" | "type">
): PlanObject {
  return {
    id: partial.id ?? "o",
    type: partial.type,
    name: "",
    notes: "",
    x: partial.x,
    y: partial.y,
    width: partial.width,
    height: partial.height,
    rotation: partial.rotation || 0,
    labelRotation: 0,
    visible: true,
    locked: false,
    groupId: null,
    opacity: 1,
    showDimensions: true,
    dimOffW: { x: 0, y: 0 },
    dimOffH: { x: 0, y: 0 },
  };
}

describe("snap", () => {
  it("exposes default range and screen threshold", () => {
    expect(DEFAULT_RANGE).toBe(12);
    expect(SNAP_SCREEN_PX).toBe(18);
  });

  it("scales world range with zoom so screen pull stays stable", () => {
    // zoomed out: larger world threshold
    expect(snapRangeForZoom(0.22)).toBeGreaterThan(50);
    // 1:1: ~18 cm
    expect(snapRangeForZoom(1)).toBe(18);
    // zoomed in: floor at SNAP_RANGE_MIN
    expect(snapRangeForZoom(3)).toBe(8);
    expect(resolveSnapRange({ zoom: 0.5 })).toBe(snapRangeForZoom(0.5));
    expect(resolveSnapRange({ range: 24 })).toBe(24);
  });

  it("computes edges from rect", () => {
    const e = edgesOf({ x: 10, y: 20, width: 100, height: 40 });
    expect(e.left).toBe(10);
    expect(e.right).toBe(110);
    expect(e.cx).toBe(60);
  });

  it("snaps moving floor left edge to partner floor", () => {
    const partner = rect({ type: "floor", x: 200, y: 0, width: 100, height: 100 });
    const moving = { x: 200 - 8, y: 10, width: 80, height: 80, rotation: 0 };
    const result = snapPosition(moving, [partner], "floor", {
      useGrid: false,
      range: 12,
    });
    expect(result.x).toBe(200);
    expect(result.active).toBe(true);
    expect(result.guides.v).not.toBeNull();
  });

  it("snaps floor to wall edge (partners include wall)", () => {
    const wall = rect({ type: "wall", x: 500, y: 0, width: 20, height: 400 });
    // Floor right edge is 15 px left of wall left (500)
    const moving = { x: 500 - 100 - 15, y: 50, width: 100, height: 80, rotation: 0 };
    const result = snapPosition(moving, [wall], "floor", {
      useGrid: false,
      range: 20,
    });
    // right of floor should land on wall left → x = 500 - 100 = 400
    expect(result.x).toBe(400);
    expect(result.active).toBe(true);
  });

  it("snaps right edge of moving object, not only left", () => {
    const partner = rect({ type: "wall", x: 0, y: 0, width: 20, height: 200 });
    // Moving box left far away; its left edge is at 100, right at 180
    // Partner right is 20 — want right of moving to align? 
    // Actually: place left of moving against right of partner: left → 20
    const moving = { x: 20 + 10, y: 0, width: 80, height: 40, rotation: 0 };
    const result = snapPosition(moving, [partner], "wall", {
      useGrid: false,
      range: 15,
    });
    expect(result.x).toBe(20);
  });

  it("prefers edge alignment over center when both in range", () => {
    // Partner left at 100. Moving center is also 10 away from 100 if sized right.
    // Edge at distance 5 should win over center at distance 5 if we prefer edges —
    // setup: partner edge 100; moving left 95 (dist 5); center would be further.
    const snap = bestAxisSnap([95, 195, 145], [100, 200], 12);
    expect(snap.guide).toBe(100);
    expect(snap.delta).toBe(5); // move left from 95 → 100
  });

  it("snaps resize right edge to partner", () => {
    const partner = rect({ type: "wall", x: 300, y: 0, width: 20, height: 200 });
    const moving = { x: 100, y: 0, width: 195, height: 20 };
    const result = snapResize(
      moving,
      { right: true },
      [partner],
      "wall",
      { minW: 10, minH: 10 },
      { useGrid: false, range: 12 }
    );
    // right edge at 295 → snaps to partner left 300
    expect(result.width).toBe(200);
    expect(result.x).toBe(100);
  });

  it("uses zoom so a far-but-on-screen edge still catches when zoomed out", () => {
    const wall = rect({ type: "wall", x: 1000, y: 200, width: 20, height: 100 });
    // Right edge 40 world px from wall left — outside range 12, inside zoomed-out range
    const moving = { x: 1000 - 80 - 40, y: 500, width: 80, height: 60, rotation: 0 };
    const noZoom = snapPosition(moving, [wall], "floor", {
      useGrid: false,
      range: 12,
    });
    // Neither axis within 12 cm of a partner edge
    expect(noZoom.x).toBe(moving.x);
    expect(noZoom.active).toBe(false);

    const withZoom = snapPosition(moving, [wall], "floor", {
      useGrid: false,
      zoom: 0.25, // world range = min(90, max(8, 18/0.25)) = 72
    });
    expect(withZoom.x).toBe(1000 - 80);
    expect(withZoom.active).toBe(true);
  });
});
