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
/** Default room floor size. */
export const ROOM_W = m(4);
export const ROOM_H = m(3);
/** Default terrain plot size. */
export const PLOT_W = m(8);
export const PLOT_H = m(6);

/**
 * Canonical catalog of placeable component types.
 * Keys are {@link ObjectType} values.
 */
export const CATALOG: Readonly<Record<ObjectType, CatalogEntry>> = {
  terrain: {
    type: "terrain",
    label: "Terrain",
    description: "Site / ground plot",
    defaults: { width: PLOT_W, height: PLOT_H, name: "Terrain" },
    minW: m(1),
    minH: m(1),
    z: 0,
  },
  floor: {
    type: "floor",
    label: "Floor",
    description: "Room slab / base area",
    defaults: { width: ROOM_W, height: ROOM_H, name: "Floor" },
    minW: m(0.5),
    minH: m(0.5),
    z: 1,
  },
  wall: {
    type: "wall",
    label: "Wall",
    description: "Structural wall segment",
    defaults: { width: m(2), height: WALL_T, name: "" },
    minW: m(0.1),
    minH: m(0.1),
    z: 5,
  },
  window: {
    type: "window",
    label: "Window",
    description: "Snaps to walls",
    defaults: { width: WINDOW_W, height: WALL_T, name: "Window" },
    minW: m(0.4),
    minH: m(0.1),
    z: 8,
  },
  door: {
    type: "door",
    label: "Door",
    description: "Snaps to walls",
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
 * Inclusive so components can lock to wall/floor edges when placing.
 */
export const SNAP_PARTNERS: Readonly<Record<ObjectType, readonly ObjectType[]>> = {
  terrain: ["terrain", "floor", "wall"],
  floor: ["floor", "terrain", "wall"],
  wall: ["floor", "wall", "terrain", "window", "door"],
  window: ["wall", "window", "door", "floor"],
  door: ["wall", "door", "window", "floor"],
};
