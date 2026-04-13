// PostToolUse hook: validates that "use node" files only export actions.
//
// Convex "use node" files run in the Node.js runtime and CANNOT export
// queries or mutations — only actions and internalActions are allowed.
// This hook catches violations immediately after editing.

import { readFileSync, existsSync } from "fs";

// ── Types ──────────────────────────────────────────────────────────────

interface HookInput {
  tool_input: {
    file_path?: string;
    path?: string;
  };
}

interface Violation {
  line: number;
  exportName: string;
  functionType: string;
}

// ── Analysis ───────────────────────────────────────────────────────────

const FORBIDDEN_IN_NODE = [
  "query",
  "mutation",
  "userQuery",
  "userMutation",
  "adminQuery",
  "adminMutation",
  "internalQuery",
  "internalMutation",
];

function isUseNodeFile(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }
    // Check for "use node" directive (with single or double quotes)
    return trimmed === '"use node";' || trimmed === "'use node';";
  }
  return false;
}

function findViolations(content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split("\n");

  // Build regex pattern for forbidden exports
  // Matches: export const someName = query( or = userQuery( etc.
  const pattern = new RegExp(
    `^\\s*export\\s+const\\s+(\\w+)\\s*=\\s*(${FORBIDDEN_IN_NODE.join("|")})\\s*\\(`,
  );

  for (let i = 0; i < lines.length; i++) {
    const match = pattern.exec(lines[i]);
    if (match) {
      violations.push({
        line: i + 1, // 1-indexed
        exportName: match[1],
        functionType: match[2],
      });
    }
  }

  return violations;
}

// ── Main ───────────────────────────────────────────────────────────────

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}

const input: HookInput = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
const filePath = input.tool_input.file_path || input.tool_input.path;

if (!filePath) process.exit(0);

// Only act on .ts/.tsx files inside a convex/ directory
const segments = filePath.split("/");
const convexIdx = segments.lastIndexOf("convex");
if (convexIdx === -1 || !/\.tsx?$/.test(filePath)) process.exit(0);

// Skip generated files
if (segments.includes("_generated")) process.exit(0);

// Skip non-existent files
if (!existsSync(filePath)) process.exit(0);

const content = readFileSync(filePath, "utf-8");

// Only lint "use node" files
if (!isUseNodeFile(content)) process.exit(0);

const violations = findViolations(content);

if (violations.length > 0) {
  const details = violations
    .map(
      (v) =>
        `- Line ${v.line}: "export const ${v.exportName} = ${v.functionType}(..." \u2014 ` +
        `${v.functionType} cannot be exported from a "use node" file.`
    )
    .join("\n");

  console.log(
    JSON.stringify({
      feedback:
        `\u26A0\uFE0F  CONVEX NODE LINT \u2014 ${violations.length} violation(s):\n${details}\n\n` +
        `"use node" files can ONLY export actions and internalActions.\n` +
        `Queries and mutations must be in a separate file without the "use node" directive.\n` +
        `Use the split pattern: feature.ts (queries/mutations) + featureActions.ts ("use node" actions).`,
    })
  );
}
