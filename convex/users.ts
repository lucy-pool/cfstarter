// eslint-disable-next-line no-restricted-imports -- getCurrentUser needs soft-fail for unauthenticated
import { query } from "./_generated/server";
import { v } from "convex/values";
import { roleValidator } from "./schema";
import { getCurrentUser as getAuthUser } from "./authHelpers";
import { userMutation, adminMutation, adminQuery } from "./functions";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  image: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  roles: v.optional(v.array(roleValidator)),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
});

/** Get the current user (returns null if not signed in). */
export const getCurrentUser = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    try {
      return await getAuthUser(ctx);
    } catch {
      return null;
    }
  },
});

/** Update the current user's profile. */
export const updateProfile = userMutation({
  args: {
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;

    await ctx.db.patch(ctx.user._id, updates);
  },
});

/** Admin-only: change a user's roles. */
export const updateUserRoles = adminMutation({
  args: {
    userId: v.id("users"),
    roles: v.array(roleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      roles: args.roles,
      updatedAt: Date.now(),
    });
  },
});

/** Admin-only: update another user's profile. */
export const adminUpdateUser = adminMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    await ctx.db.patch(args.userId, updates);
  },
});

/** List all users (admin only). */
export const getAllUsers = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      roles: v.optional(v.array(roleValidator)),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      name: u.name,
      email: u.email,
      roles: u.roles,
    }));
  },
});
