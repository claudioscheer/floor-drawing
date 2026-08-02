/**
 * Component catalog library: types, defaults, object factory, ids.
 */

export {
  CATALOG,
  SNAP_PARTNERS,
  WALL_T,
  DOOR_W,
  WINDOW_W,
  ROOM_W,
  ROOM_H,
  FURN_W,
  FURN_H,
  PLOT_W,
  PLOT_H,
  FURNITURE_NAME_RE,
  isFurnitureName,
} from "./catalog-data";
export {
  createObject,
  getCatalogList,
  getMinSize,
  isObjectType,
  normalizeObjectType,
} from "./create-object";
export { nextId, seedIdCounter, resetIdCounter } from "./ids";
