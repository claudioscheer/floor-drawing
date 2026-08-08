/**
 * Build a Three.js scene graph from plan objects (game-dev style: boxes + sofa).
 */

import * as THREE from "three";
import { worldAABB } from "@fp/geometry";
import type { Floor, PlanObject } from "@fp/types";
import { PX_PER_METER } from "@fp/units";
import type { SolidAABB } from "./collision";
import {
  DOOR_HEIGHT_M,
  FLOOR_THICK_M,
  LAYER_TOP_M,
  STOREY_HEIGHT_M,
  WALL_HEIGHT_M,
  WINDOW_HEIGHT_M,
  WINDOW_SILL_M,
} from "./constants";
import { classifyFloor, furnitureSpec, type FloorKind } from "./furniture";
import { buildWallSegments, type OpeningCut } from "./wall-openings";

export interface BuiltScene {
  root: THREE.Group;
  solids: SolidAABB[];
  spawn: { x: number; y?: number; z: number; yaw: number; pitch?: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** Options for building either one floor or the complete stacked project. */
export interface BuildFloorsOptions {
  /** Active floor used by current-floor mode. */
  activeFloorId: string | null;
  /** Render every floor when true; otherwise render only the active floor. */
  allFloors: boolean;
}

function pxToM(px: number): number {
  return px / PX_PER_METER;
}

/** CSS clockwise degrees → Three.js Y rotation (CCW positive, looking down +Y). */
function yawFromPlan(deg: number): number {
  return -((Number(deg) || 0) * Math.PI) / 180;
}

function mat(
  color: number,
  opts?: { opacity?: number; rough?: number; polygonOffset?: boolean }
): THREE.MeshStandardMaterial {
  const opacity = opts?.opacity ?? 1;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.rough ?? 0.85,
    metalness: 0.05,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    // Extra depth separation for coplanar outdoor slabs
    polygonOffset: opts?.polygonOffset ?? false,
    polygonOffsetFactor: opts?.polygonOffset ? 1 : 0,
    polygonOffsetUnits: opts?.polygonOffset ? 1 : 0,
  });
}

/** Top of walk surface for a floor kind (meters). */
function layerTopForKind(kind: FloorKind): number {
  switch (kind) {
    case "outdoor":
      return LAYER_TOP_M.outdoor;
    case "drive":
      return LAYER_TOP_M.drive;
    case "parking":
      return LAYER_TOP_M.parking;
    case "room":
    case "furniture":
    default:
      return LAYER_TOP_M.room;
  }
}

/** Y of box center so the top face sits at `topM`. */
function slabCenterY(topM: number, thickM = FLOOR_THICK_M): number {
  return topM - thickM / 2;
}

