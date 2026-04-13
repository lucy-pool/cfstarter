#!/bin/bash
# PreToolUse hook: warn about temporal coupling across module boundaries before git commit.
# Non-blocking — prints warnings but allows the commit.

COMMAND=$(jq -r '.tool_input.command // empty')

# Only act on git commit commands
case "$COMMAND" in
  "git commit"|"git commit "*) ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT" || exit 0

# Analyze last 50 commits for file pairs that change together
# Only look at convex/ files to keep it focused
COUPLED_PAIRS=$(git log --name-only --pretty=format:"---COMMIT---" -50 2>/dev/null | awk '
  /^---COMMIT---$/ {
    if (n > 0) {
      for (i in files) for (j in files) if (i < j) pairs[i","j]++
      for (i in files) count[i]++
    }
    delete files; n=0; next
  }
  /^$/ { next }
  /^convex\// { files[$0]=1; n++ }
  END {
    for (i in files) for (j in files) if (i < j) pairs[i","j]++
    for (i in files) count[i]++
    for (p in pairs) {
      split(p, ab, ",")
      a = ab[1]; b = ab[2]
      # Get top-level module dir (e.g., convex/email, convex/storage)
      split(a, pa, "/"); split(b, pb, "/")
      mod_a = pa[1] "/" pa[2]; mod_b = pb[1] "/" pb[2]
      # Skip if same module or if either is a top-level convex file
      if (mod_a == mod_b) next
      if (pa[2] == "" || pb[2] == "") next
      # Skip test files
      if (a ~ /__tests__/ || b ~ /__tests__/) next
      # Check if they appear together in >60% of commits where either appears
      max_count = (count[a] > count[b]) ? count[a] : count[b]
      if (max_count >= 3 && pairs[p] / max_count > 0.6) {
        printf "  %s <-> %s (changed together in %d/%d commits)\n", a, b, pairs[p], max_count
      }
    }
  }
' 2>/dev/null)

if [ -n "$COUPLED_PAIRS" ]; then
  echo "" >&2
  echo "⚠ Greybox Warning: These files have high temporal coupling but live in different modules:" >&2
  echo "$COUPLED_PAIRS" >&2
  echo "  Consider: Should these share a Deep Module boundary?" >&2
  echo "" >&2
fi

exit 0
