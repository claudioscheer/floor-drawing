/**
 * Classify floor objects as furniture vs slabs, and pick default 3D heights.
 * Furniture in the plan is authored as type "floor" with a fixture name.
 */

import type { PlanObject } from "@fp/types";

/** How a floor object should appear in the 3D scene. */
export type FloorKind =
  | "room"
  | "outdoor"
  | "parking"
  | "drive"
  | "furniture";

/** Furniture mesh style. */
export type FurnitureStyle = "box" | "sofa";

export interface FurnitureSpec {
  style: FurnitureStyle;
  /** Default height in meters. */
  heightM: number;
  /** Hex color for mesh material. */
  color: number;
}

const FURNITURE_RULES: Array<{
  match: RegExp;
  style: FurnitureStyle;
  heightM: number;
  color: number;
}> = [
  { match: /sof[aá]/i, style: "sofa", heightM: 0.85, color: 0x4a6fa5 },
  { match: /cama/i, style: "box", heightM: 0.45, color: 0xc4a574 },
  { match: /mesa/i, style: "box", heightM: 0.75, color: 0x8b6914 },
  { match: /arm[aá]rio|roupeiro/i, style: "box", heightM: 2.1, color: 0x6b5344 },
  { match: /geladeira/i, style: "box", heightM: 1.8, color: 0xd0d5dc },
  { match: /fog[aã]o/i, style: "box", heightM: 0.9, color: 0x3a3a3a },
  { match: /pia|tanque/i, style: "box", heightM: 0.9, color: 0xb8c4ce },
  { match: /vaso/i, style: "box", heightM: 0.4, color: 0xe8eef2 },
  { match: /m[aá]quina/i, style: "box", heightM: 0.85, color: 0x9aa3ad },
  { match: /box|chuveiro/i, style: "box", heightM: 2.0, color: 0xa8d4e8 },
];

const DEFAULT_FURNITURE: FurnitureSpec = {
  style: "box",
  heightM: 0.9,
  color: 0x8a8070,
};

/**
 * Resolve furniture mesh style from an object name.
 * @param name - Plan object name
 * @returns Spec when name matches a known fixture; null otherwise
 */
export function furnitureSpecFromName(name: string): FurnitureSpec | null {
  const n = String(name || "").trim();
  if (!n) return null;
  for (const rule of FURNITURE_RULES) {
    if (rule.match.test(n)) {
      return { style: rule.style, heightM: rule.heightM, color: rule.color };
    }
  }
  return null;
}

/**
 * Classify a floor (or terrain) object for 3D extrusion.
 * @param obj - Plan object
 */
export function classifyFloor(obj: PlanObject): FloorKind {
  if (obj.type === "terrain") return "outdoor";
  if (obj.type !== "floor") return "room";

  const n = String(obj.name || "").toLowerCase();
  if (furnitureSpecFromName(obj.name)) return "furniture";

  if (/vaga/.test(n)) return "parking";
  if (/moto/.test(n)) return "parking";
  if (/circul|ve[ií]culo|drive|aisle/.test(n)) return "drive";
  if (/faixa|recuo|frontal|lot|terreno|livre/.test(n)) return "outdoor";

  return "room";
}

/**
 * Furniture height for a named floor object (meters).
 * Non-furniture floors return 0.
 * @param obj - Plan floor object
 */
export function furnitureHeightM(obj: PlanObject): number {
  const spec = furnitureSpecFromName(obj.name);
  return spec ? spec.heightM : DEFAULT_FURNITURE.heightM;
}

/**
 * Full furniture spec for rendering; falls back to default box.
 * @param obj - Plan floor object known to be furniture
 */
export function furnitureSpec(obj: PlanObject): FurnitureSpec {
  return furnitureSpecFromName(obj.name) ?? DEFAULT_FURNITURE;
}
