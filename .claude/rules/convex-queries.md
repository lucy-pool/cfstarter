# Convex Query Rules — Always Use Indexes

When writing or editing any Convex query function:

1. **ALWAYS use `.withIndex()` as the primary filter.** Never use `.filter()` alone on any table — it causes a full table scan.
2. **Define indexes first in `convex/schema.ts`.** Every field you filter on must be in an index. Use compound indexes for multi-field filters, with fields in the order you query them.
3. **Use `.paginate()` for unbounded results.** Never `.collect()` a query that could return hundreds+ rows. Use `paginationOptsValidator` in args and `usePaginatedQuery` on the frontend.
4. **`.filter()` is only for secondary conditions** that can't go in the index (OR logic, computed values, inequality on non-last field).
5. **Put equality checks inside `.withIndex()`, not `.filter()`.** If you're writing `.filter(q => q.eq(...))`, that field belongs in the index.

## Correct pattern

```ts
// schema.ts — define the index
.index("by_project_status", ["projectId", "status", "createdAt"])

// query — use the index
ctx.db.query("tasks")
  .withIndex("by_project_status", q => q.eq("projectId", args.projectId))
  .order("desc")
  .paginate(args.paginationOpts)
```

## Wrong pattern

```ts
// ❌ Full table scan — NEVER do this
ctx.db.query("tasks")
  .filter(q => q.eq(q.field("projectId"), args.projectId))
  .collect()
```

A PostToolUse hook runs automatically to enforce these rules. If it flags a violation, fix it immediately.
