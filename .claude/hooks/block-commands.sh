#!/bin/bash
# Consolidated command blocker — replaces 7 individual block-*.sh scripts.
# Checks Bash tool invocations for disallowed patterns and suggests proper tools.

# Extract the command from stdin JSON using jq
COMMAND=$(jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Extract the first segment of a pipeline/chain for "first command" checks.
# Splits on |, &&, ||, and ; to get the leading command.
FIRST_CMD=$(echo "$COMMAND" | sed -E 's/[|;&]{1,2}.*//' | xargs)

# --- First-command checks (only the leading segment matters) ---

# 1. File reading: cat, head, tail → Read tool
if echo "$FIRST_CMD" | grep -qE '^\s*(cat|head|tail)\s+'; then
  echo "Blocked: Use the Read tool instead of cat/head/tail to read files." >&2
  exit 2
fi

# 2. Content search: grep, rg → Grep tool
if echo "$FIRST_CMD" | grep -qE '^\s*(grep|rg)\s+'; then
  echo "Blocked: Use the Grep tool instead of grep/rg for searching file contents." >&2
  exit 2
fi

# 3. File search: find → Glob tool
if echo "$FIRST_CMD" | grep -qE '^\s*find\s+'; then
  echo "Blocked: Use the Glob tool instead of find for searching files." >&2
  exit 2
fi

# 4. File listing: ls → Glob tool
if echo "$FIRST_CMD" | grep -qE '^\s*ls\s+'; then
  echo "Blocked: Use the Glob tool instead of ls for listing files." >&2
  exit 2
fi

# --- Whole-command checks (patterns can appear anywhere in the command) ---

# 5. File editing: sed -i → Edit tool
if echo "$COMMAND" | grep -qE '\bsed\s+-i'; then
  echo "Blocked: Use the Edit tool instead of sed -i for editing files." >&2
  exit 2
fi

# 6. File editing: awk -i inplace → Edit tool
# Only block awk with in-place editing, not awk as a filter with output redirection
if echo "$COMMAND" | grep -qE '\bawk\s+-i\s*(inplace)?'; then
  echo "Blocked: Use the Edit tool instead of awk for in-place editing." >&2
  exit 2
fi

# 7. Package managers: npm → bun
if echo "$COMMAND" | grep -qE '\bnpm\s+'; then
  echo "Blocked: Use bun instead of npm. This project uses bun exclusively." >&2
  exit 2
fi

# 8. Package managers: yarn → bun
if echo "$COMMAND" | grep -qE '\byarn\s+'; then
  echo "Blocked: Use bun instead of yarn. This project uses bun exclusively." >&2
  exit 2
fi

# 9. Package managers: npx → bunx
if echo "$COMMAND" | grep -qE '\bnpx\s+'; then
  echo "Blocked: Use bunx instead of npx. This project uses bun exclusively." >&2
  exit 2
fi

# 10. Safety bypass: --no-verify
if echo "$COMMAND" | grep -qE '\-\-no-verify'; then
  echo "Blocked: Do not use --no-verify. Fix the underlying issue instead of bypassing safety checks." >&2
  exit 2
fi

# 11. Destructive: rm -rf
if echo "$COMMAND" | grep -qE '\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b'; then
  echo "Blocked: rm -rf is not allowed. Remove files individually or ask the user for confirmation." >&2
  exit 2
fi

# 12. Destructive: git reset --hard
if echo "$COMMAND" | grep -qE '\bgit\s+reset\s+--hard\b'; then
  echo "Blocked: git reset --hard is destructive. Use a safer alternative." >&2
  exit 2
fi

# 13. Destructive: git push --force / -f (but allow --force-with-lease)
# First strip out --force-with-lease so it doesn't false-positive on --force
PUSH_CHECK=$(echo "$COMMAND" | sed 's/--force-with-lease//g')
if echo "$PUSH_CHECK" | grep -qE '\bgit\s+push\s+.*--force\b|\bgit\s+push\b.*\s-f\b'; then
  echo "Blocked: git push --force is destructive. Use --force-with-lease if you must force push." >&2
  exit 2
fi

exit 0
