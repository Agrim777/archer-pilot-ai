# ── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:24-alpine AS deps

RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests and lockfile first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json tsconfig.json ./

COPY lib/api-spec/package.json      lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json       lib/api-zod/
COPY lib/db/package.json            lib/db/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/archer-pilot/package.json artifacts/archer-pilot/
COPY scripts/package.json           scripts/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────────────
FROM deps AS builder

# Copy all source code
COPY . .

# Run codegen (generates typed hooks + Zod schemas from OpenAPI spec)
RUN pnpm --filter @workspace/api-spec run codegen

# Build frontend with Railway paths (BASE_PATH=/ PORT=3000 are needed by vite.config)
ENV BASE_PATH=/
ENV PORT=3000
ENV NODE_ENV=production
RUN pnpm --filter @workspace/archer-pilot run build

# Build API server (esbuild bundle)
RUN pnpm --filter @workspace/api-server run build

# ── Stage 3: Production image ───────────────────────────────────────────────
FROM node:24-alpine AS runner

RUN npm install -g pnpm@10

WORKDIR /app
ENV NODE_ENV=production

# Copy only built artifacts + shared runtime libs
COPY --from=builder /app/artifacts/api-server/dist     ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/archer-pilot/dist   ./artifacts/archer-pilot/dist
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/

# Copy pnpm workspace for prod dependency install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/db/package.json            lib/db/
COPY lib/api-zod/package.json       lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || true

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
