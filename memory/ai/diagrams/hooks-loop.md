# Hook System — Change Loop & Documentation Alignment

How code changes flow through validation, linting, and automatic documentation updates.

## Overview

Three hook phases enforce correctness and keep docs in sync:

| Phase | Event | When | Purpose |
|-------|-------|------|---------|
| **Guard** | PreToolUse | Before every tool call | Block bad patterns, validate env, check staleness |
| **Lint** | PostToolUse | After every Write/Edit | Catch Convex query anti-patterns per-chain |
| **Sync** | Stop | Session end | Run checks, resolve affected diagrams, spawn updater |

## The Change Loop

```mermaid
flowchart TD
    subgraph EDIT["1. Code Change"]
        A([Developer edits code]) --> B{Tool type?}
        B -->|Edit/Write| C[PreToolUse: Edit/Write]
        B -->|Bash| D[PreToolUse: Bash]
    end

    subgraph GUARD["2. Pre-Execution Guards"]
        C --> C1{Auto-generated<br/>file?}
        C1 -->|Yes| BLOCK1[BLOCKED<br/>routeTree.gen<br/>convex/_generated]
        C1 -->|No| ALLOW1[Allowed]

        D --> D1[block-commands.sh]
        D1 --> D1a{Pattern<br/>match?}
        D1a -->|cat/grep/find/ls| BLOCK2[BLOCKED<br/>Use Read/Grep/Glob]
        D1a -->|npm/yarn/npx| BLOCK3[BLOCKED<br/>Use bun/bunx]
        D1a -->|rm -rf/reset --hard<br/>push --force| BLOCK4[BLOCKED<br/>Destructive]
        D1a -->|--no-verify| BLOCK5[BLOCKED<br/>Fix the issue]
        D1a -->|Clean| D2{git commit?}

        D2 -->|No| D2a{convex dev?}
        D2a -->|Yes| ENV[check-convex-env.sh<br/>Validate BETTER_AUTH_SECRET<br/>SITE_URL + optional vars]
        D2a -->|No| EXEC

        D2 -->|Yes| COMMIT_CHECKS
    end

    subgraph COMMIT["3. Pre-Commit Checks (git commit only)"]
        COMMIT_CHECKS[4 pre-commit hooks run in order]

        COMMIT_CHECKS --> CC1[check-untested-functions.sh]
        CC1 -->|Warn| CC1out["New/modified exports<br/>without tests"]

        COMMIT_CHECKS --> CC2[check-temporal-coupling.sh]
        CC2 -->|Warn| CC2out["Cross-module files<br/>changing together >60%"]

        COMMIT_CHECKS --> CC3[check-diagrams.ts]
        CC3 --> CC3a{Stale diagrams<br/>or CLAUDE.md?}
        CC3a -->|Yes| FIX["Spawn sync fixer<br/>claude -p --model sonnet<br/>(blocks up to 5 min)"]
        FIX --> STAGE["git add updated<br/>diagrams + CLAUDE.md"]
        CC3a -->|No| CC4

        COMMIT_CHECKS --> CC4[check-docs-sync.sh]
        CC4 -->|Warn| CC4out["Lock file fresh?<br/>Unstaged diagram changes?"]
    end

    ALLOW1 --> EXEC
    STAGE --> EXEC
    CC4 --> EXEC

    subgraph POST["4. Post-Execution Lint"]
        EXEC([Tool executes]) --> POST1{Wrote to<br/>convex/*.ts?}
        POST1 -->|Yes| LINT[convex-query-lint.ts]
        POST1 -->|No| DONE1([Continue])

        LINT --> L1{Per-chain<br/>analysis}
        L1 --> L1a[".filter() without<br/>.withIndex()"]
        L1 --> L1b[".collect() without<br/>bounds"]
        L1 --> L1c[".filter(q.eq())<br/>after .withIndex()"]
        L1a & L1b & L1c -->|Feedback| DONE1
    end

    subgraph STOP["5. Session End — Stop Hook"]
        DONE2([Session ends]) --> S1[Parse transcript<br/>for changed files]
        S1 --> S2{Any convex/<br/>changes?}
        S2 -->|Yes| S3["Run tests<br/>bun run test"]
        S2 -->|No| S4

        S3 -->|Fail| S3block[BLOCKED<br/>Fix tests]
        S3 -->|Pass| S4["TypeScript typecheck<br/>bun run typecheck"]
        S4 -->|Fail| S4block[BLOCKED<br/>Fix types]
        S4 -->|Pass| S5["Convex typecheck<br/>bunx convex typecheck"]
        S5 -->|Fail| S5block[BLOCKED<br/>Fix schema]
        S5 -->|Pass| S6["Lint: unused _generated imports<br/>+ client-only packages in convex/"]
        S6 -->|Fail| S6block[BLOCKED<br/>Fix imports]
        S6 -->|Pass| S7[Resolve diagram impact]
    end

    subgraph RESOLVE["6. Diagram Resolution (content-derived)"]
        S7 --> R1["scanAllDiagrams()<br/>Extract paths from each .md"]
        R1 --> R2["resolveAffectedDiagrams()<br/>Match changed files to watches"]
        R2 --> R3{Any work<br/>needed?}

        R3 -->|Layer 1| R4["Affected diagrams<br/>(file referenced in diagram)"]
        R3 -->|Layer 2| R5["Gap-fill<br/>(file in watched tree,<br/>no diagram covers it)"]
        R3 -->|Layer 3| R6["CLAUDE.md tree<br/>(structural: adds/deletes/renames)"]
        R3 -->|Layer 4| R7["Zero-watch backfill<br/>(diagrams with 0 path refs)"]
        R3 -->|None| R8([All checks passed])

        R4 & R5 & R6 & R7 --> R9{Debounced?<br/>Lock file < 30s<br/>AND PID alive?}
        R9 -->|Yes| R8
        R9 -->|No| R10["Touch .diagram-update.lock<br/>with PID"]
        R10 --> R11["Spawn detached sub-Claude<br/>claude -p --model sonnet"]
    end

    subgraph UPDATE["7. Background Doc Update"]
        R11 --> U1["Sub-Claude reads<br/>affected diagrams + source"]
        U1 --> U2["Updates mermaid diagrams<br/>in memory/ai/diagrams/"]
        U2 --> U3["Updates CLAUDE.md<br/>architecture tree"]
        U3 --> U4["Leaves changes unstaged<br/>(picked up by next commit)"]
    end

    style BLOCK1 fill:#ff6b6b,color:#fff
    style BLOCK2 fill:#ff6b6b,color:#fff
    style BLOCK3 fill:#ff6b6b,color:#fff
    style BLOCK4 fill:#ff6b6b,color:#fff
    style BLOCK5 fill:#ff6b6b,color:#fff
    style S3block fill:#ff6b6b,color:#fff
    style S4block fill:#ff6b6b,color:#fff
    style S5block fill:#ff6b6b,color:#fff
    style S6block fill:#ff6b6b,color:#fff
    style FIX fill:#ffd93d,color:#000
    style R11 fill:#ffd93d,color:#000
    style U4 fill:#51cf66,color:#000
    style R8 fill:#51cf66,color:#000
    style STAGE fill:#51cf66,color:#000
```

