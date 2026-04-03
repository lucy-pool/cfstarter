# Selective SSR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch from SPA mode to Selective SSR on Cloudflare Workers with `defaultSsr: false`.

**Architecture:** Remove SPA mode, add `@cloudflare/vite-plugin` for Workers deployment, restore server-side auth proxy and SSR token passing, create `src/start.ts` with `defaultSsr: false`. Routes are client-rendered by default; opt in with `ssr: true`.

**Tech Stack:** TanStack Start v1.167+, `@cloudflare/vite-plugin`, Cloudflare Workers, Better Auth

**Spec:** `docs/superpowers/specs/2026-04-03-selective-ssr-design.md`

---

### Task 1: Install Dependencies and Update Vite Config

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install @cloudflare/vite-plugin and wrangler**

Run:
```bash
bun add -d @cloudflare/vite-plugin wrangler
```

- [ ] **Step 2: Replace vite.config.ts**

Replace the entire contents of `vite.config.ts` with:

```ts
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    server: {
      port: 3000,
      proxy: {
        "/api/auth": {
          target: env.VITE_CONVEX_SITE_URL,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart(),
      react(),
    ],
    resolve: {
      alias: [
        { find: "@/convex", replacement: path.resolve(__dirname, "./convex") },
        { find: "@/", replacement: path.resolve(__dirname, "./src") + "/" },
      ],
    },
    ssr: {
      noExternal: ["@convex-dev/better-auth", "tailwindcss"],
    },
  };
});
```

Changes from current:
- Removed `spa: { enabled: true }` from `tanstackStart()`
- Added `cloudflare({ viteEnvironment: { name: "ssr" } })` plugin
- Restored `ssr.noExternal` for `@convex-dev/better-auth` and `tailwindcss`

- [ ] **Step 3: Update package.json scripts**

Change the `"start"` script and add `"deploy"`:

```json
"start": "node .output/server/index.mjs",
"deploy": "wrangler deploy",
```

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json bun.lock
git commit -m "feat: switch to Cloudflare Workers with selective SSR config"
```

---

### Task 2: Create Start Config and Wrangler Config

**Files:**
- Create: `src/start.ts`
- Create: `wrangler.jsonc`

- [ ] **Step 1: Create src/start.ts**

Create `src/start.ts`:

```ts
import { createStart } from "@tanstack/react-start";

