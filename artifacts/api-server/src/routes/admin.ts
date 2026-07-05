import { Router } from "express";
import { desc, sql } from "drizzle-orm";
import { db, projects, deployments, apiLogs } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/adminAuth";

const router = Router();

// GET /admin/users
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db
      .select({
        userId: projects.userId,
        projectCount: sql<number>`count(distinct ${projects.id})::int`,
        deploymentCount: sql<number>`(select count(*) from deployments where user_id = ${projects.userId})::int`,
        lastActive: sql<string>`max(${projects.updatedAt})`,
      })
      .from(projects)
      .groupBy(projects.userId)
      .orderBy(desc(sql`max(${projects.updatedAt})`));

    res.json(
      users.map((u) => ({
        userId: u.userId,
        email: null,
        projectCount: u.projectCount,
        deploymentCount: u.deploymentCount,
        lastActive: u.lastActive,
      })),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// GET /admin/analytics
router.get("/admin/analytics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [totals] = await db.select({
      totalProjects: sql<number>`count(*)::int`,
    }).from(projects);

    const [deploymentTotals] = await db.select({
      totalDeployments: sql<number>`count(*)::int`,
    }).from(deployments);

    const [userCount] = await db.select({
      totalUsers: sql<number>`count(distinct user_id)::int`,
    }).from(projects);

    // Projects created per day (last 14 days)
    const projectsPerDay = await db
      .select({
        date: sql<string>`date_trunc('day', created_at)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(projects)
      .where(sql`created_at >= now() - interval '14 days'`)
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    const deploymentsPerDay = await db
      .select({
        date: sql<string>`date_trunc('day', created_at)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(deployments)
      .where(sql`created_at >= now() - interval '14 days'`)
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    res.json({
      totalUsers: userCount?.totalUsers ?? 0,
      totalProjects: totals?.totalProjects ?? 0,
      totalDeployments: deploymentTotals?.totalDeployments ?? 0,
      projectsPerDay,
      deploymentsPerDay,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

// GET /admin/logs
router.get("/admin/logs", requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "100", 10), 500);

  try {
    const logs = await db
      .select()
      .from(apiLogs)
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit);

    res.json(logs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list logs" });
  }
});

export default router;
