import { Router } from "express";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { db, projects, projectVersions } from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  ExportProjectBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parseId } from "../lib/parseId";

const router = Router();

// GET /projects
router.get("/projects", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const { status, search } = req.query as { status?: string; search?: string };

  try {
    const conditions = [eq(projects.userId, r.userId)];
    if (status) conditions.push(eq(projects.status, status));
    if (search) conditions.push(ilike(projects.name, `%${search}%`));

    const rows = await db
      .select({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        prompt: projects.prompt,
        content: projects.content,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        versionCount: sql<number>`(select count(*) from project_versions where project_id = ${projects.id})::int`,
      })
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /projects
router.post("/projects", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [project] = await db
      .insert(projects)
      .values({ ...parsed.data, userId: r.userId })
      .returning();

    res.status(201).json({ ...project, versionCount: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /projects/:id
router.get("/projects/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const [row] = await db
      .select({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        prompt: projects.prompt,
        content: projects.content,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        versionCount: sql<number>`(select count(*) from project_versions where project_id = ${projects.id})::int`,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)));

    if (!row) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get project" });
  }
});

// PUT /projects/:id
router.put("/projects/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)));
    if (!existing.length) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Save version before updating
    const currentVersionCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, id));

    if (parsed.data.content && existing[0].content) {
      await db.insert(projectVersions).values({
        projectId: id,
        versionNumber: (currentVersionCount[0]?.count ?? 0) + 1,
        content: existing[0].content as Record<string, unknown>,
      });
    }

    const [updated] = await db
      .update(projects)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)))
      .returning();

    const [{ vc }] = await db
      .select({ vc: sql<number>`count(*)::int` })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, id));

    res.json({ ...updated, versionCount: vc });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /projects/:id
router.delete("/projects/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const deleted = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)))
      .returning();

    if (!deleted.length) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// POST /projects/:id/duplicate
router.post("/projects/:id/duplicate", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const [original] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)));

    if (!original) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [copy] = await db
      .insert(projects)
      .values({
        userId: r.userId,
        name: `${original.name} (Copy)`,
        description: original.description,
        status: "draft",
        prompt: original.prompt,
        content: original.content as Record<string, unknown>,
      })
      .returning();

    res.status(201).json({ ...copy, versionCount: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to duplicate project" });
  }
});

// GET /projects/:id/versions
router.get("/projects/:id/versions", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const owner = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)));
    if (!owner.length) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const versions = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, id))
      .orderBy(desc(projectVersions.versionNumber));

    res.json(versions);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list versions" });
  }
});

// POST /projects/:id/export
router.post("/projects/:id/export", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const parsed = ExportProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, r.userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { format } = parsed.data;
    const content = project.content as Record<string, unknown> | null;

    let exportContent = "";
    let filename = `${project.name.replace(/\s+/g, "_")}`;
    let mimeType = "application/octet-stream";

    switch (format) {
      case "json":
        exportContent = JSON.stringify(content, null, 2);
        filename += ".json";
        mimeType = "application/json";
        break;
      case "archer-package":
        exportContent = JSON.stringify({ project: project.name, ...content }, null, 2);
        filename += "_archer_package.json";
        mimeType = "application/json";
        break;
      case "markdown": {
        const impl = content as Record<string, unknown> | null;
        const md = [`# ${project.name}`, "", `## Business Overview`, impl?.businessOverview ?? "", ""];
        if (Array.isArray(impl?.useCases)) {
          md.push("## Use Cases");
          (impl.useCases as string[]).forEach((uc) => md.push(`- ${uc}`));
          md.push("");
        }
        exportContent = md.join("\n");
        filename += ".md";
        mimeType = "text/markdown";
        break;
      }
      default:
        exportContent = JSON.stringify(content, null, 2);
        filename += ".json";
        mimeType = "application/json";
    }

    res.json({
      format,
      filename,
      content: Buffer.from(exportContent).toString("base64"),
      mimeType,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to export project" });
  }
});

export default router;
