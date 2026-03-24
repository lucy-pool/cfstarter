import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
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
  // Better Auth provides user identity via JWT token verification.
  // ctx.auth.getUserIdentity() returns the identity from the verified JWT,
  // which includes email and other claims from the Better Auth user.
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError("Authentication required. Please sign in.");
  }

  // Look up the app user by email from the JWT identity claims.
  // The Better Auth convex plugin includes user fields (except id, image)
  // in the JWT payload, so identity.email is available.
  const email = identity.email;
  if (!email) {
    throw new AuthError(
      "User identity missing email. Please ensure your account is properly set up."
    );
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

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
