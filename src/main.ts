/**
 * Application bootstrap.
 * Registers the Alpine component and starts the runtime.
 * No domain libraries are attached to window.
 */

import Alpine from "alpinejs";
import { floorPlanApp } from "@fp/app";
import "./styles/styles.css";

declare global {
  interface Window {
    /** Alpine runtime (framework only — not domain libraries). */
    Alpine: typeof Alpine;
  }
}

window.Alpine = Alpine;
Alpine.data("floorPlanApp", () => floorPlanApp() as unknown as Record<string, unknown>);
Alpine.start();
