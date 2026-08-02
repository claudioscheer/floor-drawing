/**
 * HTTP client for the local projects API.
 * Pure relative to DOM: uses fetch only.
 */

import type { PlanDocument, Project, ProjectSummary } from "@fp/types";
import { normalizePlanDocument } from "./document";

/** Error thrown when the projects API returns a non-OK status. */
export class ProjectsApiError extends Error {
  readonly status: number;

  /**
   * @param status - HTTP status
   * @param message - Human-readable message
   */
  constructor(status: number, message: string) {
    super(message);
    this.name = "ProjectsApiError";
    this.status = status;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * List all projects (metadata only).
 * @returns Project summaries newest-first
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    throw new ProjectsApiError(res.status, `List projects failed (${res.status})`);
  }
  const data = await parseJson<ProjectSummary[]>(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Load a full project by id.
 * @param id - Project UUID
 * @returns Full project with document
 */
export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new ProjectsApiError(res.status, `Get project failed (${res.status})`);
  }
  const data = (await parseJson<Project>(res)) as Project;
  return {
    ...data,
    document: normalizePlanDocument(data.document),
  };
}

/**
 * Create a new empty project.
 * @param name - Optional display name
 * @returns Created project
 */
export async function createProject(name?: string): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!res.ok) {
    throw new ProjectsApiError(
      res.status,
      `Create project failed (${res.status})`
    );
  }
  const data = (await parseJson<Project>(res)) as Project;
  return {
    ...data,
    document: normalizePlanDocument(data.document),
  };
}

/**
 * Update project name and/or document.
 * @param id - Project UUID
 * @param patch - Fields to update
 * @returns Updated project
 */
export async function updateProject(
  id: string,
  patch: { name?: string; document?: PlanDocument }
): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new ProjectsApiError(
      res.status,
      `Update project failed (${res.status})`
    );
  }
  const data = (await parseJson<Project>(res)) as Project;
  return {
    ...data,
    document: normalizePlanDocument(data.document),
  };
}

/**
 * Duplicate a project (new id, name with " (copy)").
 * @param id - Source project UUID
 * @returns Cloned project
 */
export async function duplicateProject(id: string): Promise<Project> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(id)}/duplicate`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new ProjectsApiError(
      res.status,
      `Duplicate project failed (${res.status})`
    );
  }
  const data = (await parseJson<Project>(res)) as Project;
  return {
    ...data,
    document: normalizePlanDocument(data.document),
  };
}

/**
 * Delete a project.
 * @param id - Project UUID
 */
export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new ProjectsApiError(
      res.status,
      `Delete project failed (${res.status})`
    );
  }
}
