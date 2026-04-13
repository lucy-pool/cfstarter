import { spawn, spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import {
  scanAllDiagrams,
  resolveAffectedDiagrams,
  isSourceTreeFile,
  relativize,
  WATCHED_TREE_ROOTS,
} from "./diagram-watches";

interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}

interface TranscriptMessage {
  role: string;
  content: unknown;
}

interface ToolUseBlock {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
}

// ── Transcript parsing ──────────────────────────────────────────────

function getChangedFiles(transcriptPath: string): string[] {
  const changed = new Set<string>();
  try {
    const raw = readFileSync(transcriptPath, "utf-8");
    const lines = raw.split("\n").filter((line) => line.trim());
    const messages: TranscriptMessage[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.role) {
          messages.push(parsed as TranscriptMessage);
        } else if (parsed.type === "assistant" || parsed.message?.role) {
          const msg = parsed.message || parsed;
          if (msg.role) messages.push(msg as TranscriptMessage);
        }
      } catch {
        // Skip unparseable lines
      }
    }

    for (const msg of messages) {
      if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const b = block as ToolUseBlock;
        if (b.type !== "tool_use") continue;
        if (b.name === "Write" || b.name === "Edit") {
          const fp = b.input?.file_path as string | undefined;
          if (fp) changed.add(fp);
        }
      }
    }
  } catch (e) {
    console.error("Failed to read transcript:", e);
  }
  return Array.from(changed);
}

// ── Shell helpers ───────────────────────────────────────────────────

function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.on("close", (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

// ── Convex file scanning ────────────────────────────────────────────

function getConvexTsFiles(convexDir: string): { filePath: string; relPath: string }[] {
  const results: { filePath: string; relPath: string }[] = [];

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (
        entry.isDirectory() &&
        entry.name !== "_generated" &&
        entry.name !== "node_modules"
      ) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
        !entry.name.endsWith(".d.ts") &&
        entry.name !== "tsconfig.json"
      ) {
        const relPath = fullPath.slice(convexDir.length + 1);
        results.push({ filePath: fullPath, relPath });
      }
    }
  }

  walk(convexDir);
  return results;
}

// ── Lint checks ─────────────────────────────────────────────────────

// Client-only packages that should never appear in convex/ server code
const CLIENT_ONLY_PACKAGES = [
  "react",
  "react-dom",
  "@radix-ui",
  "lucide-react",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "tailwindcss",
];

function checkUnusedGeneratedImports(cwd: string): string[] {
  const convexDir = join(cwd, "convex");
  const errors: string[] = [];
  const files = getConvexTsFiles(convexDir);

  for (const { filePath, relPath } of files) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const importRegex =
      /import\s+\{([^}]+)\}\s+from\s+["']\.?\/?_generated\/\w+["'];?/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const importedNames = match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const resolvedNames = importedNames.map((name) => {
        let n = name.replace(/^type\s+/, "");
        const asMatch = n.match(/^\S+\s+as\s+(\S+)$/);
        if (asMatch) n = asMatch[1];
        return n;
      });

      const contentWithoutImportLine = content.replace(match[0], "");
      for (const name of resolvedNames) {
        const usageRegex = new RegExp(`\\b${name}\\b`);
        if (!usageRegex.test(contentWithoutImportLine)) {
          errors.push(`convex/${relPath}: unused import "${name}" from _generated`);
        }
      }
    }
  }

  return errors;
}

function checkClientImportsInConvex(cwd: string): string[] {
  const convexDir = join(cwd, "convex");
  const errors: string[] = [];
  const files = getConvexTsFiles(convexDir);

  for (const { filePath, relPath } of files) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    // "use node" files run in Node.js and may legitimately use React (e.g. @react-email)
    if (/^["']use node["'];?\s*$/m.test(content)) continue;

    const importRegex = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1];
      for (const pkg of CLIENT_ONLY_PACKAGES) {
        if (source === pkg || source.startsWith(pkg + "/")) {
          errors.push(
            `convex/${relPath}: imports client-only package "${source}"`
          );
        }
      }
    }
  }

  return errors;
}