function boxMesh(
  w: number,
  h: number,
  d: number,
  material: THREE.Material
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Place a mesh whose geometry is centered at origin, onto a plan AABB.
 * @param mesh - Centered mesh
 * @param plan - Plan rect in world px
 * @param yCenter - World Y of mesh center
 * @param rotationDeg - Plan CSS rotation
 */
function placeOnPlan(
  mesh: THREE.Object3D,
  plan: { x: number; y: number; width: number; height: number; rotation?: number },
  yCenter: number,
  rotationDeg = 0
): void {
  const cx = pxToM(plan.x + plan.width / 2);
  const cz = pxToM(plan.y + plan.height / 2);
  mesh.position.set(cx, yCenter, cz);
  mesh.rotation.y = yawFromPlan(rotationDeg);
}

function makeSofa(w: number, d: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const fabric = mat(color, { rough: 0.9 });
  const dark = mat(0x2c3340, { rough: 0.85 });

  // Back against +Z (south on plan when sofa faces into room)
  const seatH = 0.42;
  const seatD = d * 0.72;
  const seat = boxMesh(w * 0.96, seatH, seatD, fabric);
  seat.position.set(0, seatH / 2, -d * 0.05);
  group.add(seat);

  const backH = 0.82;
  const backD = Math.max(0.14, d * 0.2);
  const back = boxMesh(w, backH, backD, fabric);
  back.position.set(0, backH / 2, d / 2 - backD / 2);
  group.add(back);

  const armW = Math.min(0.14, w * 0.08);
  const armH = 0.55;
  const armD = seatD;
  const armL = boxMesh(armW, armH, armD, dark);
  armL.position.set(-w / 2 + armW / 2, armH / 2, -d * 0.05);
  group.add(armL);
  const armR = boxMesh(armW, armH, armD, dark);
  armR.position.set(w / 2 - armW / 2, armH / 2, -d * 0.05);
  group.add(armR);

  return group;
}

function floorColor(kind: ReturnType<typeof classifyFloor>, name: string): number {
  const n = name.toLowerCase();
  if (kind === "parking") return 0x4a5568;
  if (kind === "drive") return 0x5c6570;
  if (kind === "outdoor") return 0x7a9a5a;
  if (/banho|banheiro/.test(n)) return 0xd8e4ea;
  if (/quarto|dorm/.test(n)) return 0xe8dcc8;
  if (/cozinha/.test(n)) return 0xe4e0d4;
  if (/sala|estar/.test(n)) return 0xece6d8;
  return 0xe8e4dc;
}

function addDoorLeaf(root: THREE.Group, cut: OpeningCut): void {
  if (cut.kind !== "door") return;
  const leafH = DOOR_HEIGHT_M - 0.04;
  const leafT = 0.04;
  const leafW = Math.max(0.4, cut.openingLengthM - 0.04);
  const wood = mat(0x6b4f2a, { rough: 0.7 });
  const leaf = boxMesh(leafT, leafH, leafW, wood);
  leaf.position.set(
    cut.hingeX + (cut.openDirectionX * leafW) / 2,
    leafH / 2,
    cut.hingeZ + (cut.openDirectionZ * leafW) / 2
  );
  leaf.rotation.y = Math.atan2(cut.openDirectionX, cut.openDirectionZ);
  leaf.name = "door-leaf";
  root.add(leaf);
}

function addWindowGlass(root: THREE.Group, cut: OpeningCut): void {
  if (cut.kind !== "window") return;
  const glass = mat(0x9ec9ef, { opacity: 0.35, rough: 0.15 });
  glass.metalness = 0.2;
  const w = cut.horizontal ? cut.openingLengthM : cut.thicknessM * 0.4;
  const d = cut.horizontal ? cut.thicknessM * 0.4 : cut.openingLengthM;
  const pane = boxMesh(w, WINDOW_HEIGHT_M, d, glass);
  pane.position.set(cut.cx, WINDOW_SILL_M + WINDOW_HEIGHT_M / 2, cut.cz);
  pane.castShadow = false;
  root.add(pane);
}

/**
 * Convert plan objects into a Three.js group, collision solids, and spawn pose.
 * @param objects - Plan objects (layout)
 */
export function buildSceneFromPlan(objects: readonly PlanObject[]): BuiltScene {
  const root = new THREE.Group();
  root.name = "plan-root";
  const solids: SolidAABB[] = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const expand = (x0: number, x1: number, z0: number, z1: number) => {
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minZ = Math.min(minZ, z0);
    maxZ = Math.max(maxZ, z1);
  };

  // Bounds must include every visible kind, including rotated walls,
  // furniture-only plans, doors, and windows.
  for (const object of objects) {
    if (object.visible === false) continue;
    const bounds = worldAABB(object);
    expand(
      pxToM(bounds.x),
      pxToM(bounds.x + bounds.width),
      pxToM(bounds.y),
      pxToM(bounds.y + bounds.height)
    );
  }

  const wallMat = mat(0xf2f0ea, { rough: 0.92 });

  // Terrain / large ground first (lowest walkable layer)
  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (obj.type === "terrain") {
      const w = pxToM(obj.width);
      const d = pxToM(obj.height);
      const mesh = boxMesh(
        w,
        FLOOR_THICK_M,
        d,
        mat(0x6b8f4e, { rough: 1, polygonOffset: true })
      );
      placeOnPlan(mesh, obj, slabCenterY(LAYER_TOP_M.terrain), obj.rotation);
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      root.add(mesh);
    }
  }

  // Rooms + furniture (each kind gets its own top height → no coplanar fight)
  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (obj.type !== "room" && obj.type !== "furniture") continue;

    const kind = classifyFloor(obj);
    const w = pxToM(obj.width);
    const d = pxToM(obj.height);
    const roomTop = LAYER_TOP_M.room;

    if (kind === "furniture") {
      const spec = furnitureSpec(obj);
      if (spec.style === "sofa") {
        const sofa = makeSofa(w, d, spec.color);
        placeOnPlan(sofa, obj, roomTop, obj.rotation);
        root.add(sofa);
      } else {
        const h = spec.heightM;
        const mesh = boxMesh(w, h, d, mat(spec.color));
        placeOnPlan(mesh, obj, roomTop + h / 2, obj.rotation);
        root.add(mesh);
      }
      // Light collision so you don't walk through big cabinets
      if (spec.heightM >= 0.8) {
        const aabb = worldAABB(obj);
        solids.push({
          minX: pxToM(aabb.x) + 0.02,
          maxX: pxToM(aabb.x + aabb.width) - 0.02,
          minZ: pxToM(aabb.y) + 0.02,
          maxZ: pxToM(aabb.y + aabb.height) - 0.02,
        });
      }
      continue;
    }

    const top = layerTopForKind(kind);
    const color = floorColor(kind, obj.name);
    const mesh = boxMesh(
      w,
      FLOOR_THICK_M,
      d,
      mat(color, { rough: 0.95, polygonOffset: true })
    );
    placeOnPlan(mesh, obj, slabCenterY(top), obj.rotation);
    // Floors: no cast/receive — kills shadow acne on large coplanar slabs
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    root.add(mesh);

    // Parking bay stripes (above parking top)
    if (kind === "parking") {
      const stripeH = 0.012;
      const stripe = mat(0xf0c040, { rough: 0.8 });
      const line = boxMesh(Math.max(0.08, w * 0.06), stripeH, d * 0.85, stripe);
      placeOnPlan(line, obj, LAYER_TOP_M.stripe - stripeH / 2, obj.rotation);
      line.castShadow = false;
      line.receiveShadow = false;
      root.add(line);
    }
  }

  // Walls with openings
  const { segments, openings } = buildWallSegments(
    objects,
    WALL_HEIGHT_M,
    DOOR_HEIGHT_M,
    WINDOW_SILL_M,
    WINDOW_HEIGHT_M
  );

  for (const seg of segments) {
    const w = seg.maxX - seg.minX;
    const d = seg.maxZ - seg.minZ;
    if (w < 0.01 || d < 0.01) continue;

    let y0 = 0;
    let y1 = WALL_HEIGHT_M;
    if (seg.kind === "sill" || seg.kind === "header" || seg.kind === "jamb") {
      y0 = seg.y0 ?? 0;
      y1 = seg.y1 ?? WALL_HEIGHT_M;
    }
    const h = y1 - y0;
    if (h < 0.01) continue;

    const mesh = boxMesh(w, h, d, wallMat);
    mesh.position.set((seg.minX + seg.maxX) / 2, y0 + h / 2, (seg.minZ + seg.maxZ) / 2);
    root.add(mesh);

    // Collision: full walls, window sills, and jambs block walking.
    // Door/window headers sit above head height and are skipped.
    if (seg.kind === "full" || seg.kind === "sill" || seg.kind === "jamb") {
      solids.push({
        minX: seg.minX,
        maxX: seg.maxX,
        minZ: seg.minZ,
        maxZ: seg.maxZ,
      });
    }
  }

  // Door leaves + window glass
  for (const cut of openings) {
    if (cut.kind === "door") addDoorLeaf(root, cut);
    else addWindowGlass(root, cut);
  }

  // Spawn: pedestrian gate or south of bounds looking north
  const spawn = pickSpawn(objects, {
    minX: Number.isFinite(minX) ? minX : 0,
    maxX: Number.isFinite(maxX) ? maxX : 10,
    minZ: Number.isFinite(minZ) ? minZ : 0,
    maxZ: Number.isFinite(maxZ) ? maxZ : 10,
  });

  return {
    root,
    solids,
    spawn,
    bounds: {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) ? maxX : 10,
      minZ: Number.isFinite(minZ) ? minZ : 0,
      maxZ: Number.isFinite(maxZ) ? maxZ : 10,
    },
  };
}

