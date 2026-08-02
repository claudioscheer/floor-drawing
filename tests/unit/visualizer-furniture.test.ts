import { describe, expect, it } from "vitest";
import {
  classifyFloor,
  furnitureSpecFromName,
} from "../../src/visualizer/furniture";
import type { PlanObject } from "@fp/types";

function floor(name: string): PlanObject {
  return {
    id: "f-1",
    type: "floor",
    name,
    notes: "",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
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

describe("furnitureSpecFromName", () => {
  it("detects sofa", () => {
    const s = furnitureSpecFromName("Sofá");
    expect(s).not.toBeNull();
    expect(s!.style).toBe("sofa");
  });

  it("detects cama as box", () => {
    const s = furnitureSpecFromName("Cama");
    expect(s!.style).toBe("box");
    expect(s!.heightM).toBeLessThan(1);
  });

  it("returns null for room names", () => {
    expect(furnitureSpecFromName("Sala Estar")).toBeNull();
  });
});

describe("classifyFloor", () => {
  it("marks parking bays", () => {
    expect(classifyFloor(floor("Vaga 1 (2,80×5,00)"))).toBe("parking");
  });

  it("marks furniture", () => {
    expect(classifyFloor(floor("Armário"))).toBe("furniture");
  });

  it("marks rooms", () => {
    expect(classifyFloor(floor("Cozinha"))).toBe("room");
  });
});
