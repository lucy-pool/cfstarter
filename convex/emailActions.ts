"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { renderTemplate } from "./emailTemplates";
import { getEmailProvider } from "./emailProvider";
import { renderCustomTemplate } from "./customTemplateRender";

// ── Process email action ────────────────────────────────────────────
// Reads log → renders template → sends via provider → updates log.

export const processEmail = internalAction({
  args: { logId: v.id("emailLogs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.runQuery(internal.emails.getEmailLogInternal, {
      logId: args.logId,
    });

    if (!log) {
      console.error(`Email log ${args.logId} not found`);
      return null;
    }

    try {
      // Parse template data and render
      const templateData = JSON.parse(log.templateData);
      let html: string;
      let subject: string;

      if (log.template === "custom" && log.customTemplateId) {
        // Custom template: fetch from DB and render
        const template = await ctx.runQuery(
          internal.customTemplates.getInternal,
          { templateId: log.customTemplateId }
        );
        if (!template) throw new Error("Custom template not found");
        const result = await renderCustomTemplate(
          template.editorMode,
          template.contentJson,
          template.contentHtml,
          templateData,
          template.subject
        );
        html = result.html;
        subject = result.subject;
      } else {
        // Hardcoded template path
        const rendered = await renderTemplate(
          log.template as Parameters<typeof renderTemplate>[0],
          templateData
        );
        html = rendered.html;
        subject = rendered.subject;
      }

      // Send via provider
      const from = process.env.EMAIL_FROM ?? "noreply@example.com";
      const provider = getEmailProvider();
      const result = await provider.send({
        from,
        to: log.to,
        subject,
        html,
      });

      // Update log as sent
      await ctx.runMutation(internal.emails.updateEmailLog, {
        logId: args.logId,
        status: "sent",
        subject,
        provider: result.provider,
        providerMessageId: result.messageId,
        sentAt: Date.now(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to send email ${args.logId}:`, errorMessage);

      // Update log as failed
      await ctx.runMutation(internal.emails.updateEmailLog, {
        logId: args.logId,
        status: "failed",
        error: errorMessage,
      });
    }

    return null;
  },
});

// ── Email config status ───────────────────────────────────────────
// Returns which provider is active + non-sensitive config details.

const emailConfigValidator = v.object({
  activeProvider: v.union(
    v.literal("resend"),
    v.literal("smtp"),
    v.literal("none")
  ),
  from: v.string(),
  resend: v.object({ configured: v.boolean() }),
  smtp: v.object({
    configured: v.boolean(),
    host: v.optional(v.string()),
    port: v.string(),
    secure: v.boolean(),
    hasAuth: v.boolean(),
  }),
});

// eslint-disable-next-line no-restricted-imports -- actions require manual auth check
export const getEmailConfig = action({
  args: {},
  returns: emailConfigValidator,
  handler: async (ctx) => {
    // Manual admin check (actions can't use adminQuery builders)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    const isAdmin = await ctx.runQuery(internal.emails.checkIsAdmin);
    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    const hasResend = !!process.env.RESEND_API_KEY;
    const hasSmtp = !!process.env.SMTP_HOST;

    return {
      activeProvider: hasResend
        ? ("resend" as const)
        : hasSmtp
          ? ("smtp" as const)
          : ("none" as const),
      from: process.env.EMAIL_FROM ?? "noreply@example.com",
      resend: { configured: hasResend },
      smtp: {
        configured: hasSmtp,
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ?? "587",
        secure: process.env.SMTP_SECURE === "true",
        hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      },
    };
  },
});
