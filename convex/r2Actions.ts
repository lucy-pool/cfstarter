"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { r2 } from "./r2";

// ── R2 actions (Node.js runtime) ────────────────────────────────────
// Download URL generation requires the AWS SDK (Node.js only).

/** Get a presigned GET URL for downloading a file from R2. */
export const generateDownloadUrl = action({
  args: {
    storageKey: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    return await r2.getUrl(args.storageKey);
  },
});
