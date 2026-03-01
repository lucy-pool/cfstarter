import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { getCurrentUser } from "./authHelpers";

// ── R2 file storage ─────────────────────────────────────────────────
// Handles presigned URLs and metadata sync for Cloudflare R2.
// Upload flow: generateUploadUrl → PUT to R2 → syncMetadata.

export const r2 = new R2(components.r2);

export const { generateUploadUrl, syncMetadata } = r2.clientApi<DataModel>({
  checkUpload: async (ctx) => {
    await getCurrentUser(ctx);
  },
});
