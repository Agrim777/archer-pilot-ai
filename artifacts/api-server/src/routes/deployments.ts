import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, deployments, projects } from "@workspace/db";
import { StartDeploymentBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parseId } from "../lib/parseId";

const router = Router();

const DEPLOYMENT_STEPS = [
  "Creating Application",
  "Creating Modules",
  "Creating Fields",
  "Creating Value Lists",
  "Creating Cross References",
  "Creating Workflow",
  "Creating Record Permissions",
  "Creating Notifications",
  "Generating Reports",
  "Finalizing Deployment",
];

async function runSimulatedDeployment(deploymentId: number, projectId: number) {
  const initialSteps = DEPLOYMENT_STEPS.map((name) => ({
    name,
    status: "pending",
    message: null,
  }));

  try {
    // Mark running
    await db
      .update(deployments)
      .set({ status: "running", steps: initialSteps, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));

    for (let i = 0; i < DEPLOYMENT_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

      const updatedSteps = initialSteps.map((step, idx) => {
        if (idx < i) return { ...step, status: "completed", message: "Done" };
        if (idx === i) return { ...step, status: "running", message: "In progress..." };
        return step;
      });

      await db
        .update(deployments)
        .set({ steps: updatedSteps, updatedAt: new Date() })
        .where(eq(deployments.id, deploymentId));
    }

    const completedSteps = DEPLOYMENT_STEPS.map((name) => ({
      name,
      status: "completed",
      message: "Done",
    }));

    await db
      .update(deployments)
      .set({ status: "simulated", steps: completedSteps, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));

    // Only mark project as deployed after simulation succeeds
    await db
      .update(projects)
      .set({ status: "deployed", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  } catch (err) {
    // Persist failure state so the client can display the error
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(deployments)
      .set({ status: "failed", error: errMsg, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId));
  }
}

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
      status: "pending",
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

    // Run simulation when: no connection provided, OR simulate flag is explicitly true.
    // A real Archer connection is required for live deployment; for now, all deployments
    // run as simulation (real Archer REST API calls are a future step).
    const shouldSimulate = !parsed.data.connectionId || parsed.data.simulate !== false;
    if (shouldSimulate) {
      runSimulatedDeployment(deployment.id, parsed.data.projectId).catch(console.error);
    } else {
      // Real deployment path: connectionId is present and simulate is explicitly false.
      // Currently falls back to simulation until Archer REST API integration is complete.
      runSimulatedDeployment(deployment.id, parsed.data.projectId).catch(console.error);
    }

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
