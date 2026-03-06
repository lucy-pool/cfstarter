#!/bin/bash
# PreToolUse hook: warn about untested Convex functions before git commit.
# Non-blocking — prints warnings but allows the commit.

# Read stdin (JSON with tool input)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# Only act on git commit commands
case "$COMMAND" in
  git\ commit*) ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONVEX_DIR="$PROJECT_ROOT/convex"

# Collect exported Convex function names from source files (excluding tests and _generated)
FUNCTIONS=$(find "$CONVEX_DIR" -name '*.ts' -not -path '*/__tests__/*' -not -path '*/_generated/*' -not -name '*.d.ts' \
  | xargs grep -ohE 'export\s+const\s+\w+\s*=\s*(userQuery|userMutation|adminQuery|adminMutation|query|mutation|action|internalQuery|internalMutation|internalAction)\(' 2>/dev/null \
  | sed -E 's/export[[:space:]]+const[[:space:]]+([[:alnum:]_]+)[[:space:]]*=.*/\1/')

[ -z "$FUNCTIONS" ] && exit 0

# Collect all test file content
TEST_CONTENT=$(find "$CONVEX_DIR" -path '*/__tests__/*.test.ts' -exec cat {} + 2>/dev/null)

# Check each function for test references
WARNINGS=""
while IFS= read -r fn; do
  if ! echo "$TEST_CONTENT" | grep -q "\b$fn\b"; then
    WARNINGS="$WARNINGS\n  - $fn"
  fi
done <<< "$FUNCTIONS"

if [ -n "$WARNINGS" ]; then
  echo "" >&2
  echo "⚠ Untested Convex functions:$WARNINGS" >&2
  echo "  Consider adding tests in convex/<service>/__tests__/" >&2
  echo "" >&2
fi

exit 0
