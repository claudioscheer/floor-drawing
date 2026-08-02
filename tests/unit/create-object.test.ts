import { beforeEach, describe, expect, it } from "vitest";
import {
  createObject,
  getCatalogList,
  getMinSize,
  normalizeObjectType,
  resetIdCounter,
  seedIdCounter,
} from "@fp/catalog";
import { m } from "@fp/units";

describe("createObject", () => {
  beforeEach(() => {
    resetIdCounter(1);
  });

  it("applies room catalog defaults", () => {
    const room = createObject("room");
    expect(room.type).toBe("room");
    expect(room.width).toBe(m(4));
    expect(room.height).toBe(m(3));
    expect(room.visible).toBe(true);
    expect(room.locked).toBe(false);
    expect(room.opacity).toBe(1);
    expect(room.id).toBe("room-1");
    expect(room.name).toBe("Room");
  });

  it("applies furniture defaults", () => {
    const furn = createObject("furniture", { name: "Sofa" });
    expect(furn.type).toBe("furniture");
    expect(furn.name).toBe("Sofa");
    expect(furn.width).toBe(m(1.8));
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
    seedIdCounter([{ id: "wall-7" }, { id: "room-3" }]);
    const next = createObject("wall");
    expect(next.id).toBe("wall-8");
  });

  it("lists catalog and min sizes", () => {
    const list = getCatalogList();
    expect(list.map((c) => c.type)).toEqual([
      "terrain",
      "room",
      "furniture",
      "wall",
      "window",
      "door",
    ]);
    expect(list.every((c) => c.description.length > 20)).toBe(true);
    expect(getMinSize("wall").minW).toBe(m(0.1));
  });

  it("normalizes legacy floor types", () => {
    expect(normalizeObjectType("floor", "Sala Estar")).toBe("room");
    expect(normalizeObjectType("floor", "Sofá")).toBe("furniture");
    expect(normalizeObjectType("floor", "Cama")).toBe("furniture");
    expect(normalizeObjectType("room", "X")).toBe("room");
  });
});
