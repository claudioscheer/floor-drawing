/**
 * Pure path helpers for project deep links.
 * Format: /projects/<uuid>
 */

/** Path for the projects list (home). */
export const PROJECTS_LIST_PATH = "/";

/** UUID v4 shape used by Postgres gen_random_uuid(). */
const PROJECT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a string is a project UUID.
 * @param value - Candidate id
 * @returns true when value looks like a UUID
 */
export function isProjectId(value: string): boolean {
  return PROJECT_UUID_RE.test(value);
}

/**
 * Build the editor path for a project.
 * @param id - Project UUID
 * @returns Pathname `/projects/<id>`
 */
export function projectPath(id: string): string {
  return `/projects/${encodeURIComponent(id)}`;
}

/**
 * Extract a project UUID from a pathname (or full path).
 * @param pathname - location.pathname or similar
 * @returns Project id or null when the path is not a project URL
 */
export function parseProjectIdFromPath(pathname: string): string | null {
  if (!pathname) return null;
  // Strip query/hash if a full URL path sneaks in
  const path = pathname.split("?")[0].split("#")[0];
  const match = path.match(/^\/projects\/([^/]+)\/?$/i);
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isProjectId(id) ? id : null;
}

/**
 * Whether the pathname is the projects list (home or bare /projects).
 * @param pathname - location.pathname
 * @returns true for list routes
 */
export function isProjectsListPath(pathname: string): boolean {
  const path = (pathname || "/").split("?")[0].split("#")[0];
  return path === "/" || path === "" || path === "/projects" || path === "/projects/";
}
