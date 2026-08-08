/**
 * Default 3D heights and player sizes for the walkthrough visualizer.
 * All values are meters unless noted.
 */

/** Exterior / interior wall height. */
export const WALL_HEIGHT_M = 2.7;

/** Clear door opening height. */
export const DOOR_HEIGHT_M = 2.1;

/** Window sill height above floor. */
export const WINDOW_SILL_M = 0.9;

/** Window opening height. */
export const WINDOW_HEIGHT_M = 1.2;

/** Thin floor slab thickness. */
export const FLOOR_THICK_M = 0.04;

/**
 * Walk-surface height (top of slab) by layer, meters.
 * Separated enough to avoid z-fighting when floors overlap in plan.
 */
export const LAYER_TOP_M = {
  /** Horizon grass under the lot (plane, not a box). */
  worldGround: -0.08,
  terrain: 0.0,
  outdoor: 0.03,
  room: 0.05,
  drive: 0.07,
  parking: 0.1,
  /** Paint on top of parking bays. */
  stripe: 0.115,
} as const;

/** First-person eye height. */
export const EYE_HEIGHT_M = 1.6;

/** Player collision radius on XZ. */
export const PLAYER_RADIUS_M = 0.22;

/** Walk speed (m/s). */
export const WALK_SPEED_M_S = 2.8;

/** Sprint speed (m/s). */
export const SPRINT_SPEED_M_S = 5.0;

/** Vertical fly speed (m/s) while holding Space or C. */
export const FLY_SPEED_M_S = 3.5;

/** Expand door opening slightly for walkability. */
export const DOOR_CLEARANCE_M = 0.08;

/** Minimum gap (m) kept when splitting walls around openings. */
export const OPENING_PAD_M = 0.02;
