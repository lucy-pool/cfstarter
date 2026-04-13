// PostToolUse hook: warns about non-optional fields in Convex schema definitions.
//
// Only flags NEW or MODIFIED lines (via git diff) — existing required fields
// in the schema are intentional and should not trigger warnings on every edit.
//
// Any newly added field in a defineTable() block that is NOT v.optional() and
// NOT v.id() gets flagged. If the table already has data, adding a required
// field will break the schema push.

import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";

// ── Types ──────────────────────────────────────────────────────────────

interface HookInput {
  tool_input: {
    file_path?: string;
    path?: string;
  };
}

interface FieldWarning {
  line: number;
  tableName: string;
  fieldName: string;
  validator: string;
}

// ── Diff-based analysis ────────────────────────────────────────────────

/**
 * Get line numbers of newly added lines (unstaged changes) via git diff.
 * Returns a Set of 1-indexed line numbers that were added or modified.
 */
function getNewLineNumbers(filePath: string): Set<number> {
  const result = spawnSync(
    "git",
    ["diff", "--unified=0", "--no-color", "--", filePath],
    { encoding: "utf-8", timeout: 5000 },
  );

  const newLines = new Set<number>();
  if (result.status !== 0 || !result.stdout) return newLines;

  // Parse unified diff: lines starting with @@ contain line numbers
  // Format: @@ -old,count +new,count @@
  for (const line of result.stdout.split("\n")) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      const start = parseInt(hunkMatch[1], 10);
      const count = parseInt(hunkMatch[2] ?? "1", 10);
      for (let i = start; i < start + count; i++) {
        newLines.add(i);
      }
    }
  }

  return newLines;
}

/**
 * Find required (non-optional, non-id) fields in defineTable blocks,
 * but only on lines that are new/changed according to git diff.
 */
function findNewRequiredFields(
  content: string,
  newLines: Set<number>,
): FieldWarning[] {
  const warnings: FieldWarning[] = [];
  const lines = content.split("\n");

  let currentTable: string | null = null;
  let braceDepth = 0;
  let inDefineTable = false;

  const tableStartRe = /(\w+)\s*:\s*defineTable\s*\(\s*\{/;
  const fieldCallRe = /^\s*(\w+)\s*:\s*(v\.\w+)\s*\(/;
  const fieldRefRe = /^\s*(\w+)\s*:\s*(\w+)\s*[,)]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    const tableMatch = tableStartRe.exec(line);
    if (tableMatch) {
      currentTable = tableMatch[1];
      inDefineTable = true;
      braceDepth = 0;
      for (const ch of line.slice(line.indexOf("defineTable"))) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
    } else if (inDefineTable) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
    }

    // Only check fields on NEW lines at the top-level of a defineTable block
    if (inDefineTable && currentTable && braceDepth === 1 && newLines.has(lineNum)) {
      const callMatch = fieldCallRe.exec(line);
      if (callMatch) {
        const [, fieldName, validator] = callMatch;
        if (validator !== "v.optional" && validator !== "v.id") {
          warnings.push({ line: lineNum, tableName: currentTable, fieldName, validator: validator + "()" });
        }
        continue;
      }

      const refMatch = fieldRefRe.exec(line);
      if (refMatch) {
        const [, fieldName, validatorRef] = refMatch;
        if (!validatorRef.includes(".")) {
          warnings.push({ line: lineNum, tableName: currentTable, fieldName, validator: validatorRef });
        }
      }
    }

    if (inDefineTable && braceDepth <= 0) {
      inDefineTable = false;
      currentTable = null;
    }
  }

  return warnings;
}

// ── Main ───────────────────────────────────────────────────────────────

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}

const input: HookInput = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
const filePath = input.tool_input.file_path || input.tool_input.path;

if (!filePath) process.exit(0);

// Only act on schema.ts inside a convex/ directory
const segments = filePath.split("/");
const basename = segments[segments.length - 1];
if (basename !== "schema.ts") process.exit(0);
if (!segments.includes("convex")) process.exit(0);
if (!existsSync(filePath)) process.exit(0);

const content = readFileSync(filePath, "utf-8");
const newLines = getNewLineNumbers(filePath);

// No diff = no new lines = nothing to warn about. The file is clean.
// Only scan if there are actually new/changed lines to check.
if (newLines.size === 0) process.exit(0);

const warnings = findNewRequiredFields(content, newLines);

if (warnings.length > 0) {
  const details = warnings
    .map(
      (w) =>
        `- Line ${w.line}: "${w.tableName}.${w.fieldName}" uses ${w.validator} (required). ` +
        `If this table already has data, wrap in v.optional() or the schema push will fail.`,
    )
    .join("\n");

  console.log(
    JSON.stringify({
      feedback:
        `CONVEX SCHEMA LINT — ${warnings.length} new required field(s):\n${details}\n\n` +
        `Required fields are fine for NEW tables. For existing tables with data, use v.optional().`,
    }),
  );
}
