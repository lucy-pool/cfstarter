#!/bin/bash
# Check required Convex environment variables before starting convex dev
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Only check when starting convex dev
if ! echo "$COMMAND" | grep -qE 'convex\s+dev'; then
  exit 0
fi

# Fetch env vars from Convex (timeout after 10s)
ENV_OUTPUT=$(timeout 10 bunx convex env ls 2>&1)
if [ $? -ne 0 ]; then
  echo "Warning: Could not fetch Convex env vars. Check your deployment connection." >&2
  echo "$ENV_OUTPUT" >&2
  # Don't block — might be first deploy
  exit 0
fi

MISSING_REQUIRED=()
SET_REQUIRED=()
MISSING_OPTIONAL=()
SET_OPTIONAL=()

# Required — app won't function without these
for VAR in BETTER_AUTH_SECRET SITE_URL; do
  if echo "$ENV_OUTPUT" | grep -q "^$VAR="; then
    SET_REQUIRED+=("$VAR")
  else
    MISSING_REQUIRED+=("$VAR")
  fi
done

# R2 storage — file features won't work
for VAR in R2_BUCKET R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if echo "$ENV_OUTPUT" | grep -q "^$VAR="; then
    SET_OPTIONAL+=("$VAR (R2 storage)")
  else
    MISSING_OPTIONAL+=("$VAR (R2 storage)")
  fi
done

# OAuth — social login won't work
for VAR in AUTH_GITHUB_ID AUTH_GITHUB_SECRET; do
  if echo "$ENV_OUTPUT" | grep -q "^$VAR="; then
    SET_OPTIONAL+=("$VAR (GitHub OAuth)")
  else
    MISSING_OPTIONAL+=("$VAR (GitHub OAuth)")
  fi
done

for VAR in AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET; do
  if echo "$ENV_OUTPUT" | grep -q "^$VAR="; then
    SET_OPTIONAL+=("$VAR (Google OAuth)")
  else
    MISSING_OPTIONAL+=("$VAR (Google OAuth)")
  fi
done

# AI — chat features won't work
if echo "$ENV_OUTPUT" | grep -q "^OPENROUTER_API_KEY="; then
  SET_OPTIONAL+=("OPENROUTER_API_KEY (AI chat)")
else
  MISSING_OPTIONAL+=("OPENROUTER_API_KEY (AI chat)")
fi

# Print status report
echo "" >&2
echo "=== Convex Environment Check ===" >&2
echo "" >&2

# Required vars status
echo "Required:" >&2
for VAR in "${SET_REQUIRED[@]}"; do
  echo "  [ok] $VAR" >&2
done
for VAR in "${MISSING_REQUIRED[@]}"; do
  echo "  [missing] $VAR" >&2
done

# Optional vars status
echo "" >&2
echo "Optional:" >&2
for VAR in "${SET_OPTIONAL[@]}"; do
  echo "  [ok] $VAR" >&2
done
for VAR in "${MISSING_OPTIONAL[@]}"; do
  echo "  [missing] $VAR" >&2
done
echo "" >&2

# Block if required vars are missing
if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
  echo "Blocked: Missing required environment variables. Set them via:" >&2
  echo "  bunx convex dashboard  (web UI)" >&2
  echo "  bunx convex env set VAR_NAME value  (CLI)" >&2
  exit 2
fi

# Summary
if [ ${#MISSING_OPTIONAL[@]} -gt 0 ]; then
  echo "Some optional features will be disabled. Set missing vars to enable them." >&2
else
  echo "All environment variables are configured." >&2
fi
echo "" >&2

exit 0
