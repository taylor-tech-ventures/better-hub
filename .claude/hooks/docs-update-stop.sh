#!/usr/bin/env bash
# Stop hook: reminds Claude to update CLAUDE.md and docs/ before finishing a
# session that involved source-file changes.
#
# Checks whether any files under server/, client/, or shared/ were modified
# in the current git working tree (staged or unstaged). If so, outputs a
# reminder to ensure documentation is in sync before the session ends.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)" || exit 0

CHANGED=$(git -C "$REPO_ROOT" diff --name-only HEAD 2>/dev/null; git -C "$REPO_ROOT" diff --name-only 2>/dev/null) || true

if echo "$CHANGED" | grep -qE '^(server|client|shared)/'; then
    echo "Stop reminder: source files under server/, client/, or shared/ have been modified. Before finishing, confirm that CLAUDE.md and any relevant docs/ files are up to date. See the Documentation Maintenance section in CLAUDE.md for the update matrix."
fi
