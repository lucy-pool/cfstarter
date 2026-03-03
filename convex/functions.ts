/**
 * Custom function builders — secure-by-default auth wrappers.
 *
 * Use these instead of raw `query`/`mutation` from `_generated/server`:
 * - `userQuery` / `userMutation` — requires authenticated user, injects `ctx.user`
 * - `adminQuery` / `adminMutation` — requires admin role, injects `ctx.user`
 *
 * For explicitly public endpoints (no auth), import raw `query`/`mutation`
 * from `./_generated/server` directly (and add an ESLint disable comment).
 */
import {
  customQuery,
  customMutation,
} from "convex-helpers/server/customFunctions";
// eslint-disable-next-line no-restricted-imports -- builders wrap raw query/mutation
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./authHelpers";

// ── Authenticated user builders ──────────────────────────────────────

export const userQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { ctx: { user }, args: {} };
  },
});

export const userMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { ctx: { user }, args: {} };
  },
});

// ── Admin builders ───────────────────────────────────────────────────

export const adminQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!(user.roles ?? []).includes("admin")) {
      throw new Error("Admin access required");
    }
    return { ctx: { user }, args: {} };
  },
});

export const adminMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!(user.roles ?? []).includes("admin")) {
      throw new Error("Admin access required");
    }
    return { ctx: { user }, args: {} };
  },
});
