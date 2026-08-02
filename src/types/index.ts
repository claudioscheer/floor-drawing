/**
 * Central domain types for the floor-plan editor.
 *
 * All libraries import types from here. Do not declare parallel object shapes
 * in feature modules — extend these definitions instead.
 *
 * Scale: 1 world pixel = 1 centimeter; 100 px = 1 meter.
 */

/** Plan component kinds supported by the catalog and place tools. */
export type ObjectType = "terrain" | "floor" | "wall" | "window" | "door";

/** Active editor tool. Place tools share names with {@link ObjectType}. */
export type EditorTool = "select" | "pan" | ObjectType;

/** Door hinge along the opening span. */
export type DoorHinge = "start" | "end";

/**
 * Swing side perpendicular to the opening.
 * Horizontal doors: neg = up, pos = down.
 * Vertical doors: neg = left, pos = right.
 */
export type DoorOpens = "neg" | "pos";

/** Display unit for length formatting and property fields. */
export type DisplayUnit = "m" | "cm";

/** Dimension badge axis: width edge, height edge, or name badge. */
export type DimAxis = "w" | "h" | "n";

/** 2D point in world or local coordinates (pixels). */
export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rectangle in world pixels (1 px = 1 cm). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Unrotated local box with optional CSS rotation about center. */
export interface TransformedRect extends Rect {
  /** Degrees, clockwise (CSS), pivot = object center. */
  rotation?: number;
}

/** Minimum size constraints from the catalog. */
export interface MinSize {
  minW: number;
  minH: number;
}

/** Named group of plan objects (layers panel only; does not force co-drag). */
export interface Group {
  id: string;
  name: string;
  collapsed: boolean;
}

/**
 * A placeable plan object.
 * Local x/y/width/height describe the unrotated box; rotation is about center.
 */
export interface PlanObject extends Rect {
  id: string;
  type: ObjectType;
  name: string;
  notes: string;
  /** Degrees, clockwise (CSS), pivot = object center. */
  rotation: number;
  /**
   * Center label angle in world space (0 = upright).
   * Local CSS rotation = labelRotation − object.rotation.
   */
  labelRotation: number;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
  /** 0–1 CSS opacity (1 = solid). */
  opacity: number;
  showDimensions: boolean;
  /** Legacy per-object dim offsets (runtime uses labelOffsets map). */
  dimOffW: Point;
  dimOffH: Point;
  /** Door-only configuration. */
  hinge?: DoorHinge;
  opens?: DoorOpens;
}

/** Partial overrides accepted by createObject. */
export type PlanObjectOverrides = Partial<
  Omit<PlanObject, "type"> & { id?: string }
>;

/** Catalog entry metadata + factory defaults. */
export interface CatalogEntry {
  type: ObjectType;
  label: string;
  description: string;
  defaults: {
    width: number;
    height: number;
    name: string;
    hinge?: DoorHinge;
    opens?: DoorOpens;
    rotation?: number;
    labelRotation?: number;
    opacity?: number;
  };
  minW: number;
  minH: number;
  /** Base paint stack priority (multiplied when computing z-index). */
  z: number;
}

/** Palette list item (left tools panel). */
export interface CatalogListItem {
  type: ObjectType;
  label: string;
  description: string;
}

/** Per-object label offset bag (width / height / name badges). */
export interface LabelOffsetEntry {
  w: Point;
  h: Point;
  n: Point;
}

/** Map of object id → label offsets (kept off the object record for Alpine). */
export type LabelOffsetsMap = Record<string, LabelOffsetEntry>;

/** Live snap guide state painted during drag/resize. */
export interface SnapGuides {
  v: number | null;
  h: number | null;
  active: boolean;
}

/** Result of snapping a position in world space. */
export interface SnapPositionResult {
  x: number;
  y: number;
  guides: { v: number | null; h: number | null };
  active: boolean;
}

/** Result of snapping a resize in world space. */
export interface SnapResizeResult extends Rect {
  guides: { v: number | null; h: number | null };
  active: boolean;
}

/** Which edges participate in a resize gesture. */
export interface ResizeEdges {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
}

/** Options for snap engines. */
export interface SnapOptions {
  range?: number;
  partnersMap?: Readonly<Record<string, readonly ObjectType[]>>;
  grid?: number;
  useGrid?: boolean;
}

/** Demo layout seed returned at boot. */
export interface DemoLayout {
  objects: PlanObject[];
  groups: Group[];
  groupSeq: number;
}

/** Exported plan JSON payload. */
export interface PlanExport {
  name: string;
  exportedAt: string;
  groups: Group[];
  objects: Array<
    PlanObject & {
      dimOffW: Point;
      dimOffH: Point;
      dimOffN: Point;
    }
  >;
  labelOffsets: LabelOffsetsMap;
}

/** History snapshot (serialized JSON string of this shape). */
export interface HistorySnapshotData {
  objects: PlanObject[];
  groups: Group[];
  groupSeq: number;
  labelOffsets: LabelOffsetsMap;
  selectedId: string | null;
  selectedIds: string[];
  showDimensionsGlobal: boolean;
}

/** Layers panel row: group header or object. */
export type LayerRow =
  | {
      kind: "group";
      id: string;
      group: Group;
      memberCount: number;
      allVisible: boolean;
      allLocked: boolean;
    }
  | {
      kind: "object";
      id: string;
      obj: PlanObject;
      indented: boolean;
    };

/** Door geometry in world space (for SVG swing symbols). */
export interface DoorGeometry {
  horizontal: boolean;
  R: number;
  hx: number;
  hy: number;
  hinge: DoorHinge;
  opens: DoorOpens;
  rotation: number;
  aClosed: number;
  aOpen: number;
  angleDelta: number;
  start: Point;
  end: Point;
  closedEnd: Point;
  openEnd: Point;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  boxW: number;
  boxH: number;
}

/** Hinge marker rect in door-local SVG coords. */
export interface DoorHingeRect {
  x: number;
  y: number;
  s: number;
}

/** Selection options for selectObject / selectGroup. */
export interface SelectOptions {
  additive?: boolean;
  toggle?: boolean;
  event?: Event | null;
  focus?: boolean;
}

/** Palette drag ghost state. */
export interface PaletteDragState {
  active: boolean;
  type: ObjectType | null;
  x: number;
  y: number;
  width: number;
  height: number;
  pointerId: number | null;
}

/** Native canvas object drag state. */
export interface ObjectDragState {
  active: boolean;
  id: string | null;
  pointerId: number | null;
  lastX: number;
  lastY: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  peers: Array<{ id: string; startX: number; startY: number }>;
}

/** Viewport pan gesture state. */
export interface PanState {
  active: boolean;
  spaceDown: boolean;
  startX: number;
  startY: number;
  originPanX: number;
  originPanY: number;
}

/** Layers panel HTML5 drag state. */
export interface LayerDragState {
  active: boolean;
  id: string | null;
  kind: "object" | "group" | null;
}

/** CSS style bag returned by Alpine style binders. */
export type StyleMap = Record<string, string | number | null | undefined>;
