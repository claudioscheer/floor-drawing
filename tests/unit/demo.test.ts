import { describe, expect, it } from "vitest";
import { createDemoLayout } from "@fp/demo";
import { resetIdCounter } from "@fp/catalog";

describe("demo layout", () => {
  it("seeds multifamily plan with groups and objects", () => {
    resetIdCounter(1);
    const demo = createDemoLayout();
    expect(demo.objects.length).toBeGreaterThan(50);
    expect(demo.groups.length).toBe(4);
    expect(demo.groupSeq).toBe(5);
    expect(demo.objects.some((o) => o.type === "terrain")).toBe(true);
    expect(demo.objects.some((o) => o.name === "Sala Estar")).toBe(true);
    expect(demo.objects.filter((o) => o.type === "door").length).toBeGreaterThan(4);
  });
});
