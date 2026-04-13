---
paths:
  - convex/storage/**/*.ts
  - src/**/files*
---

# Two-Phase File Upload Lifecycle

The upload flow uses a pending/complete pattern for reliability:

1. **Phase 1:** Call `createPendingFile` mutation -- creates a DB record with `status: "pending"`.
2. **Phase 2:** Upload the file to R2 via `@convex-dev/r2` -- returns a `storageKey`.
3. **Phase 3:** Call `confirmUpload` mutation -- attaches `storageKey` and sets `status: "complete"`.

## Rules

- `getMyFiles` only returns documents with `status: "complete"`. Pending uploads are invisible to users.
- If the upload fails or is abandoned, the record stays `pending`. A cron job cleans up stale pending records every 30 minutes.
- Legacy records without a `status` field are treated as `complete`.
- Never skip the two-phase pattern by inserting a record directly with a storageKey -- this bypasses orphan cleanup.
- Download URLs are generated via `generateDownloadUrl` action in `convex/storage/downloads.ts`.
