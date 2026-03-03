import {
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { emailStatusValidator, emailTemplateValidator } from "./schema";
import { userMutation, adminMutation, adminQuery } from "./functions";
import { getCurrentUser } from "./authHelpers";

// ── Validators ──────────────────────────────────────────────────────

const emailLogValidator = v.object({
  _id: v.id("emailLogs"),
  _creationTime: v.number(),
  to: v.string(),
  subject: v.string(),
  template: emailTemplateValidator,
  templateData: v.string(),
  status: emailStatusValidator,
  provider: v.optional(v.string()),
  providerMessageId: v.optional(v.string()),
  error: v.optional(v.string()),
  sentAt: v.optional(v.number()),
  sentBy: v.optional(v.id("users")),
  customTemplateId: v.optional(v.id("emailTemplates")),
  createdAt: v.number(),
});

// ── User-facing mutations ───────────────────────────────────────────

/** Send an email (auth-gated). Creates a log and schedules delivery. */
export const sendEmail = userMutation({
  args: {
    to: v.string(),
    template: emailTemplateValidator,
    templateData: v.string(),
    customTemplateId: v.optional(v.id("emailTemplates")),
  },
  returns: v.id("emailLogs"),
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("emailLogs", {
      to: args.to,
      subject: "", // Will be set by the action after rendering
      template: args.template,
      templateData: args.templateData,
      status: "queued",
      sentBy: ctx.user._id,
      customTemplateId: args.customTemplateId,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.emailActions.processEmail, {
      logId,
    });

    return logId;
  },
});

/** Resend a failed email (admin only). Creates a new log from the old one. */
export const resendEmail = adminMutation({
  args: { logId: v.id("emailLogs") },
  returns: v.id("emailLogs"),
  handler: async (ctx, args) => {
    const oldLog = await ctx.db.get(args.logId);
    if (!oldLog) throw new Error("Email log not found");

    const newLogId = await ctx.db.insert("emailLogs", {
      to: oldLog.to,
      subject: "",
      template: oldLog.template,
      templateData: oldLog.templateData,
      status: "queued",
      sentBy: ctx.user._id,
      customTemplateId: oldLog.customTemplateId,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.emailActions.processEmail, {
      logId: newLogId,
    });

    return newLogId;
  },
});

// ── Internal mutations (for system-triggered emails) ────────────────

/** Create an email log without auth (for auth callbacks, system events). */
export const createEmailLog = internalMutation({
  args: {
    to: v.string(),
    template: emailTemplateValidator,
    templateData: v.string(),
    customTemplateId: v.optional(v.id("emailTemplates")),
  },
  returns: v.id("emailLogs"),
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("emailLogs", {
      to: args.to,
      subject: "",
      template: args.template,
      templateData: args.templateData,
      status: "queued",
      customTemplateId: args.customTemplateId,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.emailActions.processEmail, {
      logId,
    });

    return logId;
  },
});

/** Update an email log after send attempt. */
export const updateEmailLog = internalMutation({
  args: {
    logId: v.id("emailLogs"),
    status: emailStatusValidator,
    subject: v.optional(v.string()),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { logId, ...patch } = args;
    // Remove undefined values
    const cleanPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        cleanPatch[key] = value;
      }
    }
    await ctx.db.patch(logId, cleanPatch);
  },
});

// ── Internal queries ────────────────────────────────────────────────

/** Check if the current caller is an admin (for use from actions). */
export const checkIsAdmin = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    try {
      const user = await getCurrentUser(ctx);
      return (user.roles ?? []).includes("admin");
    } catch {
      return false;
    }
  },
});

/** Read an email log (for the send action). */
export const getEmailLogInternal = internalQuery({
  args: { logId: v.id("emailLogs") },
  returns: v.union(emailLogValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.logId);
  },
});

// ── Admin queries ───────────────────────────────────────────────────

/** List email logs (admin only). Returns last 500 ordered desc by createdAt. */
export const listEmailLogs = adminQuery({
  args: {},
  returns: v.array(emailLogValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("emailLogs")
      .withIndex("by_created_at")
      .order("desc")
      .take(500);
  },
});
