import type { Response } from "express";

/**
 * Parse a route :id param into a positive integer.
 * Sends a 400 response and returns null if the param is invalid.
 */
export function parseId(
  raw: unknown,
  res: Response,
  label = "id",
): number | null {
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    res.status(400).json({ error: `Invalid ${label}: must be a positive integer` });
    return null;
  }
  return n;
}
