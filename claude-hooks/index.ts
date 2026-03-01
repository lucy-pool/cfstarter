import { spawn } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

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
        entry.name.endsWith(".ts") &&
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
  "next",
  "@convex-dev/auth/react",
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

// ── Next.js MCP error check ─────────────────────────────────────────

async function parseMcpResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          return JSON.parse(line.slice(6));
        } catch {
          /* skip */
        }
      }
    }
    return null;
  }
  return res.json();
}

async function checkNextJsMcpErrors(): Promise<string | null> {
  const MCP_URL = "http://localhost:3000/_next/mcp";
  const jsonHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  try {
    // 1. Initialize MCP session
    const initRes = await fetch(MCP_URL, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "claude-stop-hook", version: "1.0.0" },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!initRes.ok) return null;

    const sessionId = initRes.headers.get("mcp-session-id");
    await parseMcpResponse(initRes);

    const sessionHeaders: Record<string, string> = { ...jsonHeaders };
    if (sessionId) sessionHeaders["mcp-session-id"] = sessionId;

    // 2. Send initialized notification
    await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(sessionId ? { "mcp-session-id": sessionId } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(3000),
    });

    // 3. Call get_errors tool
    const errRes = await fetch(MCP_URL, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_errors", arguments: {} },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!errRes.ok) return null;

    const data = (await parseMcpResponse(errRes)) as {
      result?: { content?: { type: string; text: string }[] };
    } | null;
    const content = data?.result?.content;
    if (!Array.isArray(content)) return null;

    const text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    if (text.includes("No errors detected")) return null;
    if (text.includes("Found errors")) return text;
    return null;
  } catch {
    // Server not running or MCP unavailable — skip gracefully
    return null;
  }
}

// ── Diagram maintenance ─────────────────────────────────────────────

const DIAGRAM_DIR = "memory/ai/diagrams";

interface DiagramMapping {
  diagram: string;
  patterns: RegExp[];
}

// Map source file patterns to the diagrams they affect.
// When you add new diagrams, add a mapping here so they stay up to date.
const DIAGRAM_MAPPINGS: DiagramMapping[] = [
  {
    diagram: "schema.md",
    patterns: [/convex\/schema\.ts$/],
  },
  {
    diagram: "functions.md",
    patterns: [/convex\/(?!schema\.)[^/]+\.ts$/],
  },
  {
    diagram: "auth-flow.md",
    patterns: [
      /convex\/auth\.ts$/,
      /convex\/auth\.config\.ts$/,
      /convex\/users\.ts$/,
      /src\/middleware\.ts$/,
      /src\/components\/providers\.tsx$/,
      /src\/app\/sign-in\//,
      /src\/app\/sign-up\//,
    ],
  },
  {
    diagram: "data-flow.md",
    patterns: [
      /convex\/[^/]+\.ts$/,
      /src\/app\/.*\/page\.tsx$/,
      /src\/components\/[^/]+\.tsx$/,
    ],
  },
];

function getAffectedDiagrams(changedFiles: string[], cwd: string): string[] {
  const affected = new Set<string>();
  for (const file of changedFiles) {
    const rel = file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;
    for (const mapping of DIAGRAM_MAPPINGS) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(rel)) {
          affected.add(mapping.diagram);
          break;
        }
      }
    }
  }
  return Array.from(affected);
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

  // --- Check 5: Next.js MCP runtime errors ---
  console.error("Checking Next.js MCP for runtime errors...");
  const mcpErrors = await checkNextJsMcpErrors();
  if (mcpErrors) {
    block(`Next.js runtime errors detected via MCP:\n${mcpErrors}`);
    return;
  }

  // --- All checks passed — update diagrams if needed ---
  const affectedDiagrams = getAffectedDiagrams(changedFiles, input.cwd);
  const diagramDir = join(input.cwd, DIAGRAM_DIR);
  const diagramsExist = existsSync(diagramDir);

  if (affectedDiagrams.length > 0 && diagramsExist) {
    const existingDiagrams = affectedDiagrams.filter((d) =>
      existsSync(join(diagramDir, d))
    );
    const missingDiagrams = affectedDiagrams.filter(
      (d) => !existsSync(join(diagramDir, d))
    );

    console.error(
      `Diagrams needing update: ${affectedDiagrams.join(", ")}. Spawning diagram updater...`
    );

    const diagramPrompt = [
      `The following source files were changed: ${changedFiles.join(", ")}.`,
      existingDiagrams.length > 0
        ? `UPDATE these existing mermaid diagrams in ${DIAGRAM_DIR}/: ${existingDiagrams.join(", ")}. Read each diagram file first, then read the changed source files, and edit only the parts that need updating to reflect the current code.`
        : "",
      missingDiagrams.length > 0
        ? `CREATE these missing diagrams in ${DIAGRAM_DIR}/: ${missingDiagrams.join(", ")}. Read the relevant source files and generate complete mermaid diagrams in markdown.`
        : "",
      `Also consider if the changes introduce something that should be in a NEW diagram not yet listed (e.g., a new integration, a new data pipeline, a new auth provider). If so, create it in ${DIAGRAM_DIR}/.`,
      `Use mermaid syntax inside markdown code blocks. Include tables for quick reference. Prioritize completeness for AI consumption — include every edge case and conditional path.`,
      `After updating diagrams, stage and commit everything with a concise message.`,
    ]
      .filter(Boolean)
      .join(" ");

    const child = spawn(
      "claude",
      ["-p", "--model", "sonnet", diagramPrompt],
      {
        cwd: input.cwd,
        stdio: "ignore",
        detached: true,
      }
    );
    child.unref();
  } else {
    console.error("All checks passed.");
  }
}

main().catch((e) => {
  console.error("Hook error:", e);
  process.exit(0); // Don't block on hook errors
});
