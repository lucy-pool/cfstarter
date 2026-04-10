# ── Stage 1: Install dependencies ────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# ── Stage 2: Build ───────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL
ARG VITE_SITE_URL
ENV DEPLOY_TARGET=vps
RUN bun run build

# ── Stage 3: Run ─────────────────────────────────────────────────────
# TanStack Start with the default vite preset (DEPLOY_TARGET=vps) emits a
# fetch handler at dist/server/server.js plus static client assets at
# dist/client/. server-node.mjs is a small pure-Node wrapper that serves the
# static assets and forwards everything else to the fetch handler. No
# external runtime deps — Node 22 has Request/Response/Headers globals.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/server-node.mjs ./server-node.mjs
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server-node.mjs"]
