"use node";

// eslint-disable-next-line no-restricted-imports -- actions require manual auth check
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { renderCustomTemplate } from "./customTemplateRender";

/** Preview a custom template by rendering to HTML. Admin only. */
export const previewTemplate = action({
  args: {
    editorMode: v.union(v.literal("visual"), v.literal("html")),
    contentJson: v.string(),
    contentHtml: v.optional(v.string()),
    variables: v.string(), // JSON string of Record<string, string>
    subject: v.string(),
  },
  returns: v.object({ html: v.string(), subject: v.string() }),
  handler: async (ctx, args) => {
    // Manual admin auth check (actions can't use adminQuery builders)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const isAdmin = await ctx.runQuery(internal.emails.checkIsAdmin);
    if (!isAdmin) throw new Error("Admin access required");

    const variables = JSON.parse(args.variables) as Record<string, string>;
    return await renderCustomTemplate(
      args.editorMode,
      args.contentJson,
      args.contentHtml,
      variables,
      args.subject
    );
  },
});
