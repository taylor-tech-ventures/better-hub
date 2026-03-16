#!/usr/bin/env bash
# Analyzes git changes and outputs which CLAUDE.md sections and docs/ files
# need updating, based on the Documentation Maintenance matrix in CLAUDE.md.
#
# Usage: bash .claude/hooks/docs-maintenance-check.sh
# Returns: list of doc files that likely need updating, or nothing if no
#          documentation-affecting changes were detected.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)" || exit 0

# Collect all changed files (staged + unstaged + untracked-but-added)
CHANGED=$(
    git -C "$REPO_ROOT" diff --name-only HEAD 2>/dev/null
    git -C "$REPO_ROOT" diff --name-only 2>/dev/null
) || true

# Deduplicate
CHANGED=$(echo "$CHANGED" | sort -u | grep -v '^$' || true)

[[ -z "$CHANGED" ]] && exit 0

# Track which doc files need updating (deduplicated)
declare -A DOCS_NEEDED

check() {
    local pattern="$1"
    shift
    if echo "$CHANGED" | grep -qE "$pattern"; then
        for doc in "$@"; do
            DOCS_NEEDED["$doc"]=1
        done
    fi
}

# ── Map changed-file patterns to documentation targets ──────────────────────
# Each mapping corresponds to a row in the CLAUDE.md Documentation Maintenance table.

# Durable Object methods / token management
check '^server/durable-objects/' \
    "CLAUDE.md (Durable Objects section)" \
    "docs/architecture.md"

# oRPC procedures / middleware
check '^server/orpc/' \
    "CLAUDE.md (Server APIs section)" \
    "docs/client-orpc-dal-durable-object.md"

# Auth flow
check '^server/auth/' \
    "CLAUDE.md (Authentication Flow)" \
    "docs/architecture.md"

# Request routing
check '^server/index\.ts' \
    "docs/architecture.md (Request Routing)"

# DAL functions
check '^server/data-access-layer/' \
    "CLAUDE.md (Data Access Layer section)" \
    "docs/client-orpc-dal-durable-object.md"

# Error handling convention
check '^server/data-access-layer/github/types\.ts' \
    "CLAUDE.md (Data Access Layer section)" \
    "docs/error-handling.md"

# New top-level directories or key files
check '^(server|clients|packages)/.*/index\.ts$' \
    "CLAUDE.md (Key Directories)" \
    "docs/architecture.md"

# json-render catalog / registry / prompt
check '(json-render|catalog|registry)' \
    "CLAUDE.md (AI Chat & json-render)" \
    "docs/architecture.md (AI Chat Flow)"

# Chat interface / SSR rules
check '^clients/web/components/ui/chat/' \
    "CLAUDE.md (SSR Rules)" \
    "docs/architecture.md"

# System prompts
check '^packages/shared/prompts' \
    "CLAUDE.md (AI Chat & json-render)" \
    "docs/system-prompt.md"

# Logging / observability
check '(logger|observability|health)' \
    "CLAUDE.md (Logging section)" \
    "docs/observability.md"

# Prompt templates
check '(prompt.template|PromptTemplate)' \
    "CLAUDE.md (Key Directories, Durable Objects)" \
    "docs/custom-prompt-templates.md"

# CLI
check '^cli/' \
    "CLAUDE.md (Key Directories, Stack)" \
    "docs/cli.md"

# MCP server / OAuth / tool adapter
check '^clients/mcp/' \
    "CLAUDE.md (Durable Objects, AI Chat sections)" \
    "docs/architecture.md"

# Tool definitions / contracts / adapters
check '^server/agent/tools/' \
    "CLAUDE.md (AI Chat & json-render)" \
    "docs/ai-tools.md"

# Tool approval config
check 'tool-approval' \
    "CLAUDE.md (AI Chat & json-render)" \
    "docs/tool-confirmation.md"

# Billing / Stripe
check '(billing|stripe|subscription)' \
    "docs/billing.md"

# Usage tracking
check 'usage' \
    "docs/usage-tracking.md"

# Entity caching
check '(cache-manager|CacheManager|entity.cache|entity.sync)' \
    "docs/entity-caching.md" \
    "docs/entity-sync-paid-users.md"

# Hooks / Claude Code config
check '^\.claude/' \
    "CLAUDE.md (Cloud Session Setup)" \
    "docs/claude-code-best-practices.md"

# Wrangler / config changes
check '^wrangler\.jsonc' \
    "CLAUDE.md (Configuration Files)" \
    "docs/architecture.md"

# ── Output results ──────────────────────────────────────────────────────────
if [[ ${#DOCS_NEEDED[@]} -eq 0 ]]; then
    exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CLAUDE.md MAINTENANCE: The following docs likely need updating:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for doc in $(echo "${!DOCS_NEEDED[@]}" | tr ' ' '\n' | sort); do
    echo "  → $doc"
done
echo ""
echo "Changed source files that triggered this:"
echo "$CHANGED" | grep -vE '^(docs/|CLAUDE\.md|\.claude/)' | head -20 | sed 's/^/  /'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
