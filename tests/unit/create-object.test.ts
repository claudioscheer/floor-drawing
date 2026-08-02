import { beforeEach, describe, expect, it } from "vitest";
import { createObject, getCatalogList, getMinSize, resetIdCounter, seedIdCounter } from "@fp/catalog";
import { m } from "@fp/units";

describe("createObject", () => {
  beforeEach(() => {
    resetIdCounter(1);
  });

  it("applies catalog defaults", () => {
    const floor = createObject("floor");
    expect(floor.type).toBe("floor");
    expect(floor.width).toBe(m(4));
    expect(floor.height).toBe(m(3));
    expect(floor.visible).toBe(true);
    expect(floor.locked).toBe(false);
    expect(floor.opacity).toBe(1);
    expect(floor.id).toBe("floor-1");
  });

  it("applies door hinge/opens defaults and overrides", () => {
    const d1 = createObject("door");
    expect(d1.hinge).toBe("end");
    expect(d1.opens).toBe("neg");
    const d2 = createObject("door", { hinge: "start", opens: "pos", x: 10, y: 20 });
    expect(d2.hinge).toBe("start");
    expect(d2.opens).toBe("pos");
    expect(d2.x).toBe(10);
  });

  it("seeds id counter past existing objects", () => {
    seedIdCounter([{ id: "wall-7" }, { id: "floor-3" }]);
    const next = createObject("wall");
    expect(next.id).toBe("wall-8");
  });

  it("lists catalog and min sizes", () => {
    const list = getCatalogList();
    expect(list.map((c) => c.type)).toEqual([
      "terrain",
      "floor",
      "wall",
      "window",
      "door",
    ]);
    expect(getMinSize("wall").minW).toBe(m(0.1));
  });
});
