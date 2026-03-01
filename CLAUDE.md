
## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend / DB | Convex (real-time, reactive, transactional) |
| Frontend | Next.js 16 (App Router, `"use client"` pages) |
| Auth | Convex Auth (`@convex-dev/auth` — Password, GitHub, Google OAuth) |
| UI | shadcn/ui + Tailwind CSS |
| Object Storage | Cloudflare R2 via `@convex-dev/r2` (presigned URLs, direct browser upload) |
| AI / LLMs | OpenRouter (OpenAI-compatible chat completions) |

## Convex Runtime Rules

| Rule | Detail |
|------|--------|
| **Queries** are reactive | Re-run automatically when data changes. No side effects. |
| **Mutations** are transactional | Read/write DB atomically. No `fetch()` or external calls. |
| **Actions** are for side effects | Call external APIs. Can't directly read/write DB — use `ctx.runQuery()`/`ctx.runMutation()`. |
| **`"use node"` files** | ONLY contain actions. Cannot export queries/mutations. Required for Node.js packages. |
| **Default runtime files** | Contain queries/mutations/actions. No Node.js built-ins (fs, crypto, stream). |
| **Split pattern** | `feature.ts` (queries/mutations) + `featureActions.ts` (actions with `"use node"`). |
| **Action → Action** | Anti-pattern. Inline the logic or use `ctx.scheduler.runAfter()` from a mutation. |
| **New fields on existing tables** | Must use `v.optional()` or existing data breaks the schema push. |

## Architecture

```
convex/                          # Backend
  schema.ts                      # Tables, indexes, role + fileType validators + authTables
  auth.ts                        # Convex Auth provider config (Password, GitHub, Google)
  auth.config.ts                 # Self-issued JWT config
  authHelpers.ts                 # Auth guards (requireAuth, requireAdmin, hasRole)
  http.ts                        # HTTP router — Convex Auth routes
  users.ts                       # User CRUD (no auto-provisioning — Convex Auth handles it)
  convex.config.ts               # App definition — registers R2 component
  files.ts                       # File metadata CRUD
  r2.ts                          # R2 client + clientApi exports (generateUploadUrl, syncMetadata)
  r2Actions.ts                   # "use node" — R2 presigned download URLs
  ai.ts                          # AI message history CRUD
  aiActions.ts                   # "use node" — OpenRouter chat completions
  notes.ts                       # Demo CRUD (delete me)

src/
  proxy.ts                       # Convex Auth middleware — route protection

src/app/                         # Frontend
  layout.tsx                     # Root: ConvexAuthNextjsServerProvider → ConvexClientProvider → Toaster
  page.tsx                       # Landing page
  signin/page.tsx                # Sign-in (Password + OAuth)
  signup/page.tsx                # Sign-up (Password + OAuth)
  (app)/                         # Protected route group
    layout.tsx                   # Auth gate (redirects to /signin if unauthenticated)
    dashboard/page.tsx           # Welcome + demo links
    notes/page.tsx               # Demo: CRUD (delete me)
    files/page.tsx               # Demo: R2 upload (delete me)
    ai-chat/page.tsx             # Demo: OpenRouter chat (delete me)
    data-grid-demo/page.tsx      # Demo: DataGrid component showcase

src/components/
  providers.tsx                  # ConvexAuthProvider
  theme-toggle.tsx               # Dark/light mode toggle
  auth/
    user-menu.tsx                # User avatar + sign-out button
  layout/
    app-shell.tsx                # Sidebar + topbar + content area
    sidebar.tsx                  # Nav items array (extend here)
    topbar.tsx                   # UserMenu + ThemeToggle
  ui/                            # 16 shadcn/ui components + custom data-grid
    data-grid/                   # Custom DataGrid component (8 files)

src/lib/
  utils.ts                       # cn() utility

claude-hooks/
  index.ts                       # Stop hook: typecheck + lint + MCP error check + diagram updates

memory/ai/diagrams/              # Auto-maintained architecture diagrams
  schema.md                      # ER diagram of all tables
  functions.md                   # All Convex functions with auth + table access
  auth-flow.md                   # Authentication sequence diagrams
  data-flow.md                   # Client → Convex → R2/OpenRouter data flow
```

