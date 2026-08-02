import { describe, expect, it } from "vitest";
import {
  doorArcPath,
  doorGeometry,
  doorHingeRect,
  doorLeafPath,
  doorSectorPath,
} from "@fp/doors";
import { createObject } from "@fp/catalog";
import { m } from "@fp/units";
import { resetIdCounter } from "@fp/catalog";

describe("doors", () => {
  it("builds finite geometry for a horizontal door", () => {
    resetIdCounter(1);
    const door = createObject("door", {
      x: 0,
      y: 0,
      width: m(0.9),
      height: m(0.2),
      hinge: "start",
      opens: "neg",
    });
    const g = doorGeometry(door);
    expect(g.horizontal).toBe(true);
    expect(Number.isFinite(g.hx)).toBe(true);
    expect(Number.isFinite(g.hy)).toBe(true);
    expect(g.boxW).toBeGreaterThan(0);
    expect(g.boxH).toBeGreaterThan(0);
    expect(g.R).toBe(m(0.9));
  });

  it("produces non-empty SVG paths", () => {
    const door = createObject("door", {
      x: 10,
      y: 20,
      width: m(0.9),
      height: m(0.2),
      hinge: "end",
      opens: "pos",
    });
    expect(doorSectorPath(door).startsWith("M ")).toBe(true);
    expect(doorArcPath(door).startsWith("M ")).toBe(true);
    expect(doorLeafPath(door).startsWith("M ")).toBe(true);
    const hinge = doorHingeRect(door);
    expect(hinge.s).toBe(3);
  });
});
