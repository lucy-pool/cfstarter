// PostToolUse hook: per-query-chain lint for Convex anti-patterns.
//
// Improvements over the bash version:
//  - Per-query-chain analysis, not file-level — one good function
//    no longer masks violations in another.
//  - Line numbers in every violation message.
//  - Multi-line pattern matching (`.filter((q) =>\n  q.eq(...)`)
//    is handled correctly.
//  - Reports the table name for each violation.

import { readFileSync, existsSync } from "fs";

// ── Types ──────────────────────────────────────────────────────────────

interface HookInput {
  tool_input: {
    file_path?: string;
    path?: string;
  };
}

interface QueryChain {
  /** 1-indexed line where `.query("table")` appears */
  line: number;
  /** Table name from `.query("tableName")` */
  table: string;
  /** The full text of the chained expression */
  text: string;
}

interface Violation {
  line: number;
  table: string;
  type: "full-table-scan" | "unbounded-collect" | "inefficient-filter";
  message: string;
}

// ── Chain extraction ───────────────────────────────────────────────────

/**
 * Find every `ctx.db.query("tableName")` call and extract its method
 * chain (up to 20 lines or a statement terminator). Each chain is
 * analyzed independently so violations in one function don't get masked
 * by correct usage in another.
 */
function extractQueryChains(content: string): QueryChain[] {
  const lines = content.split("\n");
  const chains: QueryChain[] = [];
  const queryRe = /\.query\(\s*["'](\w+)["']\s*\)/;

  for (let i = 0; i < lines.length; i++) {
    const match = queryRe.exec(lines[i]);
    if (!match) continue;

    const table = match[1];
    const startLine = i + 1; // 1-indexed

    // Collect lines forward until the chain ends. We continue while:
    //  - parens are still unbalanced (inside an argument list), OR
    //  - the next non-blank line starts with `.` (method continuation)
    // Stop at `;` or after 20 lines max.
    let chainText = "";
    let parenDepth = 0;

    for (let j = i; j < lines.length && j < i + 20; j++) {
      const line = lines[j];
      chainText += line + "\n";

      for (const ch of line) {
        if (ch === "(") parenDepth++;
        if (ch === ")") parenDepth--;
      }

      // Stop at semicolons (statement end)
      if (line.includes(";")) break;

      // Keep going if parens are still open (we're inside an argument)
      if (parenDepth > 0) continue;

      // Peek ahead: if the next non-blank line doesn't continue the
      // chain (i.e. doesn't start with `.`), we're done.
      let nextIdx = j + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim() === "") nextIdx++;
      if (nextIdx >= lines.length) break;
      if (!/^\s*\./.test(lines[nextIdx])) break;
    }

    chains.push({ line: startLine, table, text: chainText });
  }

  return chains;
}

// ── Lint rules ─────────────────────────────────────────────────────────

function lintChain(chain: QueryChain): Violation[] {
  const violations: Violation[] = [];
  const { text, line, table } = chain;

  const hasWithIndex = text.includes(".withIndex(");
  const hasFilter = /\.filter\s*\(/.test(text);
  const hasCollect = text.includes(".collect()");
  const hasPaginate = text.includes(".paginate(");
  const hasTake = /\.take\s*\(/.test(text);
  const hasFirst = text.includes(".first()");
  const hasUnique = text.includes(".unique()");
  const hasRangeBound = /\.(lt|lte|gt|gte)\s*\(/.test(text);

  // Rule 1: .filter() without .withIndex() → full table scan
  if (hasFilter && !hasWithIndex) {
    violations.push({
      line,
      table,
      type: "full-table-scan",
      message:
        `Query on "${table}" uses .filter() without .withIndex() — this scans every row in the table. ` +
        `Add an index in convex/schema.ts and use .withIndex() before .filter().`,
    });
  }

  // Rule 2: .collect() without bounds on an unbounded query
  if (
    hasCollect &&
    !hasPaginate &&
    !hasTake &&
    !hasFirst &&
    !hasUnique &&
    !hasRangeBound
  ) {
    violations.push({
      line,
      table,
      type: "unbounded-collect",
      message:
        `Query on "${table}" uses .collect() without pagination or bounds. ` +
        `Use .paginate(paginationOpts) for lists, or .take(n)/.first() for small result sets.`,
    });
  }

  // Rule 3: .filter() with q.eq() after .withIndex() — equality belongs in the index
  // Simple heuristic: if the chain has both .withIndex() and .filter() and
  // somewhere after .filter( there's a q.eq( call, flag it.
  if (hasWithIndex && hasFilter) {
    const filterIdx = text.indexOf(".filter");
    if (filterIdx !== -1) {
      const afterFilter = text.slice(filterIdx);
      if (/q\.eq\s*\(/.test(afterFilter)) {
        violations.push({
          line,
          table,
          type: "inefficient-filter",
          message:
            `Query on "${table}" has .filter(q => q.eq(...)) after .withIndex(). ` +
            `Move equality checks into the .withIndex() call and add the field to the compound index in convex/schema.ts.`,
        });
      }
    }
  }

  return violations;
}

function lintFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, "utf-8");
  const chains = extractQueryChains(content);
  return chains.flatMap(lintChain);
}

// ── Main ───────────────────────────────────────────────────────────────

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}

const input: HookInput = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
const filePath = input.tool_input.file_path || input.tool_input.path;

if (!filePath) process.exit(0);

// Only lint .ts/.tsx inside this project's convex/ directory
// Use the directory structure: the file must be under a convex/ dir at project root
const segments = filePath.split("/");
const convexIdx = segments.lastIndexOf("convex");
if (convexIdx === -1 || !/\.tsx?$/.test(filePath)) process.exit(0);

// Skip schema, generated files, and config files
const basename = segments[segments.length - 1];
if (
  basename === "schema.ts" ||
  basename === "convex.config.ts" ||
  segments.includes("_generated")
)
  process.exit(0);

// Skip non-existent files
if (!existsSync(filePath)) process.exit(0);

const violations = lintFile(filePath);

if (violations.length > 0) {
  const details = violations
    .map((v) => `- Line ${v.line}: [${v.type.toUpperCase()}] ${v.message}`)
    .join("\n");

  console.log(
    JSON.stringify({
      feedback:
        `⚠️  CONVEX QUERY LINT — ${violations.length} violation(s) in ${basename}:\n${details}\n\n` +
        `Fix these now. Rules:\n` +
        `1. Always use .withIndex() as the primary filter — never .filter() alone.\n` +
        `2. Define indexes in convex/schema.ts with fields in query order.\n` +
        `3. Use .paginate() instead of .collect() for unbounded result sets.\n` +
        `4. Move equality checks from .filter() into .withIndex().`,
    }),
  );
}
