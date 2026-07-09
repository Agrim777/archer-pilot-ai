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

/**
 * Build a step-by-step manual build guide, ordered to match RSA Archer's
 * Application Builder wizard exactly, so a human can click through it in
 * ~15-20 minutes instead of designing the app from scratch. This is the
 * reliable fallback for Archer versions (like 6.15) whose REST API does not
 * expose creation endpoints for application structure.
 */
function buildApplicationBuilderGuide(projectName: string, content: Record<string, unknown> | null): string {
  const impl = content ?? {};
  const modules = Array.isArray(impl.modules) ? (impl.modules as any[]) : [];
  const fields = Array.isArray(impl.fields) ? (impl.fields as any[]) : [];
  const valueLists = Array.isArray(impl.valueLists) ? (impl.valueLists as any[]) : [];
  const crossRefs = Array.isArray(impl.crossReferences) ? (impl.crossReferences as any[]) : [];
  const workflow = (impl.workflow ?? {}) as any;
  const permissions = Array.isArray(impl.recordPermissions) ? (impl.recordPermissions as any[]) : [];
  const notifications = Array.isArray(impl.notifications) ? (impl.notifications as any[]) : [];
  const reports = Array.isArray(impl.reports) ? (impl.reports as any[]) : [];
  const dashboards = Array.isArray(impl.dashboards) ? (impl.dashboards as any[]) : [];

  const md: string[] = [];
  const h = (n: number, t: string) => md.push(`${"#".repeat(n)} ${t}`, "");
  const li = (t: string) => md.push(`- ${t}`);

  h(1, `${projectName} — Archer Application Builder Guide`);
  md.push(
    "> Follow these steps in order inside **Archer → Manage → Application Builder**.",
    "> Each section matches a screen in the Application Builder wizard, so you can build this application manually in one pass.",
    ""
  );

  if (impl.businessOverview) {
    h(2, "Business Overview");
    md.push(String(impl.businessOverview), "");
  }
  if (Array.isArray(impl.useCases) && impl.useCases.length) {
    h(2, "Use Cases");
    (impl.useCases as string[]).forEach((uc) => li(uc));
    md.push("");
  }

  h(2, "Step 1 — Create the Application");
  md.push(
    "In **Application Builder → Manage Applications → Add New → Application**, enter:",
    ""
  );
  li(`**Name:** ${projectName}`);
  if (impl.applicationStructure && typeof impl.applicationStructure === "object") {
    for (const [k, v] of Object.entries(impl.applicationStructure as Record<string, unknown>)) {
      if (v != null && typeof v !== "object") li(`**${k}:** ${v}`);
    }
  }
  md.push("");

  if (modules.length) {
    h(2, "Step 2 — Create Levels / Modules");
    md.push("For each level below, use **Manage → Levels → Add New Level**:", "");
    modules.forEach((m, i) => {
      md.push(`${i + 1}. **${m.name ?? `Level ${i + 1}`}**${m.description ? ` — ${m.description}` : ""}`);
    });
    md.push("");
  }

  if (valueLists.length) {
    h(2, "Step 3 — Create Value Lists");
    md.push("In **Manage → Values Lists → Add New**, create these before adding fields that reference them:", "");
    valueLists.forEach((vl) => {
      md.push(`**${vl.name ?? "Unnamed Value List"}**`);
      const values = Array.isArray(vl.values) ? vl.values : Array.isArray(vl.options) ? vl.options : [];
      values.forEach((v: any) => li(typeof v === "string" ? v : v?.name ?? JSON.stringify(v)));
      md.push("");
    });
  }

  if (fields.length) {
    h(2, "Step 4 — Add Fields");
    md.push("In the target level's **Manage Fields** screen, add these fields in order (this also determines the Layout tab order):", "");
    md.push("| # | Field Name | Type | Value List | Required |", "|---|---|---|---|---|");
    fields.forEach((f, i) => {
      md.push(
        `| ${i + 1} | ${f.name ?? "—"} | ${f.type ?? "Text"} | ${f.valueList ?? f.valuesList ?? "—"} | ${f.required ? "Yes" : "No"} |`
      );
    });
    md.push("");
  }

  if (crossRefs.length) {
    h(2, "Step 5 — Cross-References");
    md.push("Both target applications must already exist before adding these. In **Manage Fields → Add New → Cross-Reference**:", "");
    crossRefs.forEach((cr) => {
      li(`**${cr.name ?? "Cross-Reference"}** → target application: ${cr.targetApplication ?? cr.target ?? "—"}${cr.description ? ` (${cr.description})` : ""}`);
    });
    md.push("");
  }

  if (workflow && (workflow.stages || workflow.name)) {
    h(2, "Step 6 — Workflow (Workflow Manager)");
    md.push("Open **Manage → Workflow → Create New Workflow** and add these stages in order:", "");
    const stages = Array.isArray(workflow.stages) ? workflow.stages : [];
    stages.forEach((s: any, i: number) => {
      md.push(`${i + 1}. **${typeof s === "string" ? s : s.name ?? `Stage ${i + 1}`}**${typeof s === "object" && s.description ? ` — ${s.description}` : ""}`);
    });
    md.push("", "Attach the workflow to the application under **Application Properties → Workflow**.", "");
  }

  if (permissions.length) {
    h(2, "Step 7 — Record Permissions");
    md.push("In **Manage → Access Roles**, create/assign these roles:", "");
    permissions.forEach((p) => {
      li(`**${p.group ?? p.role ?? "Group"}** — ${p.access ?? p.permissions ?? p.description ?? "Access as specified"}`);
    });
    md.push("");
  }

  if (notifications.length) {
    h(2, "Step 8 — Notifications");
    md.push("In **Manage → Notifications → Add New**, create these rules:", "");
    notifications.forEach((n) => {
      li(`**${n.name ?? "Notification"}** — trigger: ${n.trigger ?? n.event ?? "—"}, recipients: ${n.recipients ?? "—"}`);
    });
    md.push("");
  }

  if (reports.length) {
    h(2, "Step 9 — Reports");
    reports.forEach((r) => li(`**${r.name ?? "Report"}**${r.description ? ` — ${r.description}` : ""}`));
    md.push("");
  }

  if (dashboards.length) {
    h(2, "Step 10 — Dashboards");
    dashboards.forEach((d) => li(`**${d.name ?? "Dashboard"}**${d.description ? ` — ${d.description}` : ""}`));
    md.push("");
  }

  md.push("---", `_Generated by ArcherPilot AI — designed to be built manually in Archer Application Builder, no trace of AI in the final application._`);
  return md.join("\n");
}

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
        exportContent = buildApplicationBuilderGuide(project.name, content);
        filename += "_build_guide.md";
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
