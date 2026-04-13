// PreToolUse hook: validate diagrams and CLAUDE.md architecture tree
// are up-to-date before git commit. Spawns a fixer agent synchronously
// if stale, stages the updated files, then allows the commit.
//
// Replaces the old check-diagrams.sh — uses content-derived watches
// from diagram-watches.ts instead of a hardcoded case statement.

import { existsSync, statSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import {
  scanAllDiagrams,
  resolveAffectedDiagrams,
  isSourceTreeFile,
  WATCHED_TREE_ROOTS,
} from "./diagram-watches";

// ── Types ──────────────────────────────────────────────────────────────

interface HookInput {
  tool_input: {
    command?: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const DIAGRAM_DIR = join(PROJECT_ROOT, "memory", "ai", "diagrams");
const STALENESS_SECONDS = 300; // 5 minutes

/**
 * Run a git command synchronously in the project root and return
 * stdout lines (empty array on failure).
 */
function git(...args: string[]): string[] {
  const result = spawnSync("git", args, {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 10_000,
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Detect structural changes (adds/deletes/renames) in watched source
 * directories by parsing `git status --porcelain`. Content-only edits
 * are ignored — they don't affect the CLAUDE.md architecture tree.
 */
function detectStructuralChanges(): {
  hasChange: boolean;
  added: string[];
  deleted: string[];
  renamed: string[];
} {
  const empty = { hasChange: false, added: [], deleted: [], renamed: [] };
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 5000,
  });
  if (result.status !== 0 || !result.stdout) return empty;

  const ignoredSuffixes = ["routeTree.gen.ts", "routeTree.gen.tsx"];
  const ignoredFragments = ["_generated/"];
  const inWatched = (p: string) =>
    WATCHED_TREE_ROOTS.some((root) => p.startsWith(root));
  const isIgnored = (p: string) =>
    ignoredSuffixes.some((s) => p.endsWith(s)) ||
    ignoredFragments.some((f) => p.includes(f));

  const added: string[] = [];
  const deleted: string[] = [];
  const renamed: string[] = [];

  for (const rawLine of result.stdout.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    let rest = line.slice(3);

    const stripQuotes = (s: string) =>
      s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;

    if (x === "R" || y === "R") {
      const arrow = rest.indexOf(" -> ");
      const newPath = arrow !== -1 ? rest.slice(arrow + 4) : rest;
      const path = stripQuotes(newPath.trim());
      if (inWatched(path) && !isIgnored(path)) renamed.push(path);
      continue;
    }

    const path = stripQuotes(rest.trim());
    if (isIgnored(path)) continue;
    if (!inWatched(path)) continue;

    if (x === "A" || x === "?" || (x === " " && y === "A")) {
      added.push(path);
    } else if (x === "D" || (x === " " && y === "D")) {
      deleted.push(path);
    }
  }

  const hasChange = added.length > 0 || deleted.length > 0 || renamed.length > 0;
  return { hasChange, added, deleted, renamed };
}

// ── Main ───────────────────────────────────────────────────────────────

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}

const input: HookInput = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
const command = input.tool_input?.command ?? "";

// Only act on git commit commands
if (!command.startsWith("git commit")) {
  process.exit(0);
}

// Skip if diagram directory doesn't exist
if (!existsSync(DIAGRAM_DIR)) {
  process.exit(0);
}

// Get staged files (these are what's being committed)
const stagedFiles = git("diff", "--cached", "--name-only");
if (stagedFiles.length === 0) {
  process.exit(0);
}

// ── Resolve affected diagrams via content-derived watches ─────────────

const diagramWatches = scanAllDiagrams(DIAGRAM_DIR);
const { affected } = resolveAffectedDiagrams(stagedFiles, diagramWatches);

// ── Check staleness of affected diagrams ──────────────────────────────

const now = Math.floor(Date.now() / 1000);
const staleItems: string[] = [];

for (const diagram of affected) {
  const diagramRelPath = `memory/ai/diagrams/${diagram}`;
  const diagramAbsPath = join(PROJECT_ROOT, diagramRelPath);

  if (!existsSync(diagramAbsPath)) {
    staleItems.push(`${diagram}(missing)`);
    continue;
  }

  // Diagram has unstaged modifications — stop hook updated it but it wasn't staged
  const unstaged = git("diff", "--name-only", diagramRelPath);
  if (unstaged.length > 0) {
    staleItems.push(`${diagram}(unstaged)`);
    continue;
  }

  // Diagram exists and is clean — check if it's staged with this commit
  const staged = git("diff", "--cached", "--name-only", diagramRelPath);
  if (staged.length === 0) {
    // Not staged — may be out of date. Check mtime staleness.
    try {
      const mtime = Math.floor(statSync(diagramAbsPath).mtimeMs / 1000);
      const age = now - mtime;
      if (age > STALENESS_SECONDS) {
        staleItems.push(`${diagram}(outdated)`);
      }
    } catch {
      staleItems.push(`${diagram}(outdated)`);
    }
  }
}

// ── Check CLAUDE.md architecture tree staleness ───────────────────────

let archStale = false;

// Check if any staged files are in the watched source tree
const needsArchUpdate = stagedFiles.some((f) => isSourceTreeFile(f));

if (needsArchUpdate) {
  // Also require actual structural changes (adds/deletes/renames)
  const structural = detectStructuralChanges();
  if (structural.hasChange) {
    const claudeMdPath = join(PROJECT_ROOT, "CLAUDE.md");
    if (existsSync(claudeMdPath)) {
      const unstagedClaude = git("diff", "--name-only", "CLAUDE.md");
      if (unstagedClaude.length > 0) {
        archStale = true;
        staleItems.push("CLAUDE.md:architecture(unstaged)");
      } else {
        const stagedClaude = git("diff", "--cached", "--name-only", "CLAUDE.md");
        if (stagedClaude.length === 0) {
          try {
            const mtime = Math.floor(statSync(claudeMdPath).mtimeMs / 1000);
            const age = now - mtime;
            if (age > STALENESS_SECONDS) {
              archStale = true;
              staleItems.push("CLAUDE.md:architecture(outdated)");
            }
          } catch {
            archStale = true;
            staleItems.push("CLAUDE.md:architecture(outdated)");
          }
        }
      }
    }
  }
}

// ── Nothing stale? Allow the commit. ──────────────────────────────────

if (staleItems.length === 0) {
  process.exit(0);
}

// ── Stale items detected — spawn fixer agent ──────────────────────────

const staleList = staleItems.join(", ");
console.error(`\n\u26A0 Stale documentation detected: ${staleList}`);
console.error("  Spawning updater to fix before commit...\n");

// Build prompt for sub-Claude
const changedSrc = stagedFiles
  .filter((f) => !f.startsWith("memory/ai/diagrams/") && f !== "CLAUDE.md")
  .join(", ");

let prompt = `The following source files are being committed: ${changedSrc}. These items need updating: ${staleList}.`;

// Add diagram instructions if any diagrams are stale
const diagramStale = staleItems.filter((s) => !s.startsWith("CLAUDE.md"));
if (diagramStale.length > 0) {
  prompt +=
    " Read each affected diagram in memory/ai/diagrams/ and the relevant source files, then update the diagrams to reflect the current code.";
}

// Add CLAUDE.md architecture tree instructions if needed
if (archStale) {
  prompt +=
    " ALSO update the ## Architecture file tree section in CLAUDE.md. Read the current CLAUDE.md, then scan the actual file structure (convex/, src/routes/, src/components/, src/lib/, .claude/hooks/) and update the tree to match reality. Keep the same format — indented file tree with inline comments. Only update the tree block, do not change any other section.";
}

prompt += " Do NOT commit. Leave changes as unstaged files.";

// Spawn claude synchronously to fix documentation
spawnSync("claude", ["-p", "--model", "sonnet", prompt], {
  cwd: PROJECT_ROOT,
  stdio: ["ignore", "inherit", "inherit"],
  timeout: 300_000, // 5 minute max
});

// Stage the updated diagram files
for (const diagram of affected) {
  const diagramAbsPath = join(PROJECT_ROOT, "memory", "ai", "diagrams", diagram);
  if (existsSync(diagramAbsPath)) {
    spawnSync("git", ["add", `memory/ai/diagrams/${diagram}`], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    });
  }
}

// Stage CLAUDE.md if it was updated
if (archStale && existsSync(join(PROJECT_ROOT, "CLAUDE.md"))) {
  spawnSync("git", ["add", "CLAUDE.md"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
}

console.error("\n\u2713 Documentation updated and staged. Proceeding with commit.\n");

process.exit(0);
