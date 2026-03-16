#!/usr/bin/env bash
# PostToolUse hook: reminds Claude to keep CLAUDE.md and docs/ in sync after
# source file edits.  Receives the tool invocation as JSON on stdin.
#
# Outputs a plain-text reminder to stdout (which Claude Code feeds back as
# context) when the edited file lives under server/, client/, or shared/ and
# is not itself a documentation file.

set -euo pipefail

FILE_PATH=$(python3 - <<'EOF'
import sys, json
try:
    data = json.load(sys.stdin)
    # tool_input is nested under "tool_input" key in PostToolUse payloads
    inp = data.get("tool_input", data)
    print(inp.get("file_path", ""))
except Exception:
    pass
EOF
)

# Nothing to check if we couldn't parse a path.
[[ -z "$FILE_PATH" ]] && exit 0

# Skip documentation files themselves to avoid an infinite reminder loop.
if [[ "$FILE_PATH" == */docs/* ]] || \
   [[ "$FILE_PATH" == *CLAUDE.md ]] || \
   [[ "$FILE_PATH" == */.claude/* ]]; then
    exit 0
fi

# Only trigger for source files that are likely to affect documented behavior.
if [[ "$FILE_PATH" == */server/* ]] || \
   [[ "$FILE_PATH" == */client/* ]] || \
   [[ "$FILE_PATH" == */shared/* ]]; then
    echo "Docs reminder: '$(basename "$FILE_PATH")' was modified. If this change affects architecture, APIs, data flows, or any behavior described in CLAUDE.md or docs/, update those files now before committing. See the Documentation Maintenance section in CLAUDE.md for the update matrix."
fi
