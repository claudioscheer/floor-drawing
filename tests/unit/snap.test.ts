import { describe, expect, it } from "vitest";
import { snapPosition, snapResize, edgesOf, DEFAULT_RANGE } from "@fp/snap";
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
    rotation: partial.rotation ?? 0,
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
  it("exposes default range", () => {
    expect(DEFAULT_RANGE).toBe(12);
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
});
