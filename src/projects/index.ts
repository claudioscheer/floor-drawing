/**
 * Projects library: API client + document helpers.
 * No DOM/window — download stays in @fp/app.
 */

export {
  ProjectsApiError,
  listProjects,
  getProject,
  createProject,
  updateProject,
  duplicateProject,
  deleteProject,
} from "./client";

export {
  emptyPlanDocument,
  buildPlanDocument,
  normalizePlanDocument,
  planDocumentToExport,
} from "./document";

export type { PlanDocumentSource } from "./document";

export {
  PROJECTS_LIST_PATH,
  isProjectId,
  projectPath,
  parseProjectIdFromPath,
  isProjectsListPath,
} from "./routes";

export {
  DEFAULT_LEVEL_ID,
  DEFAULT_UNIT_ID,
  createDefaultStructure,
  normalizeLevels,
  normalizeUnits,
  ensureObjectStructure,
  unitsOnLevel,
  nextLevelName,
  nextUnitName,
} from "./structure";
