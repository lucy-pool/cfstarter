#!/bin/bash
# PreToolUse hook: warn about in-flight or pending doc updates before
# `git commit`. Non-blocking — reminds the user but allows the commit.
#
# Fires when `git commit ...` is about to run AND any of:
#   (a) the Stop hook's sub-Claude updater was spawned recently
#       (lock file `.claude/hooks/.diagram-update.lock` is fresh)
#   (b) memory/ai/diagrams/ has unstaged changes
#   (c) CLAUDE.md has unstaged changes
#
# Rationale: the Stop hook spawns the diagram updater detached, so
# there's a 30-120 second race window where you can commit before
# the sub-Claude's unstaged edits land. This hook reminds you at the
# exact moment it matters — when you're about to commit.
#
# NOTE: We deliberately do NOT use `pgrep -f 'claude -p'` to detect
# a running updater. That pattern matches sub-Claudes from OTHER
# projects on the same machine, producing cross-project false positives.
# The lock file is project-local, so its mtime is an unambiguous signal.

COMMAND=$(jq -r '.tool_input.command // empty')

# Only act on `git commit ...`, not git commit-tree or similar.
case "$COMMAND" in
  "git commit"|"git commit "*) ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCK_FILE="$PROJECT_ROOT/.claude/hooks/.diagram-update.lock"
LOCK_MAX_AGE=180  # seconds — sub-Claude typically takes 30-120s

WARNINGS=""

# ── Check 1: was the sub-Claude updater spawned recently? ────────────
#
# The lock file is written at spawn time by the Stop hook's
# touchLockFile(). Its mtime == spawn time of the most recent updater.
# If younger than LOCK_MAX_AGE, the updater may still be running.
if [ -f "$LOCK_FILE" ]; then
  # macOS stat uses -f %m; GNU stat uses -c %Y. Try both.
  LOCK_MTIME=$(stat -f %m "$LOCK_FILE" 2>/dev/null || stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)
  if [ "$LOCK_MTIME" -gt 0 ]; then
    NOW=$(date +%s)
    AGE=$((NOW - LOCK_MTIME))
    if [ "$AGE" -lt "$LOCK_MAX_AGE" ]; then
      WARNINGS="$WARNINGS\n  • Diagram updater was spawned ${AGE}s ago and may still be running."
    fi
  fi
fi

# ── Check 2: unstaged changes in memory/ai/diagrams/ ─────────────────
DIAGRAM_CHANGES=$(cd "$PROJECT_ROOT" && git diff --name-only -- 'memory/ai/diagrams/' 2>/dev/null)
if [ -n "$DIAGRAM_CHANGES" ]; then
  FORMATTED_DIAGRAMS=$(echo "$DIAGRAM_CHANGES" | sed 's/^/      /')
  WARNINGS="$WARNINGS\n  • Unstaged diagram changes that won't be in this commit:\n$FORMATTED_DIAGRAMS"
fi

# ── Check 3: unstaged changes in CLAUDE.md ───────────────────────────
CLAUDE_CHANGES=$(cd "$PROJECT_ROOT" && git diff --name-only -- 'CLAUDE.md' 2>/dev/null)
if [ -n "$CLAUDE_CHANGES" ]; then
  WARNINGS="$WARNINGS\n  • Unstaged CLAUDE.md changes that won't be in this commit."
fi

# ── Emit warning (non-blocking) ──────────────────────────────────────
if [ -n "$WARNINGS" ]; then
  echo "" >&2
  echo "⚠ Documentation sync warning (commit is NOT blocked):" >&2
  printf "%b\n" "$WARNINGS" >&2
  echo "" >&2
  echo "  Options:" >&2
  echo "    • Wait ~30s for the updater to finish, then re-run the commit" >&2
  echo "    • 'git add memory/ai/diagrams/ CLAUDE.md' to include the pending changes" >&2
  echo "    • Ignore — the docs will catch up on the next Stop" >&2
  echo "" >&2
fi

exit 0
