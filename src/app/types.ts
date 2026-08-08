/**
 * Alpine surface type for the floor plan editor.
 * All domain shapes come from {@link @fp/types}; this file only describes the app.
 */

import type {
  AppScreen,
  CatalogListItem,
  DimAxis,
  DoorHingeRect,
  EditorTool,
  Group,
  LabelOffsetEntry,
  LabelOffsetsMap,
  LayerDragState,
  LayerRow,
  Floor,
  ObjectDragState,
  ObjectType,
  PaletteDragState,
  PaletteHoverTip,
  PanState,
  PlanDocument,
  PlanObject,
  PlanObjectOverrides,
  ProjectSummary,
  SaveStatus,
  SelectOptions,
  SnapGuides,
  StyleMap,
} from "@fp/types";
import type { VisualizerHandle } from "@fp/visualizer";

/** Editor chrome mode: 2D layout vs 3D walkthrough. */
export type ViewMode = "layout" | "visualize";

/** Alpine magic properties injected at runtime (optional on the factory return). */
export interface AlpineMagic {
  $nextTick?: (fn: () => void) => void;
  $refs?: {
    viewport?: HTMLElement;
    vizMount?: HTMLElement;
  };
}

/**
 * Public floor-plan Alpine component.
 * Methods match the HTML template bindings and interact integration.
 */
export interface FloorPlanApp extends AlpineMagic {
  objects: PlanObject[];
  selectedId: string | null;
  selectedIds: string[];
  groups: Group[];
  groupSeq: number;
  floors: Floor[];
  floorSeq: number;
  activeFloorId: string | null;
  snapToFloorBelow: boolean;
  zoom: number;
  panX: number;
  panY: number;
  minZoom: number;
  maxZoom: number;
  planName: string;
  activeTool: EditorTool;
  /** layout = 2D editor; visualize = Three.js walkthrough */
  viewMode: ViewMode;
  /** Pointer-lock active inside visualizer */
  vizLocked: boolean;
  _visualizer: VisualizerHandle | null;
  showDimensionsGlobal: boolean;
  labelOffsets: LabelOffsetsMap;
  historyPast: string[];
  historyFuture: string[];
  historyLimit: number;
  _historyPaused: boolean;
  layerDrag: LayerDragState;
  palette: CatalogListItem[];
  /** Fixed-position help card while hovering a tools palette item. */
  paletteHoverTip: PaletteHoverTip | null;
  /** Open floor help, if any. */
  structureHelpKind: "floor" | null;
  snapGuides: SnapGuides;
  panState: PanState;
  paletteDrag: PaletteDragState;
  objectDrag: ObjectDragState;
  zoomSteps: number[];
  _suppressClearUntil?: number;
  _dimDrag?: unknown;
  _objectDragMove?: (ev: PointerEvent) => void;
  _objectDragUp?: () => void;

  /** projects browser vs editor */
  screen: AppScreen;
  projectId: string | null;
  projects: ProjectSummary[];
  projectsLoading: boolean;
  projectsError: string | null;
  saveStatus: SaveStatus;
  _saveTimer: ReturnType<typeof setTimeout> | null;
  _saveInFlight: Promise<void> | null;
  _bootstrapped: boolean;

