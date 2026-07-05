import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app = express();

app.use(pinoHttp({ logger }));

// Clerk proxy must be mounted before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS — allow same-origin, server-to-server (no origin), and known hosting domains.
// Never use origin:true with credentials — that reflects ANY origin and enables CSRF.
const ALLOWED_ORIGIN_RE =
  /^https?:\/\/(?:localhost(?::\d+)?|(?:[\w-]+\.)?(?:replit\.(?:app|dev|com)|railway\.app|up\.railway\.app))(?::\d+)?$/;

// Also allow any explicit CORS_ORIGIN env var (set this to your custom domain on Railway).
const EXTRA_ORIGIN = process.env.CORS_ORIGIN;

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-to-server / same-origin
      if (ALLOWED_ORIGIN_RE.test(origin)) return callback(null, true);
      if (EXTRA_ORIGIN && origin === EXTRA_ORIGIN) return callback(null, true);
      callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// In production, serve the built React frontend as static files.
// The frontend is built to artifacts/archer-pilot/dist/public by `pnpm run build`.
if (process.env.NODE_ENV === "production") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Relative to dist/index.mjs → ../../archer-pilot/dist/public
  const frontendDist = join(__dirname, "..", "..", "archer-pilot", "dist", "public");
  app.use(express.static(frontendDist));
  // SPA fallback — all non-API routes serve index.html
  app.get("*", (_req, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

export default app;
