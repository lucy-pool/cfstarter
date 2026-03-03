import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// ── Role values ─────────────────────────────────────────────────────
// Update these when you add your own roles.
export const ROLES = ["user", "admin"] as const;
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("admin")
);

// ── File type values ────────────────────────────────────────────────
export const fileTypeValidator = v.union(
  v.literal("audio"),
  v.literal("document"),
  v.literal("image")
);

// ── Message role values ─────────────────────────────────────────────
export const messageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant")
);

// ── Email values ────────────────────────────────────────────────────
export const emailStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("bounced")
);

export const emailTemplateValidator = v.union(
  v.literal("welcome"),
  v.literal("password-reset"),
  v.literal("email-verification"),
  v.literal("magic-link"),
  v.literal("team-invite"),
  v.literal("notification"),
  v.literal("account-deletion"),
  v.literal("custom")
);

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    roles: v.optional(v.array(roleValidator)),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("by_email", ["email"]),

  // ── File storage metadata ───────────────────────────────────────
  // Actual files live in Cloudflare R2. This table tracks metadata only.
  fileMetadata: defineTable({
    fileName: v.string(),
    storageKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_file_type", ["fileType"]),

  // ── AI chat messages ────────────────────────────────────────────
  // Stores conversation history for the AI chat demo.
  aiMessages: defineTable({
    userId: v.id("users"),
    role: messageRoleValidator,
    content: v.string(),
    model: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ── Email logs ─────────────────────────────────────────────────
  emailLogs: defineTable({
    to: v.string(),
    subject: v.string(),
    template: emailTemplateValidator,
    templateData: v.string(), // JSON string of template props
    status: emailStatusValidator,
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    sentBy: v.optional(v.id("users")),
    customTemplateId: v.optional(v.id("emailTemplates")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_template", ["template"])
    .index("by_to", ["to"])
    .index("by_created_at", ["createdAt"]),

  // ── Custom email templates ─────────────────────────────────────
  emailTemplates: defineTable({
    name: v.string(),
    label: v.string(),
    subject: v.string(),
    editorMode: v.union(v.literal("visual"), v.literal("html")),
    contentJson: v.string(),        // Maily Tiptap JSON (used when editorMode === "visual")
    contentHtml: v.optional(v.string()), // Raw HTML (used when editorMode === "html")
    variables: v.array(v.object({
      name: v.string(),
      required: v.boolean(),
      defaultValue: v.optional(v.string()),
    })),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_created_at", ["createdAt"]),

  // ── Demo table — replace with your own ──────────────────────────
  // Shows the basic pattern: table + indexes + validators.
  // Delete this and add your own tables.
  notes: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.id("users"),
    isPublic: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_public", ["isPublic"]),
});
