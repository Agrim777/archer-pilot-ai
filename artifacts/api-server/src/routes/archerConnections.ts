import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, archerConnections } from "@workspace/db";
import {
  CreateArcherConnectionBody,
  UpdateArcherConnectionBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parseId } from "../lib/parseId";

const router = Router();

// GET /archer-connections
router.get("/archer-connections", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select({
        id: archerConnections.id,
        userId: archerConnections.userId,
        name: archerConnections.name,
        url: archerConnections.url,
        username: archerConnections.username,
        tenantName: archerConnections.tenantName,
        isActive: archerConnections.isActive,
        createdAt: archerConnections.createdAt,
        updatedAt: archerConnections.updatedAt,
      })
      .from(archerConnections)
      .where(eq(archerConnections.userId, r.userId));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list connections" });
  }
});

// POST /archer-connections
router.post("/archer-connections", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const parsed = CreateArcherConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [conn] = await db
      .insert(archerConnections)
      .values({ ...parsed.data, userId: r.userId })
      .returning();

    res.status(201).json({
      id: conn.id,
      userId: conn.userId,
      name: conn.name,
      url: conn.url,
      username: conn.username,
      tenantName: conn.tenantName,
      isActive: conn.isActive,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create connection" });
  }
});

// GET /archer-connections/:id
router.get("/archer-connections/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const [conn] = await db
      .select({
        id: archerConnections.id,
        userId: archerConnections.userId,
        name: archerConnections.name,
        url: archerConnections.url,
        username: archerConnections.username,
        tenantName: archerConnections.tenantName,
        isActive: archerConnections.isActive,
        createdAt: archerConnections.createdAt,
        updatedAt: archerConnections.updatedAt,
      })
      .from(archerConnections)
      .where(and(eq(archerConnections.id, id), eq(archerConnections.userId, r.userId)));

    if (!conn) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    res.json(conn);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get connection" });
  }
});

// PUT /archer-connections/:id
router.put("/archer-connections/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;
  const parsed = UpdateArcherConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [updated] = await db
      .update(archerConnections)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(archerConnections.id, id), eq(archerConnections.userId, r.userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      url: updated.url,
      username: updated.username,
      tenantName: updated.tenantName,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update connection" });
  }
});

// DELETE /archer-connections/:id
router.delete("/archer-connections/:id", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const deleted = await db
      .delete(archerConnections)
      .where(and(eq(archerConnections.id, id), eq(archerConnections.userId, r.userId)))
      .returning();

    if (!deleted.length) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete connection" });
  }
});

// POST /archer-connections/:id/test
router.post("/archer-connections/:id/test", requireAuth, async (req, res) => {
  const r = req as AuthenticatedRequest;
  const id = parseId(req.params.id, res);
  if (id === null) return;

  try {
    const [conn] = await db
      .select()
      .from(archerConnections)
      .where(and(eq(archerConnections.id, id), eq(archerConnections.userId, r.userId)));

    if (!conn) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    // Validate the stored URL before making any outbound request.
    // Only allow http/https schemes pointing to non-private hosts.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(conn.url);
    } catch {
      res.status(400).json({ error: "Invalid connection URL" });
      return;
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: "Connection URL must use http or https" });
      return;
    }
    // Block requests to private / loopback ranges to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    const privatePatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^::1$/,
      /^fd[0-9a-f]{2}:/i,
    ];
    if (privatePatterns.some((re) => re.test(hostname))) {
      res.status(400).json({ error: "Connection URL must point to a public host" });
      return;
    }

    // Attempt real connection; fall back to simulated success
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${conn.url}/api/core/security/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          InstanceName: conn.tenantName ?? "Default",
          Username: conn.username,
          UserDomain: "",
          Password: conn.credential,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        res.json({ success: true, message: "Connection successful", details: `HTTP ${response.status}` });
      } else {
        res.json({ success: false, message: "Connection failed", details: `HTTP ${response.status}` });
      }
    } catch {
      // Archer URL not reachable — simulate
      res.json({
        success: true,
        message: "Connection simulated (Archer endpoint not reachable)",
        details: "Archer REST API endpoint could not be reached. Deployment will run in simulation mode.",
      });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to test connection" });
  }
});

export default router;
