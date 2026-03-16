#!/usr/bin/env bash
# Stop hook: reminds Claude to run verification if source files were modified
# but typecheck/test/lint haven't been run in this session.
#
# Checks for modified source files and reminds to verify before finishing.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)" || exit 0

# Check for modified source files (staged + unstaged)
CHANGED=$(git -C "$REPO_ROOT" diff --name-only HEAD 2>/dev/null; git -C "$REPO_ROOT" diff --name-only 2>/dev/null) || true

if echo "$CHANGED" | grep -qE '\.(ts|tsx|js|jsx)$'; then
    echo "Verification reminder: Source files (.ts/.tsx) were modified. Before finishing, run the verification loop: pnpm typecheck && pnpm test:run && pnpm lint. If any fail, fix the issues and re-run. Use /implement-and-verify for the full workflow."
fi
