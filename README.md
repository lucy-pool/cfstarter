# Lucystarter

A production-ready starter for building full-stack apps with **Convex**, **TanStack Start**, **Better Auth**, and **shadcn/ui**. Ships with authentication, roles, email (Resend/SMTP), Cloudflare R2 file uploads, OpenRouter AI chat, a test suite, and auto-maintained architecture diagrams.

## What's Included

- **Auth** — Email/password, GitHub OAuth, Google OAuth via Better Auth. Protected routes just work — anything under `_app/` requires authentication.
- **Roles** — Defined once in `convex/schema.ts`. New users get `user`. Admins can promote. Add roles by editing one file.
- **Email** — Full email service with Resend and SMTP providers, built-in templates (welcome, notification, etc.), custom template editor with visual and HTML modes.
- **File uploads** — Browser-to-R2 direct upload via presigned URLs. Convex stores metadata only.
- **AI chat** — OpenRouter integration (OpenAI-compatible). Conversation history, any model.
- **Backend guards** — Custom function builders (`userQuery`, `userMutation`, `adminQuery`, `adminMutation`) auto-inject `ctx.user` and enforce auth/role checks.
- **Tests** — Backend test suite using vitest + convex-test. Auth guards, CRUD, data boundaries, email flows.
- **All shadcn/ui components** — Every component from the shadcn/ui registry is installed and ready to use.

### Demo features — copy the patterns, then delete them

| Demo | Pattern it teaches |
|------|-------------------|
| **Notes** | CRUD, queries with indexes, mutations with auth guards, ownership checks, public/private visibility |
| **Files** | `@convex-dev/r2` presigned URLs, direct browser upload, progress tracking, metadata storage |
| **AI Chat** | External API calls from actions, conversation history, loading states |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js 18+)
- A [Convex](https://convex.dev/) account

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Start Convex (pushes schema, creates .env.local)
bunx convex dev

# 3. Set Better Auth secret in Convex dashboard
bunx convex env set BETTER_AUTH_SECRET <your-secret>
bunx convex env set SITE_URL <your-convex-site-url>

# 4. Start the dev server (in a second terminal)
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up with email/password, and you'll land on the dashboard.

### Optional: GitHub OAuth

1. Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers)
   - Homepage URL: `http://localhost:3000`
   - Callback URL: your Convex site URL + `/api/auth/callback/github` (find it with `bunx convex env get SITE_URL`)
2. Set the env vars:

```bash
bunx convex env set AUTH_GITHUB_ID your-github-client-id
bunx convex env set AUTH_GITHUB_SECRET your-github-client-secret
```

### Optional: Google OAuth

1. Create credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Authorized redirect URI: your Convex site URL + `/api/auth/callback/google`
2. Set the env vars:

```bash
bunx convex env set AUTH_GOOGLE_ID your-google-client-id
bunx convex env set AUTH_GOOGLE_SECRET your-google-client-secret
```

### Optional: Cloudflare R2 (file uploads)

