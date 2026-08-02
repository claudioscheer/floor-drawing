/**
 * Component catalog definitions and preferred snap partners.
 */

import type { CatalogEntry, ObjectType } from "@fp/types";
import { m } from "@fp/units";

/** Exterior / party wall thickness (20 cm). */
export const WALL_T = m(0.2);
/** Default single door clear width (90 cm). */
export const DOOR_W = m(0.9);
/** Default window width (120 cm). */
export const WINDOW_W = m(1.2);
/** Default room size. */
export const ROOM_W = m(4);
export const ROOM_H = m(3);
/** Default furniture footprint. */
export const FURN_W = m(1.8);
export const FURN_H = m(0.9);
/** Default terrain plot size. */
export const PLOT_W = m(8);
export const PLOT_H = m(6);

/**
 * Names that identify furniture/fixtures (EN + PT).
 * Used to migrate legacy type `"floor"` and for 3D furniture detection.
 */
export const FURNITURE_NAME_RE =
  /sof[aá]|cama|mesa|arm[aá]rio|roupeiro|geladeira|refrigerat|fog[aã]o|pia|tanque|vaso|m[aá]quina|box|chuveiro|closet|bed|sofa|table|fridge|sink|toilet|stove|cabinet|wardrobe|desk|chair|lavabo|bancada/i;

/**
 * Whether a display name looks like furniture (not a room slab).
 * @param name - Object name
 */
export function isFurnitureName(name: string): boolean {
  return FURNITURE_NAME_RE.test(String(name || "").trim());
}

/**
 * Canonical catalog of placeable component types.
 * Keys are {@link ObjectType} values.
 */
export const CATALOG: Readonly<Record<ObjectType, CatalogEntry>> = {
  terrain: {
    type: "terrain",
    label: "Terrain",
    description:
      "Site or lot boundary. Draw the plot of land under the building. Place first so rooms and setbacks snap to it.",
    defaults: { width: PLOT_W, height: PLOT_H, name: "Terrain" },
    minW: m(1),
    minH: m(1),
    z: 0,
  },
  room: {
    type: "room",
    label: "Room",
    description:
      "A room or space slab: bedroom, living room, kitchen, bathroom, corridor, parking bay, or setback. Rename it in the inspector (for example Bedroom or Living room). Not a building story.",
    defaults: { width: ROOM_W, height: ROOM_H, name: "Room" },
    minW: m(0.5),
    minH: m(0.5),
    z: 1,
  },
  furniture: {
    type: "furniture",
    label: "Furniture",
    description:
      "Fixtures and furniture: sofa, bed, table, closet, fridge, sink. Place inside a room, then rename (for example Sofa or Bed). Renders as 3D objects in Visualize.",
    defaults: { width: FURN_W, height: FURN_H, name: "Furniture" },
    minW: m(0.2),
    minH: m(0.2),
    z: 3,
  },
  wall: {
    type: "wall",
    label: "Wall",
    description:
      "Structural or partition wall. Draw along room edges. Doors and windows snap to walls.",
    defaults: { width: m(2), height: WALL_T, name: "" },
    minW: m(0.1),
    minH: m(0.1),
    z: 5,
  },
  window: {
    type: "window",
    label: "Window",
    description:
      "Window opening. Snaps to walls. Place on exterior or party walls where light enters.",
    defaults: { width: WINDOW_W, height: WALL_T, name: "Window" },
    minW: m(0.4),
    minH: m(0.1),
    z: 8,
  },
  door: {
    type: "door",
    label: "Door",
    description:
      "Door opening with swing. Snaps to walls. Set hinge and open direction in the inspector.",
    defaults: {
      width: DOOR_W,
      height: WALL_T,
      name: "Door",
      hinge: "end",
      opens: "neg",
    },
    minW: m(0.5),
    minH: m(0.1),
    z: 8,
  },
};

/**
 * Preferred snap partners for each type.
 * Inclusive so components can lock to wall/room edges when placing.
 */
export const SNAP_PARTNERS: Readonly<Record<ObjectType, readonly ObjectType[]>> =
  {
    terrain: ["terrain", "room", "wall"],
    room: ["room", "terrain", "wall", "furniture"],
    furniture: ["room", "furniture", "wall"],
    wall: ["room", "wall", "terrain", "window", "door", "furniture"],
    window: ["wall", "window", "door", "room"],
    door: ["wall", "door", "window", "room"],
  };