/**
 * Build a 3D scene for the active floor or the complete vertically stacked project.
 * @param objects - All project objects
 * @param floors - Building floors in arbitrary input order
 * @param options - Active-floor id and rendering scope
 * @returns Combined Three.js scene, bounds, collision data, and camera spawn
 */
export function buildSceneFromFloors(
  objects: readonly PlanObject[],
  floors: readonly Floor[],
  options: BuildFloorsOptions
): BuiltScene {
  const orderedFloors = floors.slice().sort((a, b) => a.order - b.order);
  if (!orderedFloors.length) return buildSceneFromPlan(objects);

  const activeFloor =
    orderedFloors.find((floor) => floor.id === options.activeFloorId) ||
    orderedFloors[0] ||
    null;

  if (!options.allFloors) {
    const activeObjects = activeFloor
      ? objects.filter((object) => object.floorId === activeFloor.id)
      : objects;
    return buildSceneFromPlan(activeObjects);
  }

  const root = new THREE.Group();
  root.name = "project-root";
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const floorIds = new Set(orderedFloors.map((floor) => floor.id));
  orderedFloors.forEach((floor, index) => {
    const floorObjects = objects.filter(
      (object) =>
        object.floorId === floor.id ||
        (index === 0 && !floorIds.has(object.floorId))
    );
    const built = buildSceneFromPlan(floorObjects);
    built.root.name = `floor:${floor.id}`;
    built.root.position.y = index * STOREY_HEIGHT_M;
    root.add(built.root);
    if (floorObjects.some((object) => object.visible !== false)) {
      minX = Math.min(minX, built.bounds.minX);
      maxX = Math.max(maxX, built.bounds.maxX);
      minZ = Math.min(minZ, built.bounds.minZ);
      maxZ = Math.max(maxZ, built.bounds.maxZ);
    }
  });

  const bounds = {
    minX: Number.isFinite(minX) ? minX : 0,
    maxX: Number.isFinite(maxX) ? maxX : 10,
    minZ: Number.isFinite(minZ) ? minZ : 0,
    maxZ: Number.isFinite(maxZ) ? maxZ : 10,
  };
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 10);
  const topY = Math.max(0, orderedFloors.length - 1) * STOREY_HEIGHT_M + WALL_HEIGHT_M;

  return {
    root,
    // Project overview is free-flight. XZ-only collision boxes cannot express
    // which elevated floor they belong to, so they must not be flattened here.
    solids: [],
    bounds,
    spawn: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: topY + Math.max(4, span * 0.3),
      z: bounds.maxZ + Math.max(8, span * 0.75),
      yaw: 0,
      pitch: -0.32,
    },
  };
}

