import { v } from "convex/values";
import { messageRoleValidator } from "./schema";
import { userQuery, userMutation } from "./functions";

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
export const listMessages = userQuery({
  args: {},
  returns: v.array(aiMessageValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("aiMessages")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
  },
});

/** Save a user or assistant message. */
export const saveMessage = userMutation({
  args: {
    role: messageRoleValidator,
    content: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.id("aiMessages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiMessages", {
      userId: ctx.user._id,
      role: args.role,
      content: args.content,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

/** Clear the current user's chat history. */
export const clearHistory = userMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