## Content-Derived Watch System

How `diagram-watches.ts` resolves which diagrams are affected by a code change — no hardcoded mappings.

```mermaid
flowchart LR
    subgraph DIAGRAMS["memory/ai/diagrams/"]
        D1["schema.md<br/><small>mentions: convex/schema.ts</small>"]
        D2["functions.md<br/><small>mentions: convex/email/send.ts<br/>convex/storage/files.ts<br/>convex/ai/chat.ts ...</small>"]
        D3["auth-flow.md<br/><small>mentions: convex/auth.ts<br/>src/lib/auth-client.ts ...</small>"]
        D4["data-flow.md<br/><small>mentions: src/routes/_app/<br/>convex/storage/r2.ts ...</small>"]
        D5["greybox.md<br/><small>mentions: convex/functions.ts<br/>convex/authHelpers.ts ...</small>"]
    end

    subgraph ENGINE["diagram-watches.ts"]
        E1["extractWatchedPaths()<br/><small>Regex scans diagram body<br/>for paths starting with:<br/>convex/ | src/ | tests/ | .claude/hooks/</small>"]
        E2["scanAllDiagrams()<br/><small>Map&lt;filename, Set&lt;paths&gt;&gt;</small>"]
        E3["resolveAffectedDiagrams()<br/><small>Match changed files<br/>against all watches</small>"]
    end

    subgraph RESULT["Output"]
        R1["affected: diagrams to update"]
        R2["unmatched: files no diagram covers"]
    end

    D1 & D2 & D3 & D4 & D5 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> R1
    E3 --> R2
```