function pickSpawn(
  objects: readonly PlanObject[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): { x: number; z: number; yaw: number } {
  // Three.js default camera looks down -Z. Plan north (smaller Y) = -Z.
  // yaw 0 → look north; π/2 → look west (-X); -π/2 → look east (+X).

  // Prefer vehicle corridor: apartments on the west, parking on the east.
  const drive = objects.find(
    (o) => o.type === "room" && /circul/i.test(o.name || "")
  );
  if (drive) {
    return {
      x: pxToM(drive.x + drive.width / 2),
      z: pxToM(drive.y + drive.height) - 3.5,
      yaw: 0,
    };
  }

  // Else near first apt entrance, facing the door (west).
  const entrada = objects.find(
    (o) => o.type === "door" && /entrada/i.test(o.name || "")
  );
  if (entrada) {
    return {
      x: pxToM(entrada.x + entrada.width / 2) + 2.0,
      z: pxToM(entrada.y + entrada.height / 2),
      yaw: Math.PI / 2,
    };
  }

  // Else just inside pedestrian gate looking north.
  const ped = objects.find(
    (o) => o.type === "door" && /pedestre/i.test(o.name || "")
  );
  if (ped) {
    const cx = pxToM(ped.x + ped.width / 2);
    const cz = pxToM(ped.y + ped.height / 2);
    return { x: cx, z: cz - 2.5, yaw: 0 };
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: bounds.maxZ - 4,
    yaw: 0,
  };
}