## Stop Hook (`claude-hooks/index.ts`)

Runs automatically after every Claude Code turn that edits files. Blocks until issues are fixed.

| Check | What it does |
|-------|-------------|
| 1. TypeScript typecheck | `bun run typecheck` |
| 2. Convex typecheck | Schema vs function signature validation |
| 3. Unused `_generated` imports | Lint: dead imports in `convex/` |
| 4. Client-only packages | Lint: React/Next.js imports in `convex/` server code |
| 5. Next.js MCP errors | Queries `localhost:3000/_next/mcp` for build/runtime errors (skipped if dev server not running) |

After all checks pass, spawns a background agent to update architecture diagrams.

## MCP Servers (`.mcp.json`)

Configured in `.mcp.json` at the project root. Restart Claude Code after changes.

### next-devtools-mcp

Connects to the running Next.js dev server via the `/_next/mcp` endpoint. Provides real-time access to app state. **Requires `bun dev` to be running.**

| Tool | Use |
|------|-----|
| `get_errors` | Build, runtime, and console errors from open browser sessions |
| `get_logs` | Path to dev server log file with browser console and server output |
| `get_page_metadata` | Runtime metadata for specific pages (routes, components, rendering) |
| `get_project_metadata` | Project structure, configuration, and dev server URL |
| `get_server_action_by_id` | Look up Server Actions by ID to find source file and function |

**Usage**: The MCP tools are available directly when the server is configured. Use them to check for errors, inspect routes, and debug issues in real time.

### shadcn

Provides tools for adding and managing shadcn/ui components.

| Tool | Use |
|------|-----|
| Add components | `bunx --bun shadcn@latest add [component]` |

## Skills

### agent-browser

Browser automation skill for testing, validation, and visual verification. Invoke with `agent-browser` commands via Bash.

| Command | Use |
|---------|-----|
| `agent-browser open <url>` | Navigate to a page |
| `agent-browser snapshot -i` | Get interactive element refs (`@e1`, `@e2`, ...) |
| `agent-browser click @e1` | Click an element by ref |
| `agent-browser fill @e1 "text"` | Clear and type into an input |
| `agent-browser screenshot` | Take a screenshot (add `--full` for full page, `--annotate` for labeled elements) |
| `agent-browser wait --load networkidle` | Wait for page to fully load |
| `agent-browser get text @e1` | Get element text content |
| `agent-browser close` | Close the browser session |

**Workflow**: `open` → `snapshot -i` → interact using refs → re-snapshot after navigation/DOM changes. Commands can be chained with `&&`. Always close the session when done.

**Usage**: Use to visually verify UI changes, test user flows end-to-end, take screenshots, and fill forms. For runtime/build error detection, use the Next.js MCP server (`get_errors`) instead. Full docs in `.claude/skills/agent-browser/SKILL.md`.

## Diagrams (source of truth for schema, functions, auth, data flow)

Auto-maintained by the Stop hook. **Read these before making changes** — they contain the full details on tables, indexes, auth guards, R2 upload flow, AI chat flow, and all Convex function signatures.

- `memory/ai/diagrams/schema.md` — ER diagram, indexes, roles, validators
- `memory/ai/diagrams/functions.md` — All Convex functions, auth guards, table access, flow diagrams
- `memory/ai/diagrams/auth-flow.md` — Sign-in sequence, route protection, JWT flow
- `memory/ai/diagrams/data-flow.md` — Reactive queries, R2 upload flow, AI chat flow, key patterns

## Security: Auth Guarding Rules

Three layers of defense — all three must be maintained when adding or modifying features.

### Layer 1: Edge Proxy (`src/proxy.ts`)

- Next.js 16 uses `proxy.ts` (NOT `middleware.ts` — that convention is deprecated)
- Runs at the edge before any page code is served
- Uses `convexAuthNextjsMiddleware` from `@convex-dev/auth/nextjs/server`
- Public routes: `/`, `/signin`, `/signup`, `/api/auth(.*)`
- Unauthenticated users are redirected to `/signin`
- **When adding a new public route**: add it to the `isPublicRoute` matcher in `src/proxy.ts`
- **Default is deny** — new routes are protected automatically