1. Create an R2 bucket in [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create Bucket**
2. Create an R2 API token: **R2** → **Manage R2 API Tokens** → **Create API Token** (Object Read & Write, scoped to your bucket)
3. Set env vars:

```bash
bunx convex env set R2_ENDPOINT https://<ACCOUNT_ID>.r2.cloudflarestorage.com
bunx convex env set R2_ACCESS_KEY_ID <your-access-key-id>
bunx convex env set R2_SECRET_ACCESS_KEY <your-secret-access-key>
bunx convex env set R2_BUCKET <your-bucket-name>
```

4. Configure CORS on the bucket (**R2** → your bucket → **Settings** → **CORS Policy**):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-domain.com",
      "https://*.your-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Optional: OpenRouter (AI chat)

```bash
bunx convex env set OPENROUTER_API_KEY sk-or-v1-...
bunx convex env set DEFAULT_OPENROUTER_MODEL google/gemini-3-flash-preview
```

Browse models at [openrouter.ai/models](https://openrouter.ai/models). Defaults to `mistralai/devstral-2512:free` if not set.

### Optional: Email (Resend or SMTP)

For Resend:
```bash
bunx convex env set RESEND_API_KEY re_...
bunx convex env set EMAIL_FROM "Your App <noreply@yourdomain.com>"
```

For SMTP:
```bash
bunx convex env set SMTP_HOST smtp.example.com
bunx convex env set SMTP_PORT 587
bunx convex env set SMTP_USER your-username
bunx convex env set SMTP_PASS your-password
bunx convex env set EMAIL_FROM "Your App <noreply@yourdomain.com>"
```

## Project Structure

```
convex/                          # Backend
  schema.ts                      # Tables, indexes, role + fileType validators
  auth.ts                        # Better Auth config (Email/Password, GitHub, Google)
  auth.config.ts                 # Better Auth JWT config via @convex-dev/better-auth
  authHelpers.ts                 # Auth guards (requireAuth, requireAdmin, hasRole)
  functions.ts                   # Custom builders (userQuery, userMutation, adminQuery, adminMutation)
  users.ts                       # User CRUD
  notes.ts                       # Demo CRUD (delete me)

  email/                         # Email service
    send.ts                      # sendEmail, resendEmail
    logs.ts                      # Email log management
    templates.ts                 # Custom template CRUD
    actions.ts                   # "use node" — email delivery
    builtinTemplates.tsx         # React Email templates (welcome, notification, etc.)

  storage/                       # File storage
    files.ts                     # File metadata CRUD
    r2.ts                        # R2 client + presigned upload URLs
    downloads.ts                 # "use node" — presigned download URLs

  ai/                            # AI chat
    messages.ts                  # Message history CRUD
    chat.ts                      # "use node" — OpenRouter completions

src/
  start.ts                       # TanStack Start config (defaultSsr: false)
  router.tsx                     # TanStack Router instance

src/routes/                      # Frontend (TanStack Router, file-based)
  __root.tsx                     # Root layout: ConvexProvider, ThemeProvider, SSR auth
  index.tsx                      # Landing page (/)
  signin.tsx                     # Sign-in (Email/Password + OAuth)
  signup.tsx                     # Sign-up (Email/Password + OAuth)
  forgot-password.tsx            # Forgot password
  reset-password.tsx             # Reset password
  api/auth/$.ts                  # API catch-all — proxies Better Auth to Convex
  _app.tsx                       # Auth-gated layout (redirects to /signin)
  _app/                          # Protected routes
    dashboard.tsx                # Welcome + demo links
    notes.tsx                    # Demo: CRUD
    files.tsx                    # Demo: R2 upload with pending/complete lifecycle
    ai-chat.tsx                  # Demo: OpenRouter chat

src/components/
  providers.tsx                  # ThemeProvider
  layout/
    app-shell.tsx                # Sidebar + topbar + content
    sidebar.tsx                  # Nav items — add your routes here
    topbar.tsx                   # User menu + theme toggle
  ui/                            # All shadcn/ui components + custom data-grid

tests/convex/                    # Backend tests (vitest + convex-test)
```

## Building Your App

### 1. Add a table

In `convex/schema.ts`:

```typescript
projects: defineTable({
  name: v.string(),
  ownerId: v.id("users"),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdAt: v.number(),
})
  .index("by_owner", ["ownerId"]),
```

### 2. Write backend functions

Create `convex/projects.ts`:

```typescript
import { v } from "convex/values";
import { userQuery, userMutation } from "./functions";

export const list = userQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
      .collect();
  },
});

export const create = userMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.insert("projects", {
      name: args.name,
      ownerId: ctx.user._id,
      status: "active",
      createdAt: Date.now(),
    });
  },
});
```

### 3. Create a page

Create `src/routes/_app/projects.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  // ... your UI
}
```

### 4. Add it to the sidebar

In `src/components/layout/sidebar.tsx`, add to the nav items array.

### 5. Delete the demos

Remove what you don't need:
- **Notes:** `convex/notes.ts`, `src/routes/_app/notes.tsx`, `notes` table from schema
- **Files demo page:** `src/routes/_app/files.tsx` (keep `convex/storage/` if you need uploads)
- **AI demo page:** `src/routes/_app/ai-chat.tsx` (keep `convex/ai/` if you need AI)

## Architecture Docs Auto-Sync

The template keeps `memory/ai/diagrams/*.md` and the `## Architecture` tree in `CLAUDE.md` in sync with your code automatically, so the AI assistant always sees an accurate picture of the codebase. There is **no hardcoded file-to-diagram mapping** — the system derives it from what each diagram actually mentions and self-heals over time. Add a new module, rename a folder, split a service — zero hook changes required.

### How it works

At the end of every assistant turn, `.claude/hooks/stop-hook.ts` runs tests/typecheck/lint, then (on success) decides whether any documentation needs updating. If so, it spawns a background `claude -p --model sonnet` sub-process with a targeted prompt. The hook is debounced for 30 seconds to avoid spam.

Four signals can trigger the sub-process:

**Layer 1 — content-derived watches.** The hook scans every `*.md` in `memory/ai/diagrams/` and extracts every file path each diagram mentions in its body (tables, mermaid node labels, prose). For each file that changed this turn, it finds which diagrams reference that file (exact path match or parent-directory prefix match) and flags them for update. The "mapping" of file → diagram is literally the diagram content.

**Layer 2 — gap-fill.** If a changed file lives inside a watched source tree (`convex/`, `src/routes/`, `src/components/`, `src/lib/`, `src/hooks/`, `.claude/hooks/`) but **isn't** referenced in any diagram, the hook treats that as a coverage gap. The sub-Claude is told: "decide whether to extend an existing diagram, create a new one, or skip if it's genuinely not architectural." When it extends a diagram, it embeds the new file paths — which teaches Layer 1 to watch them automatically on the next Stop. That's the self-healing loop.

**Layer 3 — `/audit-diagrams` slash command.** On-demand full audit. Run it anytime (before a release, after a big refactor, when you suspect drift from git merges) and it walks every diagram: fixes broken file references, closes coverage gaps, verifies greybox module boundaries against the current `convex/` folder structure, and re-syncs the `## Architecture` tree in `CLAUDE.md`. Does not commit — leaves everything unstaged for review.

**Structural tree changes.** The hook runs `git status --porcelain` and only refreshes the CLAUDE.md architecture tree when files have been **added, deleted, or renamed** inside a watched directory. Pure content edits never trigger a tree refresh — that would churn on every keystroke.

**Zero-watch backfill (piggyback).** If a diagram has no extractable full-path references (e.g. it was written with bare filenames like `r2.ts` instead of `convex/storage/r2.ts`), it's invisible to Layer 1 forever. The hook detects these zero-watch diagrams and, **only when it's already spawning for some other reason**, appends a piggyback instruction telling the sub-Claude to rewrite those diagrams with explicit full paths. Passive, cheap, and eventually makes every diagram fully auto-watched.

### The one rule for humans writing diagrams by hand

**Mention files by full relative path, not bare filename.** Use `` `convex/storage/r2.ts` ``, not `` `r2.ts` ``. Bare filenames do not participate in the watch system. Every diagram update the AI assistant makes will follow this rule automatically (the hook prompt enforces it), but if you edit a diagram by hand, use full paths starting with `convex/`, `src/`, `tests/`, or `.claude/hooks/`.

### Key files

| File | Role |
|------|------|
| `.claude/hooks/stop-hook.ts` | Stop event hook — tests/typecheck/lint, then orchestrates the diagram + tree update pipeline |
| `.claude/hooks/diagram-watches.ts` | Extracts file references from diagrams; matches changed files → affected diagrams |
| `.claude/commands/audit-diagrams.md` | `/audit-diagrams` slash command (Layer 3 backstop) |
| `memory/ai/diagrams/*.md` | Mermaid diagrams — the input to the watch system and output of auto-updates |
| `CLAUDE.md` → `## Architecture` | File tree block — auto-refreshed on structural changes |

### Gotchas

- **Sub-Claude committing despite instructions.** The hook prompt explicitly says "Do NOT commit. Leave all updates as unstaged changes", but in rare cases the background sub-Claude will commit anyway. If you see an unexpected `diagram update` commit, just `git reset --soft HEAD~1` and re-commit however you like. This is a soft limitation of the spawn-a-sub-Claude pattern.
- **First Stop after adopting this.** On a fresh template, `data-flow.md`, `functions.md`, and `schema.md` ship as zero-watch diagrams (they use bare filenames). The first Stop that fires for any other reason will piggyback-backfill them, or you can run `/audit-diagrams` once to rewrite all three in a single batch.
- **Debounce.** Two Stops within 30 seconds only fire the diagram updater once. The second one reports `Skipped — another update ran within 30s.` to stderr.

### Disabling it

If you don't want any of this, delete `.claude/hooks/stop-hook.ts` or remove the `Stop` entry from `.claude/settings.json`. Delete `memory/ai/diagrams/` to stop scanning diagrams entirely. The rest of the template keeps working.

## Convex Cheat Sheet

| Concept | Rule |
|---------|------|
| **Queries** | Reactive, re-run on data change. No side effects. |
| **Mutations** | Transactional. No `fetch()` or external API calls. |
| **Actions** | For side effects (APIs, email, etc). Use `ctx.runQuery()`/`ctx.runMutation()` for DB. |
| **`"use node"` files** | Only export actions. Required for Node.js packages. |
| **New fields** | Use `v.optional()` when adding to tables that already have data. |
| **Scheduling** | Use `ctx.scheduler.runAfter(0, ...)` from mutations for async work. |
| **Auth in functions** | Use `userQuery`/`userMutation` from `./functions` — auth is automatic via `ctx.user`. |

## Environment Variables

| Variable | Where to set | Description |
|----------|-------------|-------------|
| `CONVEX_DEPLOYMENT` | `.env.local` | Auto-set by `bunx convex dev` |
| `VITE_CONVEX_URL` | `.env.local` | Auto-set by `bunx convex dev` |
| `VITE_CONVEX_SITE_URL` | `.env.local` | Convex HTTP actions URL (for auth proxy) |
| `VITE_SITE_URL` | `.env.local` | Frontend URL (e.g. `http://localhost:3000`) |
| `BETTER_AUTH_SECRET` | Convex dashboard | Secret for Better Auth session signing |
| `SITE_URL` | Convex dashboard | Better Auth base URL |
| `AUTH_GITHUB_ID` | Convex dashboard | GitHub OAuth client ID |
| `AUTH_GITHUB_SECRET` | Convex dashboard | GitHub OAuth client secret |
| `AUTH_GOOGLE_ID` | Convex dashboard | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Convex dashboard | Google OAuth client secret |
| `R2_ENDPOINT` | Convex dashboard | Cloudflare R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | Convex dashboard | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Convex dashboard | R2 API token secret |
| `R2_BUCKET` | Convex dashboard | R2 bucket name |
| `OPENROUTER_API_KEY` | Convex dashboard | OpenRouter API key |
| `DEFAULT_OPENROUTER_MODEL` | Convex dashboard | Default model (default: devstral free) |
| `RESEND_API_KEY` | Convex dashboard | Resend API key (if using Resend) |
| `EMAIL_FROM` | Convex dashboard | Sender address for emails |
| `SMTP_HOST` | Convex dashboard | SMTP server host (if using SMTP) |
| `SMTP_PORT` | Convex dashboard | SMTP port |
| `SMTP_USER` | Convex dashboard | SMTP username |
| `SMTP_PASS` | Convex dashboard | SMTP password |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Auth not working after sign-up | Check `BETTER_AUTH_SECRET` and `SITE_URL` in Convex dashboard |
| OAuth redirect errors | Verify callback URLs match your Convex site URL |
| File uploads failing | Check all 4 R2 env vars and CORS on the bucket |
| AI chat error | Verify `OPENROUTER_API_KEY` is set |
| `bunx convex dev` won't start | Run `bun install` first, ensure you're logged in |
| Blank page in dev | Check Vite terminal for SSR errors |

## License

MIT