// ── Diagram maintenance ─────────────────────────────────────────────

const DIAGRAM_DIR = "memory/ai/diagrams";
const DIAGRAM_LOCK_FILE = join(import.meta.dir, ".diagram-update.lock");
const DEBOUNCE_SECONDS = 30;

function isDiagramUpdateDebounced(): boolean {
  try {
    if (!existsSync(DIAGRAM_LOCK_FILE)) return false;
    const stat = statSync(DIAGRAM_LOCK_FILE);
    const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
    if (ageSeconds >= DEBOUNCE_SECONDS) return false;

    // If the PID in the lock file is still alive, an updater is running.
    // If it died, allow a new one despite the debounce.
    const pid = parseInt(readFileSync(DIAGRAM_LOCK_FILE, "utf-8").trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0); // signal 0 = check if process exists
        return true; // process alive → debounce
      } catch {
        return false; // process dead → allow new spawn
      }
    }

    return true; // no valid PID → respect mtime debounce
  } catch {
    return false;
  }
}

function touchLockFile(): void {
  try {
    writeFileSync(DIAGRAM_LOCK_FILE, String(process.pid));
  } catch {
    // Best-effort
  }
}

export interface StructuralChanges {
  hasChange: boolean;
  added: string[];
  deleted: string[];
  renamed: string[];
}

/**
 * Parse `git status --porcelain` and classify each entry in a watched
 * source directory as added / deleted / renamed. Pure content edits
 * (`M`, `MM`, etc.) are deliberately ignored — they don't require a
 * CLAUDE.md `## Architecture` tree refresh.
 *
 * Returns rich delta info so the updater prompt can name the exact
 * files that changed shape, letting sub-Claude target its edits
 * instead of re-scanning the entire tree.
 */
export function detectStructuralChanges(cwd: string): StructuralChanges {
  const empty: StructuralChanges = {
    hasChange: false,
    added: [],
    deleted: [],
    renamed: [],
  };

  let result;
  try {
    result = spawnSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    });
  } catch {
    return empty;
  }
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
    // Porcelain v1: "XY <path>" (cols 0-1 = status, col 2 = space, then path).
    const status = line.slice(0, 2);
    const x = status[0];
    const y = status[1];
    let rest = line.slice(3);

    // Strip surrounding quotes (git quotes paths with special chars).
    const stripQuotes = (s: string) =>
      s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;

    // Renames: "R  old -> new" — only the new path matters for the tree.
    if (x === "R" || y === "R") {
      const arrow = rest.indexOf(" -> ");
      const newPath = arrow !== -1 ? rest.slice(arrow + 4) : rest;
      const path = stripQuotes(newPath.trim());
      if (inWatched(path) && !isIgnored(path)) renamed.push(path);
      continue;
    }

    const path = stripQuotes(rest.trim());
    if (!inWatched(path) || isIgnored(path)) continue;

    const isUntracked = x === "?" && y === "?";
    if (isUntracked || x === "A" || y === "A") {
      added.push(path);
    } else if (x === "D" || y === "D") {
      deleted.push(path);
    }
    // M / MM / MR etc. — pure content edit, ignore for the tree.
  }

  return {
    hasChange: added.length > 0 || deleted.length > 0 || renamed.length > 0,
    added,
    deleted,
    renamed,
  };
}

// ── Main ────────────────────────────────────────────────────────────

