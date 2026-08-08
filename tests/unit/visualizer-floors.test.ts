import { describe, expect, it } from "vitest";
import { createObject } from "@fp/catalog";
import type { Floor } from "@fp/types";
import {
  buildSceneFromFloors,
  buildSceneFromPlan,
} from "../../src/visualizer/build-scene";
import {
  FLOOR_THICK_M,
  LAYER_TOP_M,
  STOREY_HEIGHT_M,
  WALL_HEIGHT_M,
} from "../../src/visualizer/constants";

const floors: Floor[] = [
  { id: "floor-2", name: "Floor 1", order: 1 },
  { id: "floor-1", name: "Ground", order: 0 },
];

const objects = [
  createObject("room", {
    id: "ground-room",
    floorId: "floor-1",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  }),
  createObject("room", {
    id: "upper-room",
    floorId: "floor-2",
    x: 1000,
    y: 500,
    width: 500,
    height: 400,
  }),
];

describe("multi-floor 3D scene", () => {
  it("places the next slab directly on the walls below", () => {
    const nextSlabBottom =
      STOREY_HEIGHT_M + LAYER_TOP_M.room - FLOOR_THICK_M;
    expect(nextSlabBottom).toBeCloseTo(WALL_HEIGHT_M);
  });

  it("renders only the active floor in current-floor mode", () => {
    const scene = buildSceneFromFloors(objects, floors, {
      activeFloorId: "floor-2",
      allFloors: false,
    });

    expect(scene.root.name).toBe("plan-root");
    expect(scene.bounds.minX).toBeCloseTo(10);
    expect(scene.bounds.maxX).toBeCloseTo(15);
  });

  it("computes bounds for rotated wall-only plans", () => {
    const wall = createObject("wall", {
      floorId: "floor-1",
      x: 1000,
      y: 0,
      width: 20,
      height: 400,
      rotation: 90,
    });
    const scene = buildSceneFromPlan([wall]);

    expect(scene.bounds.minX).toBeCloseTo(8.1);
    expect(scene.bounds.maxX).toBeCloseTo(12.1);
  });

  it("sorts and vertically stacks every floor in project mode", () => {
    const scene = buildSceneFromFloors(objects, floors, {
      activeFloorId: "floor-2",
      allFloors: true,
    });
    const ground = scene.root.getObjectByName("floor:floor-1");
    const upper = scene.root.getObjectByName("floor:floor-2");

    expect(scene.root.name).toBe("project-root");
    expect(ground?.position.y).toBe(0);
    expect(upper?.position.y).toBe(STOREY_HEIGHT_M);
    expect(scene.bounds.minX).toBeCloseTo(0);
    expect(scene.bounds.maxX).toBeCloseTo(15);
    expect(scene.spawn.y).toBeGreaterThan(STOREY_HEIGHT_M);
    expect(scene.spawn.pitch).toBeLessThan(0);
  });
});
