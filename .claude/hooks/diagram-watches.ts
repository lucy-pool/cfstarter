import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// ── Content-derived diagram watch extraction ─────────────────────────
//
// The Stop hook derives "which source files belong to which diagram"
// from what each diagram *actually mentions* in its content, not from
// a hardcoded mapping table. Adding a new diagram, renaming a module,
// or spinning up a new subfolder requires zero hook changes — as long
// as the diagram references the relevant file paths, the hook flags
// it for updates the next time those files change.
//
// A "watched path" is any file or directory reference found in a
// diagram's markdown body that begins with one of the known source
// roots (`convex/`, `src/`, `tests/`, `.claude/hooks/`). Matches are
// tolerant of surrounding markdown formatting: backticks, table
// cells, trailing punctuation, prose.
//
// MATCHING PHILOSOPHY: exact path match or directory-prefix match
// only. Bare filenames (`r2.ts`) are NOT matched — they are too
// ambiguous and create false positives. Diagrams MUST use full
// relative paths (`convex/storage/r2.ts`) to be part of the watch
// system. Diagrams that don't comply become "zero-watch" and are
// backfilled by the hook's piggyback mechanism (see stop-hook.ts).

// Roots that source files live under. Add new ones here if the
// project grows new top-level directories.
export const WATCHED_TREE_ROOTS: readonly string[] = [
  "convex/",
  "src/routes/",
  "src/components/",
  "src/lib/",
  "src/hooks/",
  "tests/",
  ".claude/hooks/",
];

// Derived from WATCHED_TREE_ROOTS: strip trailing slashes, collapse
// entries sharing a first segment (src/routes + src/lib → src),
// escape regex special chars, and deduplicate.
const PATH_ROOTS_REGEX_FRAGMENT = (() => {
  const roots = WATCHED_TREE_ROOTS.map((r) => r.replace(/\/+$/, ""));
  const byFirst = new Map<string, string[]>();
  for (const r of roots) {
    const first = r.split("/")[0];
    if (!byFirst.has(first)) byFirst.set(first, []);
    byFirst.get(first)!.push(r);
  }
  const collapsed: string[] = [];
  for (const [first, entries] of byFirst) {
    collapsed.push(entries.length > 1 ? first : entries[0]);
  }
  return collapsed
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
})();

// Matches path-like strings that start with one of the watched roots:
//
//   convex/market/contractActions.ts
//   convex/email/
//   src/routes/_app/dashboard.tsx
//   src/components/layout/sidebar.tsx
//   tests/convex/storage/files.test.ts
//   .claude/hooks/stop-hook.ts
//
// Rejected:
//   - URLs (`https://x.com/src/foo`)          via (?<![:/]) lookbehind
//   - Relative paths (`../convex/foo`)        via (?<!\.\./) lookbehind
//   - Embedded in a longer word (`fooconvex`) via (?<!\w) lookbehind
const PATH_REGEX = new RegExp(
  `(?<![:/\\w])(?<!\\.\\.\\/)(?:${PATH_ROOTS_REGEX_FRAGMENT})/[a-zA-Z0-9_\\-./]+`,
  "g",
);

// Ignored suffixes / fragments: auto-generated code that should never
// participate in the watch system even if referenced by a diagram.
const IGNORED_PATH_FRAGMENTS = ["_generated/", "routeTree.gen"];

/**
 * Strip trailing punctuation that markdown prose commonly places next
 * to a path (periods, commas, semicolons, colons, closing brackets,
 * backticks) and any trailing slashes. Normalizes directory and file
 * references to the same shape.
 */
function cleanPath(raw: string): string {
  return raw.replace(/[.,;:)\]>`'"]+$/, "").replace(/\/+$/, "");
}

/**
 * Extract every file / directory path referenced in a diagram's
 * content. Returns a Set of normalized paths (no trailing slashes,
 * no trailing punctuation, no ignored fragments).
 */
export function extractWatchedPaths(content: string): Set<string> {
  const paths = new Set<string>();
  // Reset lastIndex since the regex uses /g and may be reused.
  PATH_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATH_REGEX.exec(content)) !== null) {
    const cleaned = cleanPath(match[0]);
    if (cleaned.length === 0) continue;
    if (IGNORED_PATH_FRAGMENTS.some((frag) => cleaned.includes(frag))) continue;
    paths.add(cleaned);
  }
  return paths;
}

/**
 * Scan every `*.md` file in the diagrams directory and return a map
 * from diagram filename (e.g. "greybox.md") to its extracted watched
 * paths. Missing directory returns an empty map.
 */
export function scanAllDiagrams(
  diagramDir: string,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  let entries;
  try {
    entries = readdirSync(diagramDir, { withFileTypes: true });
  } catch {
    return map;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    let content: string;
    try {
      content = readFileSync(join(diagramDir, entry.name), "utf-8");
    } catch {
      continue;
    }
    map.set(entry.name, extractWatchedPaths(content));
  }
  return map;
}

/**
 * True iff `changedFile` equals `watched` exactly, or `watched` is a
 * directory prefix of `changedFile`. Both paths should be relative to
 * the project root and already normalized (no trailing slashes).
 */
export function matchesWatchedPath(
  changedFile: string,
  watched: string,
): boolean {
  if (changedFile === watched) return true;
  return changedFile.startsWith(watched + "/");
}

/**
 * True iff `relPath` lives inside one of the watched tree roots.
 * Used by the Layer 2 catch-all to decide whether an unmatched
 * changed file is worth flagging for documentation coverage.
 */
export function isSourceTreeFile(relPath: string): boolean {
  return WATCHED_TREE_ROOTS.some((root) => relPath.startsWith(root));
}

export interface ResolveResult {
  /** Diagram filenames (`auth-flow.md`, …) that reference at least
   *  one of the changed files (directly or via a parent directory). */
  affected: string[];
  /** Changed files that matched no diagram at all. The caller filters
   *  these to the ones inside watched tree roots to decide whether
   *  Layer 2 (gap-fill) should fire. */
  unmatched: string[];
}

/**
 * For a given list of changed files, return the set of diagrams that
 * reference at least one of them. Also returns the set of changed
 * files that were NOT matched by any diagram — the caller uses that
 * list (after filtering to in-tree files) to trigger Layer 2.
 */
export function resolveAffectedDiagrams(
  changedFiles: string[],
  diagramWatches: Map<string, Set<string>>,
): ResolveResult {
  const affected = new Set<string>();
  const matchedFiles = new Set<string>();

  for (const [diagram, watches] of diagramWatches) {
    for (const file of changedFiles) {
      for (const watch of watches) {
        if (matchesWatchedPath(file, watch)) {
          affected.add(diagram);
          matchedFiles.add(file);
          break;
        }
      }
    }
  }

  const unmatched = changedFiles.filter((f) => !matchedFiles.has(f));
  return {
    affected: Array.from(affected).sort(),
    unmatched,
  };
}

/**
 * Normalize an absolute file path to a project-root-relative path.
 * The Stop hook's transcript parser emits absolute paths, so this is
 * called on every changed file before matching.
 */
export function relativize(absPath: string, cwd: string): string {
  if (absPath.startsWith(cwd + "/")) return absPath.slice(cwd.length + 1);
  if (absPath === cwd) return "";
  return absPath;
}