  readonly selected: PlanObject | null;
  readonly isPlaceTool: boolean;
  readonly isPanTool: boolean;
  readonly canGroup: boolean;
  readonly canUngroup: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  init(): void;
  bootstrapFromUrl(): Promise<void>;
  syncFromLocation(): Promise<void>;
  setProjectUrl(id: string, replace?: boolean): void;
  setProjectsListUrl(replace?: boolean): void;
  pushUrl(path: string, state: unknown): void;
  replaceUrl(path: string, state: unknown): void;
  setDocumentTitle(name: string | null): void;
  loadProjects(): Promise<void>;
  createProject(): Promise<void>;
  openProject(
    id: string,
    opts?: { skipUrl?: boolean }
  ): Promise<void>;
  duplicateProject(id: string): Promise<void>;
  deleteProject(id: string): Promise<void>;
  exportProjectFromList(id: string): Promise<void>;
  backToProjects(opts?: { skipUrl?: boolean }): Promise<void>;
  onPlanNameInput(): void;
  scheduleSave(): void;
  flushSave(): Promise<void>;
  buildPlanDocument(): PlanDocument;
  applyPlanDocument(doc: PlanDocument): void;
  visibleObjects(): PlanObject[];
  floorBelow(): Floor | null;
  referenceObjects(): PlanObject[];
  snapPartners(): PlanObject[];
  canPlaceTerrain(): boolean;
  setSnapToFloorBelow(enabled: boolean): void;
  setActiveFloor(floorId: string): void;
  addFloor(): void;
  duplicateActiveFloor(): void;
  renameFloor(floorId: string, name: string): void;
  deleteFloor(floorId: string): void;
  saveStatusLabel(): string;
  formatProjectDate(iso: string): string;
  isTypingTarget(el: EventTarget | null): boolean;
  worldStyle(): StyleMap;
  viewportGridStyle(): StyleMap;
  objectStyle(obj: PlanObject): StyleMap;
  referenceObjectStyle(obj: PlanObject): StyleMap;
  opacityPercent(obj: PlanObject | null): number;
  setOpacityPercent(value: number | string, withHistory?: boolean): void;
  objectClass(obj: PlanObject): string;
  referenceObjectClass(obj: PlanObject): string;
  normalizeRotation(value: unknown): number;
  nudgeRotation(delta: number): void;
  setRotation(value: number | string): void;
  setLabelRotation(value: number | string): void;
  nudgeLabelRotation(delta: number): void;
  matchLabelToObject(): void;
  labelStyle(obj: PlanObject): StyleMap;
  dimsGroupClass(obj: PlanObject): string;
  dimsVisible(obj: PlanObject | null): boolean;
  objectDisplayName(obj: PlanObject | null): string;
  doorObjects(): PlanObject[];
  referenceDoorObjects(): PlanObject[];
  doorIsHorizontal(obj: PlanObject | null): boolean;
  doorHingeStartLabel(obj: PlanObject | null): string;
  doorHingeEndLabel(obj: PlanObject | null): string;
  doorOpensNegLabel(obj: PlanObject | null): string;
  doorOpensPosLabel(obj: PlanObject | null): string;
  doorSwingStyle(obj: PlanObject): StyleMap;
  doorSwingViewBox(obj: PlanObject): string;
  doorSymbolPath(obj: PlanObject): string;
  doorSectorPath(obj: PlanObject): string;
  doorArcPath(obj: PlanObject): string;
  doorLeafPath(obj: PlanObject): string;
  doorClosedLeafPath(obj: PlanObject): string;
  doorHingeRect(obj: PlanObject): DoorHingeRect;
  formatSize(n: number): string;
  formatObjectArea(obj: PlanObject | null): string;
  formatMeters(n: number): string;
  metersToPx(value: number | string): number;
  ensureLabelOffset(id: string): LabelOffsetEntry;
  getLabelOffset(id: string, axis: DimAxis): { x: number; y: number };
  setLabelOffset(id: string, axis: DimAxis, x: number, y: number): void;
  showsNameBadge(obj: PlanObject | null): boolean;
  nameBadgeText(obj: PlanObject | null): string;
  dimAnchor(obj: PlanObject, axis: DimAxis): { x: number; y: number };
  dimDefaultPos(obj: PlanObject, axis: DimAxis): { x: number; y: number };
  dimBadgePos(obj: PlanObject, axis: DimAxis): { x: number; y: number };
  dimBadgeStyle(obj: PlanObject, axis: DimAxis): StyleMap;
  dimAnchorStyle(obj: PlanObject, axis: DimAxis): StyleMap;
  dimBarStyle(obj: PlanObject, axis: DimAxis): StyleMap;
  dimTickStyle(obj: PlanObject, axis: DimAxis, which: string): StyleMap;
  dimLeaderStyle(obj: PlanObject, axis: DimAxis): StyleMap;
  resetDimOffsets(id: string | null): void;
  setAllDimensions(on: boolean): void;
  toggleGlobalDimensions(): void;
  planMeta(): string;
  floorAreaLabel(): string;
  setTool(tool: EditorTool | string): void;
  setViewMode(mode: ViewMode | string): void;
  startVisualizer(): Promise<void>;
  stopVisualizer(): void;
  exportPlan(): void;
  paletteGhostStyle(): StyleMap;
  pickObjectAtClient(clientX: number, clientY: number): string | null;
  onObjectPointerDown(event: PointerEvent, id: string): void;
  startObjectDrag(event: PointerEvent, id: string): void;
  onObjectDragMove(event: PointerEvent): void;
  endObjectDrag(): void;
  nudgeSelected(dx: number, dy: number, withHistory?: boolean): void;
  onDimPointerDown(event: PointerEvent, objId: string, axis: DimAxis): void;
  isSelected(id: string): boolean;
  isGroupSelected(groupId: string): boolean;
  selectObject(id: string, opts?: SelectOptions): void;
  clearSelection(): void;
  focusSelection(id?: string | null): void;
  scrollLayerIntoView(id: string): void;
  ensureObjectInView(id: string): void;
  selectGroup(groupId: string, opts?: SelectOptions): void;
  layerDisplayName(obj: PlanObject | null): string;
  getGroup(groupId: string): Group | null;
  layersView(): LayerRow[];
  toggleGroupCollapsed(groupId: string): void;
  toggleVisible(id: string): void;
  toggleLocked(id: string): void;
  toggleGroupVisible(groupId: string): void;
  toggleGroupLocked(groupId: string): void;
  movePeerIds(id: string): string[];
  groupSelected(): void;
  ungroupSelected(): void;
  renameGroup(groupId: string, name: string): void;
  nudgeLayer(id: string, delta: number): void;
  nudgeGroupLayer(groupId: string, delta: number): void;
  bringToFront(id: string): void;
  sendToBack(id: string): void;
  bringForward(id: string): void;
  sendBackward(id: string): void;
  reorderLayerOnto(
    dragId: string,
    dragKind: string,
    targetId: string,
    targetKind: string
  ): void;
  onLayerDragStart(e: DragEvent, id: string, kind: "object" | "group"): void;
  onLayerDrop(e: DragEvent, targetId: string, targetKind: string): void;
  onLayerDragOver(e: DragEvent): void;
  captureSnapshot(): string;
  pushHistory(): void;
  restoreSnapshot(snap: string): void;
  undo(): void;
  redo(): void;
  patchObject(id: string, patch: Partial<PlanObject> & { id?: string }): void;
  updateSelected(patch: Partial<PlanObject>): void;
  deleteSelected(): void;
  duplicateSelected(): void;
  onKeydown(e: KeyboardEvent): void;
  zoomIn(): void;
  zoomOut(): void;
  setZoom(next: number, centerClientX?: number, centerClientY?: number): void;
  contentBounds(): { x: number; y: number; width: number; height: number } | null;
  fitToContent(): void;
  resetView(): void;
  onWheel(e: WheelEvent): void;
  onViewportPointerDown(e: PointerEvent): void;
  onViewportPointerMove(e: PointerEvent): void;
  onViewportPointerUp(e: PointerEvent): void;
  onViewportClick(e: MouseEvent): void;
  startPaletteDrag(e: PointerEvent, type: ObjectType): void;
  placeFromPalette(clientX: number, clientY: number, type: ObjectType | string): void;
  showPaletteTip(
    event: MouseEvent | FocusEvent,
    label: string,
    description: string
  ): void;
  hidePaletteTip(): void;
  paletteTipStyle(): StyleMap;
  toggleStructureHelp(
    event: MouseEvent,
    kind: "floor"
  ): void;
  hideStructureHelp(): void;

  /**
   * Domain helpers exposed for tests (no window globals).
   * Prefer unit-testing pure libraries; these wrap the same functions for e2e.
   */
  createObject(type: ObjectType, overrides?: PlanObjectOverrides): PlanObject;
  m(meters: number): number;
}
