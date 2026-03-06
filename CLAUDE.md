
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
  functions.ts                   # Custom function builders (userQuery, userMutation, adminQuery, adminMutation)
  http.ts                        # HTTP router — Convex Auth routes
  users.ts                       # User CRUD (no auto-provisioning — Convex Auth handles it)
  convex.config.ts               # App definition — registers R2 component
  notes.ts                       # Demo CRUD (delete me)

  __tests__/                     # Backend tests (vitest + convex-test)
    setup.ts                     # Module glob for convex-test
    helpers.ts                   # createTest, createTestUser, createAdminUser
    auth.test.ts                 # Auth guard tests (userQuery/adminQuery rejection + acceptance)
    notes.test.ts                # Notes CRUD + data boundary tests
    users.test.ts                # Users service tests

  email/                         # Email service (deep module)
    send.ts                      # sendEmail, resendEmail (api.email.send.*)
    logs.ts                      # createEmailLog, updateEmailLog, checkIsAdmin, getEmailLogInternal, listEmailLogs
    templates.ts                 # list, get, getInternal, create, update, remove, duplicate (api.email.templates.*)
    actions.ts                   # "use node" — processEmail, getEmailConfig (api.email.actions.*)
    templateActions.ts           # "use node" — previewTemplate (api.email.templateActions.*)
    provider.ts                  # "use node" utility — no function exports
    render.ts                    # "use node" utility — no function exports
    builtinTemplates.tsx         # "use node" utility — React Email templates
    __tests__/                   # Email service tests
      logs.test.ts               # Email log CRUD + admin access tests
      templates.test.ts          # Template CRUD + uniqueness + deletion guard tests
      send.test.ts               # Send flow + resend + auth tests

  storage/                       # Storage service (deep module)
    files.ts                     # storeFileMetadata, getMyFiles, deleteFile (api.storage.files.*)
    r2.ts                        # R2 client + clientApi (api.storage.r2.*)
    downloads.ts                 # "use node" — generateDownloadUrl (api.storage.downloads.*)
    __tests__/                   # Storage tests
      files.test.ts              # File metadata CRUD + ownership tests

  ai/                            # AI service (deep module)
    messages.ts                  # listMessages, saveMessage, clearHistory (api.ai.messages.*)
    chat.ts                      # "use node" — chat action (api.ai.chat.*)
    __tests__/                   # AI tests
      messages.test.ts           # Message CRUD + isolation + clear history tests

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

.claude/hooks/
  stop-hook.ts                   # Stop hook: typecheck + lint + MCP error check + diagram updates
  block-*.sh                     # PreToolUse hooks: enforce CLI tool usage rules
  check-untested-functions.sh    # PreToolUse hook: warn about untested Convex functions on git commit
  check-temporal-coupling.sh     # PreToolUse hook: warn about cross-module temporal coupling on git commit

memory/ai/diagrams/              # Auto-maintained architecture diagrams
  schema.md                      # ER diagram of all tables
  functions.md                   # All Convex functions with auth + table access
  auth-flow.md                   # Authentication sequence diagrams
  data-flow.md                   # Client → Convex → R2/OpenRouter data flow
  greybox.md                     # Deep module boundaries, public APIs vs internals
