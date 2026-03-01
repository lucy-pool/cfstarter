import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelpers";

// ── Demo CRUD — shows the basic Convex patterns ─────────────────────
// Replace this file with your own feature modules.

const noteValidator = v.object({
  _id: v.id("notes"),
  _creationTime: v.number(),
  title: v.string(),
  body: v.string(),
  authorId: v.id("users"),
  isPublic: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** List notes visible to the current user (own + public). */
export const list = query({
  args: {},
  returns: v.array(noteValidator),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const myNotes = await ctx.db
      .query("notes")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .collect();

    const publicNotes = await ctx.db
      .query("notes")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();

    // Merge, deduplicate
    const seen = new Set(myNotes.map((n) => n._id));
    const merged = [...myNotes];
    for (const note of publicNotes) {
      if (!seen.has(note._id)) merged.push(note);
    }

    return merged.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Create a note. */
export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    isPublic: v.boolean(),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    return await ctx.db.insert("notes", {
      title: args.title,
      body: args.body,
      authorId: user._id,
      isPublic: args.isPublic,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update a note (author only). */
export const update = mutation({
  args: {
    id: v.id("notes"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.authorId !== user._id) {
      throw new Error("Note not found or access denied");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.body !== undefined) updates.body = args.body;
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;

    await ctx.db.patch(args.id, updates);
  },
});

/** Delete a note (author only). */
export const remove = mutation({
  args: { id: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.authorId !== user._id) {
      throw new Error("Note not found or access denied");
    }

    await ctx.db.delete(args.id);
  },
});
