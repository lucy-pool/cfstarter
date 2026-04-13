---
paths:
  - convex/**/*.ts
  - convex/**/*.tsx
---

# Convex Runtime Constraints

- **Queries** are reactive and re-run on data changes. No side effects allowed (no fetch, no writes to external systems).
- **Mutations** are transactional. No `fetch()` or external API calls. Read/write DB atomically.
- **Actions** are for side effects (external APIs, Node packages). Cannot directly read/write DB -- use `ctx.runQuery()` / `ctx.runMutation()`.
- **`"use node"` files** ONLY contain actions. Cannot export queries or mutations. Required when importing Node.js packages (fs, crypto, stream, etc.).
- **Default runtime files** can contain queries, mutations, and actions. No Node.js built-ins available.
- **Split pattern:** `feature.ts` (queries/mutations) + `featureActions.ts` (actions with `"use node"` directive).
- **Action calling action** is an anti-pattern. Inline the logic or schedule via `ctx.scheduler.runAfter()` from a mutation.
- **New fields on existing tables** MUST use `v.optional()` -- existing documents without the field will fail schema validation otherwise.
