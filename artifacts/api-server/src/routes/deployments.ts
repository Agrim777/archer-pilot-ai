import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, deployments, projects } from "@workspace/db";
import { StartDeploymentBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parseId } from "../lib/parseId";

/**
 * SAFETY POLICY: All deployments run in simulation mode only.
 * No API calls are ever made to a live Archer instance from this service.
 * The archerClient exists for reference but is never invoked here.
 */

const router = Router();

const DEPLOYMENT_STEPS = [
  "Validating Project",
  "Creating Application",
  "Creating Modules",
  "Creating Value Lists",
  "Creating Fields",
  "Creating Cross References",
  "Creating Workflow",
  "Creating Record Permissions",
  "Creating Notifications",
  "Finalizing Plan",
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

// ── Simulation (the only deployment mode) ────────────────────────────────────

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
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
      steps[i] = { ...steps[i], status: "completed", message: "Simulated — no changes made to Archer" };
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

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /deployments
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

// POST /deployments
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

    // Always simulate — never touch a live Archer instance
    runSimulatedDeployment(deployment.id, parsed.data.projectId).catch(console.error);

    res.status(201).json(deployment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to start deployment" });
  }
});

// GET /deployments/:id
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
