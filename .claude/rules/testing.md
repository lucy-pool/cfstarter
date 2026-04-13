---
paths:
  - tests/**/*.ts
---

# Testing Conventions

- Use `createTest()` from `tests/convex/helpers.ts` to create test instances.
- Use `createTestUser(t)` for a regular authenticated user, `createAdminUser(t)` for an admin user.
- `asUser` returned by `createTestUser` provides an authenticated accessor via `t.withIdentity()`.
- Test at the seam -- call the public API function (e.g., `api.notes.list`), not internal helpers.
- Assert results and outcomes, not internal steps. Do not mock internals (Greybox principle).
- File structure mirrors `convex/`: `tests/convex/email/templates.test.ts` tests `convex/email/templates.ts`.
- Use `describe` / `it` blocks from vitest with `convex-test`.
- Each test should set up its own data via mutations -- do not rely on shared state between tests.