## Watched Tree Roots

Paths under these roots participate in the watch system. Adding a root to the array auto-updates the regex — no manual sync.

| Root | What lives there |
|------|-----------------|
| `convex/` | Backend functions, schema, auth |
| `src/routes/` | Frontend pages (file-based routing) |
| `src/components/` | UI components, layout |
| `src/lib/` | Shared utilities (auth-client, utils) |
| `src/hooks/` | React hooks |
| `tests/` | Backend test files |
| `.claude/hooks/` | This hook system itself |

## Lock File Protocol

Prevents concurrent diagram updaters and warns about race windows.

```mermaid
sequenceDiagram
    participant S as stop-hook.ts
    participant L as .diagram-update.lock
    participant C as check-docs-sync.sh
    participant D as check-diagrams.ts
    participant U as Sub-Claude Updater

    S->>S: Session ends, changes detected
    S->>L: Check: exists AND age < 30s AND PID alive?
    alt Debounced
        S-->>S: Skip (updater already running)
    else Not debounced
        S->>L: Write PID
        S->>U: spawn detached
        U->>U: Update diagrams + CLAUDE.md
        U->>U: Leave changes unstaged
    end

    Note over C,D: Later, user runs git commit

    C->>L: Check mtime (< 180s = may be running)
    C-->>C: Warn: "updater spawned Ns ago"

    D->>D: scanAllDiagrams() + resolveAffected()
    D->>D: Check: unstaged/missing/outdated?
    alt Stale found
        D->>U: spawn sync fixer (blocks commit)
        U->>U: Fix diagrams
        D->>D: git add updated files
    end
    D-->>D: Proceed with commit
```

## File Inventory

| File | Type | Event | Blocking | Imports |
|------|------|-------|----------|---------|
| `block-commands.sh` | bash | PreToolUse/Bash | Yes (exit 2) | — |
| `check-convex-env.sh` | bash | PreToolUse/Bash | Yes if required vars missing | — |
| `check-untested-functions.sh` | bash | PreToolUse/Bash | No (warn) | — |
| `check-temporal-coupling.sh` | bash | PreToolUse/Bash | No (warn) | — |
| `check-diagrams.ts` | TypeScript | PreToolUse/Bash | Sync fix + stage | `diagram-watches.ts` |
| `check-docs-sync.sh` | bash | PreToolUse/Bash | No (warn) | reads `.diagram-update.lock` |
| `convex-query-lint.ts` | TypeScript | PostToolUse/Write\|Edit | No (feedback) | — |
| `stop-hook.ts` | TypeScript | Stop | Yes if checks fail | `diagram-watches.ts` |
| `diagram-watches.ts` | TypeScript | (library) | — | — |
| `.claude/rules/convex-queries.md` | Markdown | Session start | — | — |
