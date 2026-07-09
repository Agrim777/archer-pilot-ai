import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, archerConnections } from "@workspace/db";
import {
  CreateArcherConnectionBody,
  UpdateArcherConnectionBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { parseId } from "../lib/parseId";
import { archerLogin, archerLogout, getArcherVersion, normalizeArcherBaseUrl } from "../lib/archerClient";

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
      .values({
        ...parsed.data,
        url: normalizeArcherBaseUrl(parsed.data.url),
        userId: r.userId,
      })
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
    const normalized = { ...parsed.data };
    if (normalized.url) normalized.url = normalizeArcherBaseUrl(normalized.url);
    const [updated] = await db
      .update(archerConnections)
      .set({ ...normalized, updatedAt: new Date() })
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

    // Attempt real connection using the proper /platformapi/core/ path.
    // A 10 s deadline prevents stalled TCP connections from hanging the route.
    const TIMEOUT_MS = 10_000;

    type TestResult =
      | { kind: "ok"; version: string }
      | { kind: "timeout" }
      | { kind: "network_error"; message: string }
      | { kind: "auth_error"; message: string };

    const raceResult: TestResult = await Promise.race([
      (async (): Promise<TestResult> => {
        try {
          const token = await archerLogin(
            conn.url,
            conn.username,
            conn.credential,
            conn.tenantName ?? "Default"
          );
          const version = await getArcherVersion(conn.url, token);
          await archerLogout(conn.url, token);
          return { kind: "ok", version };
        } catch (err: any) {
          const code = err?.cause?.code ?? err?.code ?? "";
          const isNetwork = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(code);
          if (isNetwork) {
            return {
              kind: "network_error",
              message: `Cannot reach ${conn.url} (${code}). Check the URL and network access.`,
            };
          }
          return {
            kind: "auth_error",
            message: err.message ?? "Invalid credentials or instance name",
          };
        }
      })(),
      new Promise<{ kind: "timeout" }>((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), TIMEOUT_MS)
      ),
    ]);

    if (raceResult.kind === "timeout") {
      res.json({
        success: false,
        message: "Connection timed out",
        details: `No response from ${conn.url} within ${TIMEOUT_MS / 1000}s. Check the URL and network access.`,
      });
      return;
    }

    if (raceResult.kind === "network_error") {
      res.json({ success: false, message: "Archer endpoint not reachable", details: raceResult.message });
      return;
    }

    if (raceResult.kind === "auth_error") {
      res.json({ success: false, message: "Authentication failed", details: raceResult.message });
      return;
    }

    res.json({
      success: true,
      message: "Connection successful",
      details: `Logged in as ${conn.username}. Archer version: ${raceResult.version}`,
      version: raceResult.version,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to test connection" });
  }
});

export default router;
