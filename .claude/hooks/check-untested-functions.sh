#!/bin/bash
# PreToolUse hook: warn about untested Convex functions before git commit.
# Only flags functions that are NEW or MODIFIED in staged files — not every
# untested function in the entire codebase (which is too noisy to be useful).
# Non-blocking — prints warnings but allows the commit.

INPUT=$(jq -r '.tool_input.command // empty')

# Only act on git commit commands
case "$INPUT" in
  "git commit"|"git commit "*) ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Get staged convex/ files (only .ts, excluding _generated and schema)
STAGED_CONVEX=$(cd "$PROJECT_ROOT" && git diff --cached --name-only -- 'convex/' 2>/dev/null \
  | grep -E '\.tsx?$' \
  | grep -v '_generated/' \
  | grep -v '\.d\.ts$')

[ -z "$STAGED_CONVEX" ] && exit 0

# Extract function names from staged DIFFS (added/modified lines only).
# This catches only new or changed exports, not every function in the file.
FUNCTIONS=$(cd "$PROJECT_ROOT" && git diff --cached -U0 -- $STAGED_CONVEX 2>/dev/null \
  | grep -E '^\+.*export\s+const\s+\w+\s*=\s*(userQuery|userMutation|adminQuery|adminMutation|query|mutation|action|internalQuery|internalMutation|internalAction)\(' \
  | sed -E 's/^\+.*export[[:space:]]+const[[:space:]]+([[:alnum:]_]+)[[:space:]]*=.*/\1/' \
  | sort -u)

[ -z "$FUNCTIONS" ] && exit 0

# Check each function against test files
TEST_DIR="$PROJECT_ROOT/tests"
WARNINGS=""

if [ -d "$TEST_DIR" ]; then
  TEST_CONTENT=$(find "$TEST_DIR" -name '*.test.ts' -exec cat {} + 2>/dev/null)
  while IFS= read -r fn; do
    if ! echo "$TEST_CONTENT" | grep -q "\b$fn\b"; then
      WARNINGS="$WARNINGS\n  - $fn"
    fi
  done <<< "$FUNCTIONS"
fi

if [ -n "$WARNINGS" ]; then
  echo "" >&2
  echo "⚠ New/modified Convex functions without tests:$WARNINGS" >&2
  echo "  Consider adding tests in tests/convex/<service>/" >&2
  echo "" >&2
fi

exit 0
