import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ROLES } from "./schema";

// ── Error classes ───────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// ── Types ───────────────────────────────────────────────────────────

type UserRole = (typeof ROLES)[number];

// ── Helpers ─────────────────────────────────────────────────────────

/** Get the current authenticated user or throw. */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new AuthError("Authentication required. Please sign in.");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new NotFoundError(
      "User not found. Please ensure your account is properly set up."
    );
  }

  return user;
}

/** Check if the current user has a specific role. */
export async function hasRole(
  ctx: QueryCtx | MutationCtx,
  role: UserRole
): Promise<boolean> {
  try {
    const user = await getCurrentUser(ctx);
    return (user.roles ?? []).includes(role);
  } catch {
    return false;
  }
}

// ── Guards ───────────────────────────────────────────────────────────
// Add more guards here as you add roles (e.g. requireManager, requireEditor).

/** Require any authenticated user. */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  return getCurrentUser(ctx);
}

/** Require admin role. */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (!(user.roles ?? []).includes("admin")) {
    throw new ForbiddenError("Admin access required.");
  }
  return user;
}
