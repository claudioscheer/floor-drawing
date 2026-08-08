/**
 * 3D plan visualizer (Three.js first-person walkthrough).
 * DOM-aware; only import from app / main.
 */

export { createVisualizer } from "./create-visualizer";
export type {
  VisualizerHandle,
  CreateVisualizerOptions,
  VisualizerRebuildOptions,
} from "./create-visualizer";
export { classifyFloor, furnitureSpec, furnitureSpecFromName } from "./furniture";
export type { FloorKind, FurnitureSpec, FurnitureStyle } from "./furniture";
export { moveWithSlide, circleHitsAabb, collidesAny } from "./collision";
export type { SolidAABB } from "./collision";