export const start = createStart(() => ({
  defaultSsr: false,
}));
```

- [ ] **Step 2: Create wrangler.jsonc**

Create `wrangler.jsonc` in the project root:

```jsonc
{
  "name": "lucystarter",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/start.ts wrangler.jsonc
git commit -m "feat: add start config (defaultSsr: false) and wrangler config"
```

---

### Task 3: Restore Server-Side Auth Proxy

**Files:**
- Create: `src/lib/auth-server.ts`
- Create: `src/routes/api/auth/$.ts`
- Delete: `functions/api/auth/[[path]].ts`

- [ ] **Step 1: Create src/lib/auth-server.ts**

Create `src/lib/auth-server.ts`:

```ts
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
});
```

- [ ] **Step 2: Create src/routes/api/auth/$.ts**

Create `src/routes/api/auth/$.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { handler } from "@/lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
```

- [ ] **Step 3: Delete the Cloudflare Pages edge function**

Delete `functions/api/auth/[[path]].ts` and remove the now-empty `functions/` directory.

- [ ] **Step 4: Update tsconfig.json — remove functions exclusion**

In `tsconfig.json`, change:

```json
"exclude": ["node_modules", "functions"]
```

To:

```json
"exclude": ["node_modules"]
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-server.ts src/routes/api/auth/$.ts tsconfig.json
git rm functions/api/auth/\[\[path\]\].ts
git commit -m "feat: restore server-side auth proxy, remove edge function"
```

---

### Task 4: Restore SSR Auth in Root Route

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Update __root.tsx to restore SSR token passing**

Replace the entire contents of `src/routes/__root.tsx` with:

```tsx
/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import * as React from "react";
import { createServerFn } from "@tanstack/react-start";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import appCss from "@/styles/globals.css?url";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import { ThemeProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Sherif Starter" },
      {
        name: "description",
        content: "Full-stack starter with Convex, TanStack Start, and Better Auth",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  beforeLoad: async (ctx) => {
    const token = await getAuth();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return { isAuthenticated: !!token, token };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = Route.useRouteContext();
  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <RootDocument>
        <ThemeProvider>
          <Outlet />
          <Toaster />
        </ThemeProvider>
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

Changes from current:
- Added `createServerFn` import from `@tanstack/react-start`
- Added `getToken` import from `@/lib/auth-server`
- Added `getAuth` server function
- Added `beforeLoad` hook for SSR token fetch
- Added `initialToken={context.token}` prop to `ConvexBetterAuthProvider`

- [ ] **Step 2: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: restore SSR auth token passing in root route"
```

---

### Task 5: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Tech Stack table**

In the Tech Stack table, change the Frontend row to mention Cloudflare Workers:

Change:
```
| Frontend | TanStack Start (Vite, file-based routing, SSR-capable) |
```

To:
```
| Frontend | TanStack Start (Vite, file-based routing, Selective SSR) |
| Hosting | Cloudflare Workers (Selective SSR, ~0ms cold starts) |
```

- [ ] **Step 2: Update Architecture tree**

Remove the `functions/` block:
```
functions/                       # Cloudflare Pages Functions
  api/auth/[[path]].ts           # Edge proxy — forwards /api/auth/* to Convex HTTP backend
```

Restore `auth-server.ts` in the `src/lib/` section:
```
  auth-server.ts                 # Better Auth server-side helpers (getToken, handler)
```

Add to the `convex/` section after `convex.config.ts`:
```
  crons.ts                       # Cron jobs — cleanupOrphanedRecords every 30 min
```

Add `src/start.ts` before `src/router.tsx`:
```
  start.ts                       # TanStack Start config (defaultSsr: false)
```

Add `wrangler.jsonc` at the top level of the tree:
```
wrangler.jsonc                   # Cloudflare Workers deployment config
```

Restore the API auth route in `src/routes/`:
```
  api/auth/$.ts                  # API catch-all — proxies Better Auth requests to Convex
```

- [ ] **Step 3: Update Security Layer 2**

Replace the Layer 2 section:

```markdown
### Layer 2: API Auth Proxy (`src/routes/api/auth/$.ts`)

- Server-side route that proxies Better Auth requests to the Convex HTTP backend
- Runs as a TanStack Start server function (same origin, same process)
- No manual auth logic — Better Auth handles session tokens via cookies
- In local dev, Vite's `server.proxy` also forwards `/api/auth` for HMR compatibility
```

- [ ] **Step 4: Add Selective SSR section**

After the "File Upload Flow" section, add:

```markdown
## Selective SSR

SSR is **off by default** (`defaultSsr: false` in `src/start.ts`). All routes render client-side unless explicitly opted in.

To enable SSR for a specific route:
\```ts
export const Route = createFileRoute("/marketing")({
  ssr: true,
  component: MarketingPage,
});
\```

Options: `true` (full SSR), `false` (client-only, default), `"data-only"` (server data fetch, client render).

SSR routes get `beforeLoad` token from the server, so authenticated SSR works automatically via the root route's `getAuth` server function.
```

- [ ] **Step 5: Update Environment Variables table**

Replace the `CONVEX_SITE_URL | Cloudflare Pages env` row with:
```
| `CONVEX_SITE_URL` | Cloudflare Workers env | Auth proxy target (server function) |
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Selective SSR on Cloudflare Workers"
```

---

### Task 6: Verification

**Files:** None (testing only)

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck`

Expected: PASS

- [ ] **Step 2: Run tests**

Run: `bun run test`

Expected: All 47 tests pass.

- [ ] **Step 3: Run lint**

Run: `bun run lint`

Expected: PASS

- [ ] **Step 4: Run build**

Run: `bun run build`

Expected: Produces `.output/server/` and `.output/public/` directories. Both client and SSR builds succeed.

- [ ] **Step 5: Manual verification**

Kill any running dev servers, start fresh:

```bash
pkill -f "convex dev" 2>/dev/null; pkill -f "vite" 2>/dev/null
bunx convex dev &
bun run dev &
```

Test:
1. Navigate to `http://localhost:3000/` — landing page renders
2. Sign in with `testuser@lucystarter.dev` / `TestUser123!` — redirects to dashboard
3. Navigate to `/files` — file upload page loads
4. Sign out — redirects to `/signin`
5. Navigate to `/dashboard` unauthenticated — redirects to `/signin`

- [ ] **Step 6: Commit spec doc**

```bash
git add docs/superpowers/specs/2026-04-03-selective-ssr-design.md
git commit -m "docs: add selective SSR design spec"
```
