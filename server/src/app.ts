/**
 * Hono HTTP app for local project CRUD (Prisma).
 */

import { Hono } from "hono";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./db.js";
import {
  emptyPlanDocument,
  normalizePlanDocument,
  type PlanDocument,
  type Project,
  type ProjectSummary,
} from "./types.js";

function toSummary(row: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProject(row: {
  id: string;
  name: string;
  document: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  return {
    ...toSummary(row),
    document: normalizePlanDocument(row.document),
  };
}

/** Build the Hono app (no listen). */
export function createApp(): Hono {
  const app = new Hono();

  app.get("/api/health", async (c) => {
    let db = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return c.json({ ok: true, db }, db ? 200 : 503);
  });

  app.get("/api/projects", async (c) => {
    const rows = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    return c.json(rows.map(toSummary));
  });

  app.get("/api/projects/:id", async (c) => {
    const id = c.req.param("id");
    const row = await prisma.project.findUnique({ where: { id } });
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(toProject(row));
  });

  app.post("/api/projects", async (c) => {
    let body: { name?: string; document?: unknown } = {};
    try {
      body = (await c.req.json()) as { name?: string; document?: unknown };
    } catch {
      body = {};
    }
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Untitled project";
    const document: PlanDocument = body.document
      ? normalizePlanDocument(body.document)
      : emptyPlanDocument();

    const row = await prisma.project.create({
      data: {
        name,
        document: document as unknown as Prisma.InputJsonValue,
      },
    });
    return c.json(toProject(row), 201);
  });

  app.put("/api/projects/:id", async (c) => {
    const id = c.req.param("id");
    let body: { name?: string; document?: unknown } = {};
    try {
      body = (await c.req.json()) as { name?: string; document?: unknown };
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const document =
      body.document !== undefined
        ? normalizePlanDocument(body.document)
        : normalizePlanDocument(existing.document);

    const row = await prisma.project.update({
      where: { id },
      data: {
        name,
        document: document as unknown as Prisma.InputJsonValue,
      },
    });
    return c.json(toProject(row));
  });

  app.post("/api/projects/:id/duplicate", async (c) => {
    const id = c.req.param("id");
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const document = normalizePlanDocument(existing.document);
    const row = await prisma.project.create({
      data: {
        name: `${existing.name} (copy)`,
        document: document as unknown as Prisma.InputJsonValue,
      },
    });
    return c.json(toProject(row), 201);
  });

  app.delete("/api/projects/:id", async (c) => {
    const id = c.req.param("id");
    try {
      await prisma.project.delete({ where: { id } });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });

  app.get("/api/projects/:id/export", async (c) => {
    const id = c.req.param("id");
    const row = await prisma.project.findUnique({ where: { id } });
    if (!row) return c.json({ error: "Not found" }, 404);
    const doc = normalizePlanDocument(row.document);
    return c.json({
      name: row.name,
      exportedAt: new Date().toISOString(),
      groups: doc.groups,
      objects: doc.objects,
      labelOffsets: doc.labelOffsets,
    });
  });

  return app;
}
