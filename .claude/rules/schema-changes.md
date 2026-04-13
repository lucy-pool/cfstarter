---
paths:
  - convex/schema.ts
---

# Schema Modification Rules

- **New fields on existing tables** MUST use `v.optional()`. Existing documents without the field will fail validation on schema push.
- **Adding an index:** Field order matters. Compound index fields are matched left-to-right. You can query a prefix of the fields but cannot skip a field in the middle.
- **Removing a field:** Two-step process. First make it `v.optional()` and deploy. Then backfill/remove data and deploy again. Never remove a required field in one step.
- **Validators** (`roleValidator`, `fileTypeValidator`, `uploadStatusValidator`, etc.) are defined at the top of `schema.ts`. Update them when adding new enum values.
- **After any schema change**, run `bunx convex typecheck` to verify all function signatures still match the updated schema types.
- **Union types:** Use `v.union()` for fields that accept multiple shapes. Each branch must be distinguishable.
- **System fields** (`_id`, `_creationTime`) are automatic. Never define them in the schema.
