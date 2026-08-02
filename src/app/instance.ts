/**
 * Module-scoped app instance handle.
 *
 * Used by pointer listeners and interact.js so callbacks reach the live Alpine
 * proxy without attaching libraries to `window`. Not a public API.
 */

import type { FloorPlanApp } from "./types";

let appInstance: FloorPlanApp | null = null;

/**
 * Store the live Alpine component instance after init.
 * @param app - Floor plan app (Alpine reactive proxy)
 */
export function setAppInstance(app: FloorPlanApp): void {
  appInstance = app;
}

/**
 * Read the current app instance, if initialized.
 * @returns App or null before init
 */
export function getAppInstance(): FloorPlanApp | null {
  return appInstance;
}
