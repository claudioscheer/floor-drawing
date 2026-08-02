/**
 * Simple circle-vs-AABB collision for first-person walking.
 * Coordinates are meters on the XZ plane (Y is height).
 */

/** Axis-aligned solid on the ground plane. */
export interface SolidAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Test whether a circle intersects an AABB (2D, XZ).
 * @param cx - Circle center X
 * @param cz - Circle center Z
 * @param r - Radius
 * @param box - Solid
 */
export function circleHitsAabb(
  cx: number,
  cz: number,
  r: number,
  box: SolidAABB
): boolean {
  const nearestX = Math.max(box.minX, Math.min(cx, box.maxX));
  const nearestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));
  const dx = cx - nearestX;
  const dz = cz - nearestZ;
  return dx * dx + dz * dz < r * r;
}

/**
 * Whether the player circle collides with any solid.
 * @param cx - Player X
 * @param cz - Player Z
 * @param r - Radius
 * @param solids - Collision boxes
 */
export function collidesAny(
  cx: number,
  cz: number,
  r: number,
  solids: readonly SolidAABB[]
): boolean {
  for (const s of solids) {
    if (circleHitsAabb(cx, cz, r, s)) return true;
  }
  return false;
}

/**
 * Try to move on X then Z independently (slide along walls).
 * @returns Resolved position
 */
export function moveWithSlide(
  x: number,
  z: number,
  dx: number,
  dz: number,
  r: number,
  solids: readonly SolidAABB[]
): { x: number; z: number } {
  let nx = x + dx;
  let nz = z;
  if (collidesAny(nx, nz, r, solids)) {
    nx = x;
  }
  nz = z + dz;
  if (collidesAny(nx, nz, r, solids)) {
    nz = z;
  }
  return { x: nx, z: nz };
}
