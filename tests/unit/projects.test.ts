/**
 * Unit tests for @fp/projects (document helpers + API client).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPlanDocument,
  createProject,
  emptyPlanDocument,
  isProjectId,
  isProjectsListPath,
  listProjects,
  normalizePlanDocument,
  parseProjectIdFromPath,
  planDocumentToExport,
  projectPath,
  PROJECTS_LIST_PATH,
  ProjectsApiError,
} from "@fp/projects";
import type { PlanObject } from "@fp/types";

const sampleObject = {
  id: "floor-1",
  type: "floor",
  name: "Room",
  notes: "",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  labelRotation: 0,
  visible: true,
  locked: false,
  groupId: null,
  opacity: 1,
  showDimensions: false,
  dimOffW: { x: 0, y: 0 },
  dimOffH: { x: 0, y: 0 },
} as PlanObject;

describe("emptyPlanDocument / normalizePlanDocument", () => {
  it("returns a stable empty document", () => {
    const doc = emptyPlanDocument();
    expect(doc.objects).toEqual([]);
    expect(doc.groups).toEqual([]);
    expect(doc.groupSeq).toBe(1);
    expect(doc.labelOffsets).toEqual({});
    expect(doc.showDimensionsGlobal).toBe(false);
  });

  it("fills defaults for malformed input", () => {
    expect(normalizePlanDocument(null).objects).toEqual([]);
    expect(normalizePlanDocument({ objects: "nope" }).objects).toEqual([]);
    const doc = normalizePlanDocument({
      objects: [sampleObject],
      groups: [{ id: "g1", name: "A", collapsed: false }],
      groupSeq: 3,
      labelOffsets: { "floor-1": { w: { x: 1, y: 2 }, h: { x: 0, y: 0 }, n: { x: 0, y: 0 } } },
      showDimensionsGlobal: true,
      zoom: 0.5,
    });
    expect(doc.objects).toHaveLength(1);
    expect(doc.groupSeq).toBe(3);
    expect(doc.showDimensionsGlobal).toBe(true);
    expect(doc.zoom).toBe(0.5);
  });
});

describe("buildPlanDocument", () => {
  it("clones source fields without selection", () => {
    const objects = [sampleObject];
    const doc = buildPlanDocument({
      objects,
      groups: [],
      groupSeq: 2,
      labelOffsets: {},
      showDimensionsGlobal: true,
      zoom: 0.3,
      panX: 10,
      panY: 20,
    });
    expect(doc.objects).toEqual(objects);
    expect(doc.objects).not.toBe(objects);
    expect(doc.groupSeq).toBe(2);
    expect(doc.zoom).toBe(0.3);
    expect(doc.panX).toBe(10);
    expect(doc.panY).toBe(20);
    expect(doc).not.toHaveProperty("selectedId");
  });

  it("clones Alpine-like Proxy arrays (structuredClone cannot)", () => {
    const objects = new Proxy([sampleObject], {
      get(t, p, r) {
        return Reflect.get(t, p, r);
      },
    });
    const doc = buildPlanDocument({
      objects: objects as PlanObject[],
      groups: [],
      groupSeq: 1,
      labelOffsets: {},
      showDimensionsGlobal: false,
    });
    expect(doc.objects).toHaveLength(1);
    expect(doc.objects[0].id).toBe("floor-1");
  });
});

describe("planDocumentToExport", () => {
  it("embeds dim offsets from labelOffsets", () => {
    const doc = buildPlanDocument({
      objects: [sampleObject],
      groups: [],
      groupSeq: 1,
      labelOffsets: {
        "floor-1": {
          w: { x: 5, y: 6 },
          h: { x: 7, y: 8 },
          n: { x: 1, y: 2 },
        },
      },
      showDimensionsGlobal: false,
    });
    const exp = planDocumentToExport("Test Plan", doc);
    expect(exp.name).toBe("Test Plan");
    expect(exp.exportedAt).toMatch(/^\d{4}-/);
    expect(exp.objects[0].dimOffW).toEqual({ x: 5, y: 6 });
    expect(exp.objects[0].dimOffN).toEqual({ x: 1, y: 2 });
  });
});

describe("project routes", () => {
  const id = "b2f7b35a-9ad6-4747-a7ed-25c5d8397db6";

  it("builds /projects/:uuid paths", () => {
    expect(projectPath(id)).toBe(`/projects/${id}`);
    expect(PROJECTS_LIST_PATH).toBe("/");
  });

  it("parses project ids from pathnames", () => {
    expect(parseProjectIdFromPath(`/projects/${id}`)).toBe(id);
    expect(parseProjectIdFromPath(`/projects/${id}/`)).toBe(id);
    expect(parseProjectIdFromPath(`/projects/${id.toUpperCase()}`)).toBe(
      id.toUpperCase()
    );
    expect(parseProjectIdFromPath("/projects/not-a-uuid")).toBeNull();
    expect(parseProjectIdFromPath("/")).toBeNull();
    expect(parseProjectIdFromPath("/projects")).toBeNull();
  });

  it("validates UUID shape", () => {
    expect(isProjectId(id)).toBe(true);
    expect(isProjectId("nope")).toBe(false);
  });

  it("detects list paths", () => {
    expect(isProjectsListPath("/")).toBe(true);
    expect(isProjectsListPath("/projects")).toBe(true);
    expect(isProjectsListPath(`/projects/${id}`)).toBe(false);
  });
});

describe("API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("listProjects returns parsed summaries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify([
            {
              id: "a",
              name: "One",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ]),
      })
    );
    const list = await listProjects();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("One");
    expect(fetch).toHaveBeenCalledWith("/api/projects");
  });

  it("createProject posts and normalizes document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "new",
            name: "Untitled project",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            document: {},
          }),
      })
    );
    const project = await createProject();
    expect(project.id).toBe("new");
    expect(project.document.objects).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws ProjectsApiError on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "",
      })
    );
    await expect(listProjects()).rejects.toBeInstanceOf(ProjectsApiError);
  });
});
