import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelpers";
import { messageRoleValidator } from "./schema";

// ── AI message history ──────────────────────────────────────────────
// Stores chat messages so conversations persist across page loads.

const aiMessageValidator = v.object({
  _id: v.id("aiMessages"),
  _creationTime: v.number(),
  userId: v.id("users"),
  role: messageRoleValidator,
  content: v.string(),
  model: v.optional(v.string()),
  createdAt: v.number(),
});

/** List the current user's AI chat messages. */
export const listMessages = query({
  args: {},
  returns: v.array(aiMessageValidator),
  handler: async (ctx) => {
    try {
      const user = await requireAuth(ctx);
      return await ctx.db
        .query("aiMessages")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    } catch {
      return [];
    }
  },
});

/** Save a user or assistant message. */
export const saveMessage = mutation({
  args: {
    role: messageRoleValidator,
    content: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.id("aiMessages"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    return await ctx.db.insert("aiMessages", {
      userId: user._id,
      role: args.role,
      content: args.content,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

/** Clear the current user's chat history. */
export const clearHistory = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
