---
paths:
  - convex/**/*.ts
  - src/routes/**/*.tsx
---

# Auth Guard Rules

## Backend (Convex)

- Use `userQuery` / `userMutation` from `./functions` for authenticated endpoints. Auth is automatic via custom builders -- no manual `requireAuth()` needed.
- Use `adminQuery` / `adminMutation` for admin-only endpoints.
- NEVER use raw `query` / `mutation` from `_generated/server` without an `eslint-disable` comment. These have no auth checks.
- In actions (`"use node"` files): manually check `ctx.auth.getUserIdentity()` at the top of the handler and throw if null.
- `ctx.user` is a full `Doc<"users">` -- access `ctx.user._id`, `ctx.user.roles`, etc.
- Backend MUST enforce auth independently. Never rely on frontend guards alone.

## Frontend (Routes)

- Protected routes go under `src/routes/_app/` -- the `_app.tsx` layout auto-gates via `useSession()`.
- Public routes go as top-level files in `src/routes/` (e.g., `signin.tsx`, `signup.tsx`).
- When adding a new route, decide: authenticated or public? Place the file accordingly.
