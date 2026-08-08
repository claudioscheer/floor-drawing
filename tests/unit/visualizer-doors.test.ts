import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createObject } from "@fp/catalog";
import { buildSceneFromPlan } from "../../src/visualizer/build-scene";

function doorLeaf(objects: Parameters<typeof buildSceneFromPlan>[0]): THREE.Mesh {
  const root = buildSceneFromPlan(objects).root;
  let leaf: THREE.Mesh | null = null;
  root.traverse((node) => {
    if (node.name === "door-leaf" && node instanceof THREE.Mesh) leaf = node;
  });
  if (!leaf) throw new Error("Expected a 3D door leaf");
  return leaf;
}

describe("3D door leaves", () => {
  it("opens a door on a vertical wall perpendicular to that wall", () => {
    const wall = createObject("wall", {
      x: 500,
      y: 0,
      width: 20,
      height: 600,
    });
    const door = createObject("door", {
      x: 500,
      y: 200,
      width: 20,
      height: 90,
      hinge: "end",
      opens: "neg",
    });

    const leaf = doorLeaf([wall, door]);
    const geometry = leaf.geometry as THREE.BoxGeometry;

    expect(geometry.parameters.width).toBeCloseTo(0.86);
    expect(geometry.parameters.depth).toBeCloseTo(0.04);
    expect(leaf.position.x).toBeCloseTo(4.57);
    expect(leaf.position.z).toBeCloseTo(2.88);
  });

  it("opens a door on a horizontal wall perpendicular to that wall", () => {
    const wall = createObject("wall", {
      x: 0,
      y: 500,
      width: 600,
      height: 20,
    });
    const door = createObject("door", {
      x: 200,
      y: 500,
      width: 90,
      height: 20,
      hinge: "start",
      opens: "pos",
    });

    const leaf = doorLeaf([wall, door]);
    const geometry = leaf.geometry as THREE.BoxGeometry;

    expect(geometry.parameters.width).toBeCloseTo(0.04);
    expect(geometry.parameters.depth).toBeCloseTo(0.86);
    expect(leaf.position.x).toBeCloseTo(2.02);
    expect(leaf.position.z).toBeCloseTo(5.43);
  });
});
