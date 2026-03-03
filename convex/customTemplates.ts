import { v } from "convex/values";
import { adminQuery, adminMutation } from "./functions";
import { internalQuery } from "./_generated/server";

// ── Shared validator for template documents ─────────────────────────

const templateDocValidator = v.object({
  _id: v.id("emailTemplates"),
  _creationTime: v.number(),
  name: v.string(),
  label: v.string(),
  subject: v.string(),
  editorMode: v.union(v.literal("visual"), v.literal("html")),
  contentJson: v.string(),
  contentHtml: v.optional(v.string()),
  variables: v.array(
    v.object({
      name: v.string(),
      required: v.boolean(),
      defaultValue: v.optional(v.string()),
    })
  ),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ── Admin queries ───────────────────────────────────────────────────

/** List all custom email templates, ordered by creation date desc. */
export const list = adminQuery({
  args: {},
  returns: v.array(templateDocValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("emailTemplates")
      .withIndex("by_created_at")
      .order("desc")
      .collect();
  },
});

/** Get a single custom email template by ID. */
export const get = adminQuery({
  args: { templateId: v.id("emailTemplates") },
  returns: v.union(templateDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

// ── Internal query (for processEmail) ───────────────────────────────

/** Fetch template content for the email send action. */
export const getInternal = internalQuery({
  args: { templateId: v.id("emailTemplates") },
  returns: v.union(templateDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

// ── Admin mutations ─────────────────────────────────────────────────

/** Create a new custom email template. */
export const create = adminMutation({
  args: {
    name: v.string(),
    label: v.string(),
    subject: v.string(),
    editorMode: v.union(v.literal("visual"), v.literal("html")),
    contentJson: v.string(),
    contentHtml: v.optional(v.string()),
    variables: v.array(
      v.object({
        name: v.string(),
        required: v.boolean(),
        defaultValue: v.optional(v.string()),
      })
    ),
  },
  returns: v.id("emailTemplates"),
  handler: async (ctx, args) => {
    // Enforce unique name
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      throw new Error(`A template with name "${args.name}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("emailTemplates", {
      name: args.name,
      label: args.label,
      subject: args.subject,
      editorMode: args.editorMode,
      contentJson: args.contentJson,
      contentHtml: args.contentHtml,
      variables: args.variables,
      createdBy: ctx.user._id,
      updatedBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing custom email template. */
export const update = adminMutation({
  args: {
    templateId: v.id("emailTemplates"),
    name: v.optional(v.string()),
    label: v.optional(v.string()),
    subject: v.optional(v.string()),
    editorMode: v.optional(v.union(v.literal("visual"), v.literal("html"))),
    contentJson: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    variables: v.optional(
      v.array(
        v.object({
          name: v.string(),
          required: v.boolean(),
          defaultValue: v.optional(v.string()),
        })
      )
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    // If name is changing, enforce uniqueness
    if (args.name && args.name !== template.name) {
      const existing = await ctx.db
        .query("emailTemplates")
        .withIndex("by_name", (q) => q.eq("name", args.name!))
        .first();
      if (existing) {
        throw new Error(`A template with name "${args.name}" already exists`);
      }
    }

    const patch: Record<string, unknown> = { updatedBy: ctx.user._id, updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.label !== undefined) patch.label = args.label;
    if (args.subject !== undefined) patch.subject = args.subject;
    if (args.editorMode !== undefined) patch.editorMode = args.editorMode;
    if (args.contentJson !== undefined) patch.contentJson = args.contentJson;
    if (args.contentHtml !== undefined) patch.contentHtml = args.contentHtml;
    if (args.variables !== undefined) patch.variables = args.variables;

    await ctx.db.patch(args.templateId, patch);
    return null;
  },
});

/** Delete a custom email template. */
export const remove = adminMutation({
  args: { templateId: v.id("emailTemplates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    // Check if any queued emails reference this template
    const queuedEmail = await ctx.db
      .query("emailLogs")
      .filter((q) =>
        q.and(
          q.eq(q.field("customTemplateId"), args.templateId),
          q.eq(q.field("status"), "queued")
        )
      )
      .first();
    if (queuedEmail) {
      throw new Error("Cannot delete template — there are queued emails using it");
    }

    await ctx.db.delete(args.templateId);
    return null;
  },
});

/** Duplicate a custom email template. */
export const duplicate = adminMutation({
  args: { templateId: v.id("emailTemplates") },
  returns: v.id("emailTemplates"),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    // Generate unique copy name
    let copyName = `${template.name}-copy`;
    let counter = 1;
    while (
      await ctx.db
        .query("emailTemplates")
        .withIndex("by_name", (q) => q.eq("name", copyName))
        .first()
    ) {
      counter++;
      copyName = `${template.name}-copy-${counter}`;
    }

    const now = Date.now();
    return await ctx.db.insert("emailTemplates", {
      name: copyName,
      label: `${template.label} (Copy)`,
      subject: template.subject,
      editorMode: template.editorMode,
      contentJson: template.contentJson,
      contentHtml: template.contentHtml,
      variables: template.variables,
      createdBy: ctx.user._id,
      updatedBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});
