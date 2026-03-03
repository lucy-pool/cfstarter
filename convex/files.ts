import { v } from "convex/values";
import { fileTypeValidator } from "./schema";
import { r2 } from "./r2";
import { userQuery, userMutation } from "./functions";

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
export const storeFileMetadata = userMutation({
  args: {
    fileName: v.string(),
    storageKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
  },
  returns: v.id("fileMetadata"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("fileMetadata", {
      fileName: args.fileName,
      storageKey: args.storageKey,
      mimeType: args.mimeType,
      size: args.size,
      fileType: args.fileType,
      createdBy: ctx.user._id,
      createdAt: Date.now(),
    });
  },
});

/** List the current user's files. */
export const getMyFiles = userQuery({
  args: {},
  returns: v.array(fileMetadataValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("fileMetadata")
      .withIndex("by_created_by", (q) => q.eq("createdBy", ctx.user._id))
      .collect();
  },
});

/** Delete file metadata and the R2 object (author only). */
export const deleteFile = userMutation({
  args: {
    fileId: v.id("fileMetadata"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (file.createdBy !== ctx.user._id) {
      throw new Error("Not authorized to delete this file");
    }
    await r2.deleteObject(ctx, file.storageKey);
    await ctx.db.delete(args.fileId);
  },
});
