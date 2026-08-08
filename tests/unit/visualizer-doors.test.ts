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

    expect(geometry.parameters.width).toBeCloseTo(0.04);
    expect(geometry.parameters.depth).toBeCloseTo(0.86);
    expect(leaf.position.x).toBeCloseTo(4.57);
    expect(leaf.position.z).toBeCloseTo(2.9);
    expect(leaf.rotation.y).toBeCloseTo(-Math.PI / 2);
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
    expect(leaf.position.x).toBeCloseTo(2);
    expect(leaf.position.z).toBeCloseTo(5.43);
    expect(leaf.rotation.y).toBeCloseTo(0);
  });

  it("preserves the open side when a horizontal door is rotated onto a vertical wall", () => {
    const wall = createObject("wall", {
      x: 525,
      y: 0,
      width: 20,
      height: 600,
    });
    const door = createObject("door", {
      x: 490,
      y: 200,
      width: 90,
      height: 20,
      rotation: 90,
      hinge: "end",
      opens: "neg",
    });

    const leaf = doorLeaf([wall, door]);

    // A 90° clockwise rotation turns the 2D "Up" setting into world-right.
    expect(leaf.position.x).toBeCloseTo(5.68);
    expect(leaf.position.z).toBeCloseTo(2.55);
    expect(leaf.rotation.y).toBeCloseTo(Math.PI / 2);
  });
});
