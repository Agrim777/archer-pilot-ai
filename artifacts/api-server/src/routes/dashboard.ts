import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, projects, deployments } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// GET /dashboard/stats
router.get("/dashboard/stats", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;

  try {
    const [projectStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        draft: sql<number>`count(*) filter (where status = 'draft')::int`,
        deployed: sql<number>`count(*) filter (where status = 'deployed')::int`,
      })
      .from(projects)
      .where(eq(projects.userId, r.userId));

    const [deploymentStats] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(deployments)
      .where(eq(deployments.userId, r.userId));

    // Recent activity: last 10 items across projects and deployments
    const recentProjects = await db
      .select({
        id: projects.id,
        type: sql<string>`'project'`,
        title: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.userId, r.userId))
      .orderBy(desc(projects.updatedAt))
      .limit(5);

    const recentDeployments = await db
      .select({
        id: deployments.id,
        type: sql<string>`'deployment'`,
        title: sql<string>`'Deployment #' || ${deployments.id}`,
        description: deployments.status,
        createdAt: deployments.createdAt,
      })
      .from(deployments)
      .where(eq(deployments.userId, r.userId))
      .orderBy(desc(deployments.createdAt))
      .limit(5);

    const recentActivity = [...recentProjects, ...recentDeployments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const totalProjects = projectStats?.total ?? 0;
    const totalDeployments = deploymentStats?.total ?? 0;
    // Estimated hours saved: 40h per project (manual Archer implementation average)
    const savedHours = totalProjects * 40 + totalDeployments * 8;

    res.json({
      totalProjects,
      totalDeployments,
      savedHours,
      draftProjects: projectStats?.draft ?? 0,
      deployedProjects: projectStats?.deployed ?? 0,
      recentActivity,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

export default router;
