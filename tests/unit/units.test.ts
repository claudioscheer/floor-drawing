import { describe, expect, it } from "vitest";
import {
  clamp,
  cm,
  formatArea,
  formatLength,
  m,
  pxToUnit,
  snapToGrid,
  unitToPx,
  GRID,
  PX_PER_METER,
} from "@fp/units";

describe("units", () => {
  it("converts meters and centimeters to world px", () => {
    expect(m(1)).toBe(100);
    expect(m(0.2)).toBe(20);
    expect(cm(50)).toBe(50);
    expect(PX_PER_METER).toBe(100);
  });

  it("round-trips display units", () => {
    expect(pxToUnit(360, "m")).toBeCloseTo(3.6);
    expect(unitToPx(3.6, "m")).toBeCloseTo(360);
    expect(pxToUnit(50, "cm")).toBe(50);
  });

  it("formats lengths and areas", () => {
    expect(formatLength(360, "m")).toBe("3.60 m");
    expect(formatLength(50, "cm")).toBe("50 cm");
    expect(formatArea(10000)).toBe("1.00 m²");
    expect(formatArea(m(6) * m(6))).toBe("36.00 m²");
  });

  it("snaps to grid and clamps", () => {
    expect(GRID).toBe(5);
    expect(snapToGrid(12)).toBe(10);
    expect(snapToGrid(13)).toBe(15);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
