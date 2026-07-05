import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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

// Restrict CORS to trusted Replit origins only — never reflect arbitrary origins
// with credentials enabled, as that would allow cross-origin authenticated reads.
const ALLOWED_ORIGIN_RE = /^https?:\/\/(?:localhost(?::\d+)?|(?:[\w-]+\.)?replit\.(?:app|dev|com)(?::\d+)?)$/;
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow server-to-server (no origin) and same-origin requests
      if (!origin || ALLOWED_ORIGIN_RE.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS: origin not allowed"));
      }
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

export default app;
