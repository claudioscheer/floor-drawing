import { describe, expect, it } from "vitest";
import { createDemoLayout } from "@fp/demo";
import { resetIdCounter } from "@fp/catalog";
import type { PlanObject } from "@fp/types";

/** Relative fingerprint of an apt group (origin-normalized geometry + names). */
function aptFingerprint(objs: PlanObject[]): string {
  const minX = Math.min(...objs.map((o) => o.x));
  const minY = Math.min(...objs.map((o) => o.y));
  return objs
    .map((o) => ({
      type: o.type,
      name: o.name,
      x: Math.round(o.x - minX),
      y: Math.round(o.y - minY),
      w: o.width,
      h: o.height,
      hinge: o.hinge ?? null,
      opens: o.opens ?? null,
      rot: o.rotation ?? 0,
      lrot: o.labelRotation ?? 0,
    }))
    .sort((a, b) =>
      `${a.type}|${a.name}|${a.x}|${a.y}`.localeCompare(`${b.type}|${b.name}|${b.x}|${b.y}`),
    )
    .map((o) => JSON.stringify(o))
    .join("\n");
}

describe("demo layout", () => {
  it("seeds multifamily plan with groups and objects", () => {
    resetIdCounter(1);
    const demo = createDemoLayout();
    expect(demo.objects.length).toBeGreaterThan(50);
    expect(demo.groups.length).toBe(5); // 4 apts + escada
    expect(demo.groupSeq).toBe(6);
    expect(demo.objects.some((o) => o.type === "terrain")).toBe(true);
    expect(demo.objects.some((o) => o.name === "Sala Estar")).toBe(true);
    expect(demo.objects.some((o) => o.name === "Escada 2,00 m")).toBe(true);
    expect(demo.objects.some((o) => o.name === "Escrivaninha")).toBe(true);
    expect(demo.objects.some((o) => o.name === "Máquina de lavar")).toBe(true);
    expect(demo.objects.filter((o) => o.type === "door").length).toBeGreaterThan(4);

    const apts = demo.groups.filter((g) => g.name.startsWith("Apto"));
    expect(apts).toHaveLength(4);

    const terrain = demo.objects.find((o) => o.type === "terrain");
    expect(terrain?.name).toBe("Lot 16×33 m");
    expect(terrain?.width).toBe(1600);
    expect(terrain?.height).toBe(3300);

    const stairFloor = demo.objects.find((o) => o.name === "Escada 2,00 m");
    expect(stairFloor?.height).toBe(200);

    // Cozinha band is 4.00 m deep
    const cozinha = demo.objects.find((o) => o.name === "Cozinha");
    expect(cozinha?.height).toBe(400);
    expect(cozinha?.width).toBe(300);
  });

  it("keeps Máquina de lavar inside the kitchen band (not the banho)", () => {
    resetIdCounter(1);
    const demo = createDemoLayout();
    const apt4 = demo.objects.filter((o) => o.groupId === "apt-4");
    const banho = apt4.find((o) => o.name === "Banho")!;
    const cozinha = apt4.find((o) => o.name === "Cozinha")!;
    const maquina = apt4.find((o) => o.name === "Máquina de lavar")!;
    const desk = apt4.find((o) => o.name === "Escrivaninha")!;

    // Washer fully inside cozinha AABB
    expect(maquina.x).toBeGreaterThanOrEqual(cozinha.x);
    expect(maquina.y).toBeGreaterThanOrEqual(cozinha.y);
    expect(maquina.x + maquina.width).toBeLessThanOrEqual(cozinha.x + cozinha.width + 1);
    expect(maquina.y + maquina.height).toBeLessThanOrEqual(cozinha.y + cozinha.height + 1);
    // Not overlapping banho
    expect(maquina.y).toBeGreaterThanOrEqual(banho.y + banho.height - 1);

    // Desk present in apt
    expect(desk.width).toBe(120);
    expect(desk.height).toBe(55);
  });

  it("replicates Apto 4 structure exactly onto Apto 1–3", () => {
    resetIdCounter(1);
    const demo = createDemoLayout();
    const byGroup = new Map<string, PlanObject[]>();
    for (const o of demo.objects) {
      if (!o.groupId?.startsWith("apt-")) continue;
      const list = byGroup.get(o.groupId) ?? [];
      list.push(o);
      byGroup.set(o.groupId, list);
    }
    expect(byGroup.size).toBe(4);
    const fp4 = aptFingerprint(byGroup.get("apt-4")!);
    for (const id of ["apt-1", "apt-2", "apt-3", "apt-4"]) {
      const objs = byGroup.get(id)!;
      expect(objs.length).toBe(byGroup.get("apt-4")!.length);
      expect(aptFingerprint(objs)).toBe(fp4);
    }
  });
});
