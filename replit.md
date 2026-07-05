# ArcherPilot AI

An AI-powered RSA Archer GRC implementation platform. Describe your GRC requirements in plain English, and AI generates the complete Archer application design (modules, fields, workflows, record permissions, reports, dashboards). Then deploy it directly to any Archer instance via REST API, or export as an Archer Package Manager file.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/archer-pilot run dev` — run the frontend (port 24403, preview path `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required Environment Variables

- `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- `GEMINI_API_KEY` — Google Gemini API key for AI generation
- `CLERK_SECRET_KEY` — Auto-provisioned by Replit Clerk integration
- `CLERK_PUBLISHABLE_KEY` — Auto-provisioned by Replit Clerk integration
- `VITE_CLERK_PUBLISHABLE_KEY` — Auto-provisioned by Replit Clerk integration

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18, Vite, Tailwind CSS v4, Framer Motion, Wouter router
- Auth: Clerk (Replit-managed, whitelabel)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Google Gemini (`gemini-2.5-flash`) — GEMINI_API_KEY required
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where Things Live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — DB schema (projects, projectVersions, archerConnections, deployments, apiLogs)
- `artifacts/api-server/src/routes/` — Express route handlers (ai, projects, archerConnections, deployments, dashboard, admin)
- `artifacts/archer-pilot/src/pages/` — Frontend pages (landing, dashboard, projects, project-new, project-detail, project-deploy, archer-connection, copilot, settings, admin)
- `artifacts/archer-pilot/src/App.tsx` — Clerk provider + Wouter router

## Architecture Decisions

- **AI generates JSON design, not code**: Gemini returns a structured `ArcherImplementation` JSON (modules, fields, workflow, etc.) which is stored in the `projects.content` column.
- **Deployment is simulated by default**: When no Archer connection is provided, `deployments.ts` runs a simulated multi-step deployment that updates step statuses with realistic timing. Real Archer REST API calls are the next step.
- **Archer credentials are stored encrypted**: The `archerConnections` table stores passwords — ensure encryption at rest in production.
- **Clerk proxy via `/api/__clerk`**: The Express server proxies Clerk FAPI requests in production for custom domain support.

## Product

- **Landing page**: Marketing page with CTA
- **Dashboard**: Stats (total projects, deployments, hours saved) and recent activity
- **Projects**: Create, list, duplicate, version, export projects
- **Project new**: AI generation flow — describe your Archer app, Gemini generates full implementation design
- **Project detail**: View generated design (modules, fields, workflow, etc.), edit, export (JSON, Markdown, Archer Package)
- **Project deploy**: Deploy to Archer instance step-by-step, or simulate
- **Archer Connection**: Save and test Archer instance credentials
- **AI Copilot**: Floating chat assistant for Archer questions
- **Admin panel**: User management, platform analytics, API logs

## Gotchas

- `GEMINI_API_KEY` must be set — without it, AI generation silently fails with a 500 error
- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before touching the frontend
- Deployment to real Archer instances requires saving credentials via the Archer Connection page first
- The Clerk dev keys warning in browser console is expected and not an error