function block(reason: string): void {
  console.log(JSON.stringify({ decision: "block", reason }));
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const input: HookInput = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

  // Only act on Stop events
  if (input.hook_event_name !== "Stop") return;

  const changedFiles = getChangedFiles(input.transcript_path);
  if (changedFiles.length === 0) return;

  // --- Check 0: Run tests ---
  const convexDir = join(input.cwd, "convex");
  const hasTestChanges = changedFiles.some((f) => f.startsWith(convexDir + "/"));
  if (hasTestChanges) {
    console.error("Running tests...");
    const testResult = await runCommand("bun", ["run", "test"], input.cwd);
    if (testResult.code !== 0) {
      block(`Tests failed. Please fix them:\n${testResult.output}`);
      return;
    }
  }

  // --- Check 1: TypeScript typecheck ---
  console.error("Running TypeScript typecheck...");
  const tsResult = await runCommand("bun", ["run", "typecheck"], input.cwd);
  if (tsResult.code !== 0) {
    block(`TypeScript errors found. Please fix them:\n${tsResult.output}`);
    return;
  }

  // --- Check 2: Convex typecheck (schema vs function signatures) ---
  console.error("Running Convex typecheck...");
  const convexResult = await runCommand(
    "bunx",
    ["convex", "typecheck"],
    input.cwd
  );
  if (convexResult.code !== 0) {
    block(
      `Convex typecheck failed. Please fix the function signature / schema errors:\n${convexResult.output}`
    );
    return;
  }

  // --- Check 3: Unused _generated imports ---
  console.error("Checking for unused _generated imports...");
  const unusedImports = checkUnusedGeneratedImports(input.cwd);
  if (unusedImports.length > 0) {
    block(
      `Unused imports from convex/_generated found. Please remove them:\n${unusedImports.join("\n")}`
    );
    return;
  }

  // --- Check 4: Client-only packages in server code ---
  console.error("Checking for client-only imports in convex/...");
  const clientImports = checkClientImportsInConvex(input.cwd);
  if (clientImports.length > 0) {
    block(
      `Client-only packages imported in server-side Convex code. Please remove them:\n${clientImports.join("\n")}`
    );
    return;
  }

  // --- All checks passed — decide whether to spawn a diagram updater ---
  //
  // Four signals feed the decision:
  //
  //  (1) Layer 1 hit       — a changed file is referenced (by exact
  //                          path or parent directory) in one or more
  //                          diagrams' text. Those diagrams need an
  //                          update to reflect the new code.
  //  (2) Layer 2 gap-fill  — a changed file lives in a watched source
  //                          directory but is NOT referenced anywhere.
  //                          The updater decides whether to extend an
  //                          existing diagram or create a new one.
  //  (3) Structural tree   — git status shows adds/deletes/renames in
  //                          watched directories → CLAUDE.md tree is
  //                          stale and needs a refresh.
  //  (4) Zero-watch diagram — a diagram exists but extracted zero
  //                          path references from its content. It is
  //                          invisible to Layer 1 forever. We never
  //                          spawn *solely* for this (too noisy), but
  //                          if the hook is already spawning for any
  //                          other reason, we piggyback a request to
  //                          backfill explicit path mentions so the
  //                          next Stop can watch it normally.
  //
  // (1) + (2) + (4) together make the system self-healing: wrong
  // coverage gets repaired on the next spawn, and stale diagrams stop
  // being invisible. No hardcoded mapping table to maintain.

  const diagramDir = join(input.cwd, DIAGRAM_DIR);
  const diagramsExist = existsSync(diagramDir);
  const diagramWatches = diagramsExist ? scanAllDiagrams(diagramDir) : new Map<string, Set<string>>();

  const relChangedFiles = changedFiles.map((f) => relativize(f, input.cwd));

  const { affected: affectedDiagrams, unmatched } = resolveAffectedDiagrams(
    relChangedFiles,
    diagramWatches,
  );

  // Layer 2 only fires for unmatched files inside a watched source tree.
  // Random root-level edits (e.g. package.json, README) never trigger gap-fill.
  const unmatchedInWatched = unmatched.filter((f) => isSourceTreeFile(f));

  // Zero-watch diagrams: exist but have no extractable path references.
  // These are invisible to Layer 1 until someone backfills them.
  const zeroWatchDiagrams = Array.from(diagramWatches.entries())
    .filter(([, paths]) => paths.size === 0)
    .map(([name]) => name)
    .sort();

  const structural = detectStructuralChanges(input.cwd);
  const updateArchTree = structural.hasChange;

  const hasWork =
    affectedDiagrams.length > 0 ||
    unmatchedInWatched.length > 0 ||
    updateArchTree;

  if (!hasWork) {
    console.error("All checks passed.");
    return;
  }

  const summaryParts: string[] = [];
  if (affectedDiagrams.length > 0) summaryParts.push(`update: ${affectedDiagrams.join(", ")}`);
  if (unmatchedInWatched.length > 0) summaryParts.push(`gap-fill: ${unmatchedInWatched.length} unmatched file(s)`);
  if (updateArchTree) summaryParts.push("CLAUDE.md architecture tree");
  if (zeroWatchDiagrams.length > 0) summaryParts.push(`zero-watch backfill: ${zeroWatchDiagrams.join(", ")}`);
  const summary = summaryParts.join("; ");

  if (isDiagramUpdateDebounced()) {
    console.error(
      `Updates needed: ${summary}. Skipped — another update ran within ${DEBOUNCE_SECONDS}s.`,
    );
    return;
  }

  console.error(`Updates needed: ${summary}. Spawning updater...`);

  touchLockFile();

  const allDiagramNames = Array.from(diagramWatches.keys()).sort();
  const prompt = buildUpdaterPrompt({
    changedFiles: relChangedFiles,
    affectedDiagrams,
    unmatchedInWatched,
    updateArchTree,
    structural,
    allDiagramNames,
    zeroWatchDiagrams,
    diagramDir: DIAGRAM_DIR,
    diagramDirAbs: diagramDir,
  });

  const child = spawn("claude", ["-p", "--model", "sonnet", prompt], {
    cwd: input.cwd,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}

// ── Updater prompt builder ──────────────────────────────────────────

export interface UpdaterPromptArgs {
  changedFiles: string[];
  affectedDiagrams: string[];
  unmatchedInWatched: string[];
  updateArchTree: boolean;
  structural: StructuralChanges;
  allDiagramNames: string[];
  zeroWatchDiagrams: string[];
  diagramDir: string;
  diagramDirAbs: string;
}

/**
 * Build the sub-Claude prompt for the diagram/tree updater. Handles
 * any combination of Layer 1 (update affected diagrams), Layer 2
 * (gap-fill for unmatched in-tree files), zero-watch backfill, and
 * the CLAUDE.md architecture-tree refresh.
 *
 * Exported so it can be unit-tested and inspected without spawning
 * a process.
 */
export function buildUpdaterPrompt(args: UpdaterPromptArgs): string {
  const {
    changedFiles,
    affectedDiagrams,
    unmatchedInWatched,
    updateArchTree,
    structural,
    allDiagramNames,
    zeroWatchDiagrams,
    diagramDir,
    diagramDirAbs,
  } = args;

  const segments: string[] = [];

  segments.push(
    `The following source files were changed in the last session: ${changedFiles.join(", ")}.`,
  );

  if (affectedDiagrams.length > 0) {
    segments.push(
      `UPDATE these existing mermaid diagrams in ${diagramDir}/: ${affectedDiagrams.join(", ")}. ` +
        `Each of these diagrams references one or more of the changed files (directly or via a parent directory path) in its content. ` +
        `Read each diagram first, then read the changed source files, and edit only the parts that need updating to reflect the current code. ` +
        `Preserve existing file-path references inside the diagrams — they drive the watch system; do not delete them unless the referenced file was deleted.`,
    );
  }

  if (unmatchedInWatched.length > 0) {
    const catalog = listDiagramHeaders(diagramDirAbs);
    const diagramList =
      allDiagramNames.length > 0 ? allDiagramNames.join(", ") : "(none exist yet)";
    segments.push(
      `GAP-FILL: these changed files live in a watched source tree but are NOT referenced by any existing diagram: ${unmatchedInWatched.join(", ")}. ` +
        `Existing diagrams in ${diagramDir}/: ${diagramList}. ` +
        `Decide one of: ` +
        `(a) the most appropriate existing diagram should cover these files — open it, update it, and embed the file paths inside the diagram body (tables, mermaid node labels, or prose) so future Stop hooks will watch them. ` +
        `(b) a new diagram makes sense (e.g. a new integration, data pipeline, auth provider, or external service) — create it in ${diagramDir}/ with a descriptive filename and include the file paths. ` +
        `(c) these files are genuinely not worth documenting (ad-hoc scripts, scratch, one-off migrations) — do nothing for those files specifically. ` +
        `When you update or create a diagram, ALWAYS mention the relevant file paths explicitly using the form \`convex/foo/bar.ts\` or \`src/components/x/y.tsx\` — NOT bare filenames like \`bar.ts\`. Path mentions MUST start with one of: convex/, src/, tests/, .claude/hooks/. ` +
        `Here is the header of each existing diagram (first 20 lines) so you can pick the right one:\n\n${catalog}`,
    );
  }

  if (zeroWatchDiagrams.length > 0) {
    segments.push(
      `WHILE YOU'RE HERE: these diagrams exist but have ZERO extractable file-path references, which means the Stop hook's content-derived watch system will never auto-flag them for updates: ${zeroWatchDiagrams.join(", ")}. ` +
        `Read each one. If it describes real modules, rewrite references in the form \`convex/foo/bar.ts\` or \`src/routes/_app/page.tsx\` (NOT bare filenames) so they match the watch regex. Add path mentions inside tables, prose, mermaid participant labels, or node labels — anywhere in the body is fine. Every path mention must start with one of: convex/, src/, tests/, .claude/hooks/. ` +
        `If a diagram describes something genuinely obsolete, delete the diagram file.`,
    );
  }

  if (updateArchTree) {
    const { added, deleted, renamed } = structural;
    const deltas: string[] = [];
    if (added.length) deltas.push(`added: ${added.join(", ")}`);
    if (deleted.length) deltas.push(`deleted: ${deleted.join(", ")}`);
    if (renamed.length) deltas.push(`renamed: ${renamed.join(", ")}`);
    segments.push(
      `ALSO update the "## Architecture" file-tree code block in CLAUDE.md. ` +
        `Structural changes in watched directories (via git status --porcelain): ${deltas.join("; ")}. ` +
        `Read the current CLAUDE.md tree block, walk the actual file structure under convex/, src/routes/, src/components/, src/lib/, src/hooks/, .claude/hooks/, and update the tree to match reality. ` +
        `Keep the same indented-tree format and inline comments. Only edit the "## Architecture" code block — do not touch any other section of CLAUDE.md.`,
    );
  }

  segments.push(
    `Use mermaid syntax inside markdown code blocks. Include tables for quick reference. Prioritize completeness for AI consumption — include every edge case and conditional path.`,
  );
  segments.push(
    `Do NOT commit. Leave all updates as unstaged changes in the working tree.`,
  );

  return segments.join(" ");
}

/**
 * Read the first 20 lines of each diagram in the directory and return
 * a compact listing for the Layer 2 gap-fill prompt.
 */
function listDiagramHeaders(diagramDirAbs: string): string {
  let entries;
  try {
    entries = readdirSync(diagramDirAbs, { withFileTypes: true });
  } catch {
    return "(no diagrams found)";
  }

  const chunks: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    try {
      const text = readFileSync(join(diagramDirAbs, entry.name), "utf-8");
      const head = text.split("\n").slice(0, 20).join("\n");
      chunks.push(`── ${entry.name} ──\n${head}`);
    } catch {
      // Skip unreadable diagrams
    }
  }
  return chunks.join("\n\n");
}

// Only run main() when invoked directly (e.g. `bun run stop-hook.ts`),
// not when another file imports from this module for testing.
if (import.meta.main) {
  main().catch((e) => {
    console.error("Hook error:", e);
    process.exit(0); // Don't block on hook errors
  });
}
