import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";

/**
 * Admin authorization middleware.
 * Reads ADMIN_USER_IDS env var (comma-separated Clerk user IDs).
 * If the variable is empty or unset, all admin access is denied.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const userId = (req as AuthenticatedRequest).userId;

  if (!userId || !adminIds.includes(userId)) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
}
