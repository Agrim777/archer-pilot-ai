import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, deployments, projects, archerConnections } from "@workspace/db";
import { StartDeploymentBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parseId } from "../lib/parseId";
import { deployToArcher } from "../lib/archerClient";

/**
 * Deployment safety contract:
 *   - archerClient ONLY calls POST to create NEW objects.
 *   - It never calls PUT / PATCH / DELETE on anything that already exists.
 *   - Existing applications, fields, workflows are completely untouched.
 */

const router = Router();

const DEPLOYMENT_STEPS = [
  "Login",
  "Version Check",
  "Creating Application",
  "Creating Modules",
  "Creating Value Lists",
  "Creating Fields",
  "Creating Cross References",
  "Creating Workflow",
  "Creating Record Permissions",
  "Creating Notifications",
  "Finalizing Deployment",
];

type StepStatus = "pending" | "running" | "completed" | "warning" | "failed";

interface StepRow {
  name: string;
  status: StepStatus;
  message: string | null;
}

async function persistSteps(deploymentId: number, steps: StepRow[]) {
  await db
    .update(deployments)
    .set({ steps, updatedAt: new Date() })
    .where(eq(deployments.id, deploymentId));
}

// ── Dry-run simulation (no connection needed) ─────────────────────────────────

async function runSimulatedDeployment(deploymentId: number, projectId: number) {
  const steps: StepRow[] = DEPLOYMENT_STEPS.map((name) => ({
    name,
    status: "pending",
    message: null,
  }));

  try {
    await db
      .update(deployments)
      .set({ status: "running", steps, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));

    for (let i = 0; i < DEPLOYMENT_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      steps[i] = { ...steps[i], status: "completed", message: "Dry run — no changes made to Archer" };
      await persistSteps(deploymentId, steps);
    }

    await db
      .update(deployments)
      .set({ status: "simulated", steps, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));

    await db
      .update(projects)
      .set({ status: "deployed", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(deployments)
      .set({ status: "failed", error: errMsg, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));
  }
}

// ── Real Archer deployment ────────────────────────────────────────────────────

async function runRealDeployment(
  deploymentId: number,
  projectId: number,
  connection: {
    url: string;
    username: string;
    credential: string;
    tenantName: string | null;
  },
  content: any
) {
  const steps: StepRow[] = DEPLOYMENT_STEPS.map((name) => ({
    name,
    status: "pending",
    message: null,
  }));

  await db
    .update(deployments)
    .set({ status: "running", steps, updatedAt: new Date() })
    .where(eq(deployments.id, deploymentId));

  const onStep = async (stepName: string, message: string, status?: "ok" | "warn") => {
    const idx = steps.findIndex((s) => s.name === stepName);
    if (idx === -1) return;

    // Close any previous running step
    const prevIdx = steps.findIndex((s) => s.status === "running");
    if (prevIdx !== -1 && prevIdx !== idx) {
      steps[prevIdx].status = "completed";
    }

    steps[idx] = {
      name: stepName,
      status: status === "warn" ? "warning" : status === "ok" ? "completed" : "running",
      message,
    };
    await persistSteps(deploymentId, steps);
  };

  try {
    const result = await deployToArcher(
      connection.url,
      connection.username,
      connection.credential,
      connection.tenantName ?? "Default",
      content,
      onStep
    );

    // Mark any remaining pending steps as skipped
    for (const step of steps) {
      if (step.status === "pending") {
        step.status = "completed";
        step.message = "Skipped";
      }
    }

    const warnings =
      result.warnings.length > 0
        ? `Warnings (${result.warnings.length}): ${result.warnings.join(" | ")}`
        : null;

    await db
      .update(deployments)
      .set({ status: "completed", steps, error: warnings, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));

    await db
      .update(projects)
      .set({ status: "deployed", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    const runningIdx = steps.findIndex((s) => s.status === "running");
    if (runningIdx !== -1) {
      steps[runningIdx].status = "failed";
      steps[runningIdx].message = errMsg;
    }

    await db
      .update(deployments)
      .set({ status: "failed", steps, error: errMsg, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/deployments", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select()
      .from(deployments)
      .where(eq(deployments.userId, r.userId))
      .orderBy(desc(deployments.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list deployments" });
  }
});

router.post("/deployments", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const parsed = StartDeploymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, r.userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // If real deployment requested, validate the connection exists before inserting
    let conn: typeof archerConnections.$inferSelect | undefined;
    if (parsed.data.connectionId && parsed.data.simulate !== true) {
      const [found] = await db
        .select()
        .from(archerConnections)
        .where(
          and(
            eq(archerConnections.id, parsed.data.connectionId),
            eq(archerConnections.userId, r.userId)
          )
        );
      if (!found) {
        res.status(404).json({ error: "Archer connection not found" });
        return;
      }
      conn = found;
    }

    const initialSteps = DEPLOYMENT_STEPS.map((name) => ({
      name,
      status: "pending" as StepStatus,
      message: null,
    }));

    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: parsed.data.projectId,
        userId: r.userId,
        status: "pending",
        steps: initialSteps,
        connectionId: parsed.data.connectionId ?? null,
      })
      .returning();

    if (conn) {
      // Real deployment — creates brand-new application in Archer, never touches existing ones
      runRealDeployment(deployment.id, parsed.data.projectId, conn, project.content).catch(
        console.error
      );
    } else {
      // Dry run — no network calls to Archer
      runSimulatedDeployment(deployment.id, parsed.data.projectId).catch(console.error);
    }

    res.status(201).json(deployment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to start deployment" });
  }
});

router.get("/deployments/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(and(eq(deployments.id, id), eq(deployments.userId, r.userId)));

    if (!deployment) {
      res.status(404).json({ error: "Deployment not found" });
      return;
    }
    res.json(deployment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get deployment" });
  }
});

export default router;