### Layer 2: Client-Side Auth Gate (`src/app/(app)/layout.tsx`)

- The `(app)` route group layout checks auth client-side as a fallback
- Uses `useConvexAuth()` from `convex/react`
- All protected pages live under `src/app/(app)/`
- **Never put protected pages outside `(app)/`** without adding proxy + guard coverage

### Layer 3: Convex Backend Guards (`convex/authHelpers.ts`)

- **Every** query/mutation/action that accesses user data MUST call an auth guard
- Available guards: `requireAuth(ctx)`, `requireAdmin(ctx)`, `hasRole(ctx, role)`
- Guards use `getAuthUserId(ctx)` from `@convex-dev/auth/server`
- Queries/mutations: call the guard at the top of the handler
- Actions (`"use node"` files): call `ctx.auth.getUserIdentity()` and throw if `null`
- **Never skip auth checks** — even if the frontend "should" prevent unauthenticated access, the backend must enforce it independently

### Checklist for New Features

- [ ] Page under `src/app/(app)/`? Protected by proxy + client gate automatically
- [ ] New public page? Add route pattern to `src/proxy.ts` `isPublicRoute`
- [ ] New query/mutation? Add `requireAuth(ctx)` or `requireAdmin(ctx)` at top of handler
- [ ] New action? Add `ctx.auth.getUserIdentity()` null check at top of handler
- [ ] New role? Follow "Adding a Role" section below

## Adding a Feature

1. Add table(s) to `convex/schema.ts` (use `v.optional()` for new fields on existing tables)
2. Create `convex/your-feature.ts` with queries/mutations
3. If Node.js packages needed: create `convex/your-featureActions.ts` with `"use node"`
4. Create `src/app/(app)/your-feature/page.tsx` (`"use client"` directive)
5. Add nav entry in `src/components/layout/sidebar.tsx`
6. Run `bunx convex dev` to push schema
7. Type-check: `bunx tsc --noEmit`

## Adding a Role

1. Add the literal to `ROLES` and `roleValidator` in `convex/schema.ts`
2. Update the `roles` field validator in the `users` table
3. Add a guard in `convex/authHelpers.ts` (e.g. `requireEditor`)
4. Update `convex/users.ts` `updateUserRoles` args validator

## Environment Variables

| Variable | Location | Required |
|----------|----------|----------|
| `CONVEX_DEPLOYMENT` | `.env.local` | Yes (auto-set) |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Yes (auto-set) |
| `AUTH_GITHUB_ID` | Convex env | For GitHub OAuth |
| `AUTH_GITHUB_SECRET` | Convex env | For GitHub OAuth |
| `AUTH_GOOGLE_ID` | Convex env | For Google OAuth |
| `AUTH_GOOGLE_SECRET` | Convex env | For Google OAuth |
| `R2_ENDPOINT` | Convex env | For file uploads |
| `R2_ACCESS_KEY_ID` | Convex env | For file uploads |
| `R2_SECRET_ACCESS_KEY` | Convex env | For file uploads |
| `R2_BUCKET` | Convex env | For file uploads |
| `OPENROUTER_API_KEY` | Convex env | For AI chat |
| `DEFAULT_OPENROUTER_MODEL` | Convex env | Optional (default devstral free) |

## Quick Start

```bash
bun install
cp .env.example .env.local    # Fill in Convex URL
bunx convex dev                # Terminal 1 — pushes schema
bun dev                        # Terminal 2 — starts Next.js
```

For OAuth providers, set env vars in the Convex dashboard:
```bash
bunx convex env set AUTH_GITHUB_ID your-github-client-id
bunx convex env set AUTH_GITHUB_SECRET your-github-client-secret
bunx convex env set AUTH_GOOGLE_ID your-google-client-id
bunx convex env set AUTH_GOOGLE_SECRET your-google-client-secret
```

For R2/AI features, set env vars in the Convex dashboard:
```bash
bunx convex env set R2_ENDPOINT https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
bunx convex env set R2_ACCESS_KEY_ID your-access-key-id
bunx convex env set R2_SECRET_ACCESS_KEY your-secret-access-key
bunx convex env set R2_BUCKET your-bucket-name
bunx convex env set OPENROUTER_API_KEY sk-or-v1-...
```