```

## Design Principles

### The Greybox Principle

Design modules to be **"Accessible but Irrelevant"** — implementation details are accessible when needed, but irrelevant to the rest of the system during standard operation. Full reference: `docs/design/greybox_principle.md`

**Three-Question Checklist** (evaluate every module):

| Question | Test |
|----------|------|
| **Deep?** | Does a simple interface hide significant internal complexity? |
| **Opaque?** | Can you swap internals without touching files that *use* the module? |
| **Outcome-Focused?** | Do tests assert results rather than mocking internal steps? |

**Two Heuristics** for finding broken seams:

- **Change Gravity:** If changing one internal decision requires updating 3+ files, the seam is too thin — move logic deeper.
- **Temporal Coupling:** If files always change together in commits (`git log --name-only`), they belong in the same module boundary.

### Greybox at Planning Time

**When brainstorming or writing implementation plans**, evaluate every proposed module against the Greybox checklist **before finalizing the design**. This is mandatory — do not skip it even for "simple" features.

During the **brainstorming** skill's "Present design" step, for each new module or service:

1. **Define the seam first.** What is the public API? Can you describe it in one sentence?
2. **Run the three questions.** Deep? Opaque? Outcome-focused? If any answer is "no", redesign before proceeding.
3. **Check existing boundaries.** Read `memory/ai/diagrams/greybox.md` to understand current module structure. Does the new feature fit inside an existing deep module, or does it need its own?
4. **Identify the swap test.** Name one internal implementation detail that could change without affecting consumers. If you can't, the module isn't deep enough.

During the **writing-plans** skill, for each task that creates new files:

1. **Annotate public vs internal.** Mark which files are public interface and which are internals.
2. **Plan tests at the seam.** Tests should call the public API, not internal helpers.
3. **Flag cross-module dependencies.** If a task requires importing from another module's internals, the boundary is wrong — redesign the seam.

This catches architectural issues at the cheapest possible moment — before any code is written.

## Browser & UI Verification

Always use the `agent-browser` skill for browser interaction and visual verification. Take screenshots and view them directly — do not pipe screenshots through other AI tools (e.g., Zai MCP `analyze_image`). Direct visual feedback is more valuable than secondhand analysis.

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

### Layer 3: Convex Backend Guards (`convex/functions.ts` + `convex/authHelpers.ts`)

Auth is enforced **automatically** via custom function builders from `convex/functions.ts`. These use `convex-helpers` to inject `ctx.user` and role checks at the builder level — no manual `requireAuth()` calls needed.

| Builder | Auth | `ctx.user` | Use for |
|---------|------|------------|---------|
| `userQuery` | Authenticated | Yes | Any query needing the current user |
| `userMutation` | Authenticated | Yes | Any mutation needing the current user |
| `adminQuery` | Admin role | Yes | Admin-only reads |
| `adminMutation` | Admin role | Yes | Admin-only writes |
| Raw `query`/`mutation` | **None** | No | Explicitly public endpoints only |

- **Default to `userQuery`/`userMutation`** for new functions
- Raw `query`/`mutation` from `_generated/server` requires an `eslint-disable` comment (ESLint blocks it)
- Actions (`"use node"` files): still use `ctx.auth.getUserIdentity()` null check manually
- `ctx.user` is a full `Doc<"users">` — access `ctx.user._id`, `ctx.user.roles`, etc.
- **Never skip auth checks** — even if the frontend "should" prevent unauthenticated access, the backend must enforce it independently

### Checklist for New Features

- [ ] Page under `src/app/(app)/`? Protected by proxy + client gate automatically
- [ ] New public page? Add route pattern to `src/proxy.ts` `isPublicRoute`
- [ ] New query/mutation? Use `userQuery`/`userMutation` from `./functions` (auth is automatic)
- [ ] Admin-only query/mutation? Use `adminQuery`/`adminMutation` from `./functions`
- [ ] New action? Add `ctx.auth.getUserIdentity()` null check at top of handler
- [ ] New role? Follow "Adding a Role" section below
- [ ] Tests for new queries/mutations? Add to `convex/<service>/__tests__/`

## Adding a Feature

1. Add table(s) to `convex/schema.ts` (use `v.optional()` for new fields on existing tables)
2. Create `convex/your-feature.ts` with queries/mutations using `userQuery`/`userMutation` from `./functions`
3. If Node.js packages needed: create `convex/your-featureActions.ts` with `"use node"`
4. Create `src/app/(app)/your-feature/page.tsx` (`"use client"` directive)
5. Add nav entry in `src/components/layout/sidebar.tsx`
6. Add tests in `convex/<service>/__tests__/` for new queries/mutations
7. Follow "Greybox at Planning Time" checklist above for new modules

## Adding a Role

1. Add the literal to `ROLES` and `roleValidator` in `convex/schema.ts`
2. Update the `roles` field validator in the `users` table
3. Add a guard in `convex/authHelpers.ts` (e.g. `requireEditor`)
4. Update `convex/users.ts` `updateUserRoles` args validator
5. Add a test account row to the **Test Accounts** table below (email: `test<role>@lucystarter.dev`, password: `Test<Role>123!`)

## Removing a Role

1. Remove the literal from `ROLES` and `roleValidator` in `convex/schema.ts`
2. Update the `roles` field validator in the `users` table
3. Remove the guard in `convex/authHelpers.ts`
4. Update `convex/users.ts` `updateUserRoles` args validator
5. Remove the corresponding test account row from the **Test Accounts** table below

## Test Accounts

Shared dev/test accounts — one per role. Any agent or human can use these to log in.
If login fails (account doesn't exist), create it via `/signup` with the exact credentials below.

| Role | Email | Password |
|------|-------|----------|
| user | `testuser@lucystarter.dev` | `TestUser123!` |
| admin | `testadmin@lucystarter.dev` | `TestAdmin123!` |

**Creating accounts:**
1. Navigate to `/signup`, use the email + password above
2. For the **admin** account, promote after signup via Convex dashboard:
   - Open `npx convex dashboard` → `users` table
   - Find `testadmin@lucystarter.dev`, edit `roles` to `["user", "admin"]`

**Important:**
- Dev/local only. Never use these in production.
- Password provider does not require email verification — signup is instant.
- OAuth (GitHub, Google) is available but not used for shared test accounts.

