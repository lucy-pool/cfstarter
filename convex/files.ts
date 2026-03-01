import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelpers";
import { fileTypeValidator } from "./schema";
import { r2 } from "./r2";

// ── File metadata CRUD ──────────────────────────────────────────────
// Stores metadata after a successful R2 upload.
// The upload flow: generateUploadUrl → PUT to R2 → storeFileMetadata.

const fileMetadataValidator = v.object({
  _id: v.id("fileMetadata"),
  _creationTime: v.number(),
  fileName: v.string(),
  storageKey: v.string(),
  mimeType: v.string(),
  size: v.number(),
  fileType: fileTypeValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
});

/** Save file metadata after successful R2 upload. */
export const storeFileMetadata = mutation({
  args: {
    fileName: v.string(),
    storageKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
  },
  returns: v.id("fileMetadata"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    return await ctx.db.insert("fileMetadata", {
      fileName: args.fileName,
      storageKey: args.storageKey,
      mimeType: args.mimeType,
      size: args.size,
      fileType: args.fileType,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

/** List the current user's files. */
export const getMyFiles = query({
  args: {},
  returns: v.array(fileMetadataValidator),
  handler: async (ctx) => {
    try {
      const user = await requireAuth(ctx);
      return await ctx.db
        .query("fileMetadata")
        .withIndex("by_created_by", (q) => q.eq("createdBy", user._id))
        .collect();
    } catch {
      return [];
    }
  },
});

/** Delete file metadata and the R2 object (author only). */
export const deleteFile = mutation({
  args: {
    fileId: v.id("fileMetadata"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (file.createdBy !== user._id) {
      throw new Error("Not authorized to delete this file");
    }
    await r2.deleteObject(ctx, file.storageKey);
    await ctx.db.delete(args.fileId);
  },
});
