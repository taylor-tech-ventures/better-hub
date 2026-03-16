#!/usr/bin/env bash
# Helper: Authenticate with GitHub OAuth in the browser for E2E testing.
#
# This script automates the GitHub OAuth flow that gh-admin.com uses:
#   1. Navigate to localhost:8787
#   2. Click "Sign in with GitHub"
#   3. Fill GitHub credentials on github.com
#   4. Handle OAuth callback back to localhost
#   5. Save browser state for reuse
#
# Usage:
#   bash .claude/hooks/browser-github-auth.sh [session-name]
#
# Prerequisites:
#   - Dev server running on port 8787
#   - GitHub credentials in agent-browser auth vault OR GH_TEST_USERNAME/GH_TEST_PASSWORD env vars
#   - For 2FA accounts: GH_TEST_MFA_SECRET env var (TOTP base32 secret)
#   - agent-browser (project-local dep in node_modules/.bin/agent-browser)
#   - otpauth npm package installed (for TOTP generation)
#
# The script saves browser state to ~/.agent-browser/sessions/ via the named
# session, so subsequent runs reuse cookies without re-authenticating.

set -euo pipefail

SESSION="${1:-gh-admin-e2e}"
BASE_URL="http://localhost:8787"
STATE_FILE="/tmp/gh-admin-auth-state.json"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# agent-browser is a project-local dependency — not on PATH in cloud sessions.
AGENT_BROWSER="$REPO_ROOT/node_modules/.bin/agent-browser"

# ─── Proxy configuration for cloud environments ──────────────────────────────
# In Claude Code cloud sessions, outbound traffic routes through an HTTPS_PROXY
# that performs TLS inspection. Playwright must be configured to use this proxy
# and to accept the proxy's CA certificate (AGENT_BROWSER_IGNORE_HTTPS_ERRORS).
# Without these, Playwright cannot load github.com in the cloud environment.
if [ -n "${HTTPS_PROXY:-}" ]; then
    export AGENT_BROWSER_PROXY="${HTTPS_PROXY}"
    export AGENT_BROWSER_PROXY_BYPASS="localhost,127.0.0.1"
    export AGENT_BROWSER_IGNORE_HTTPS_ERRORS="true"
fi

echo "==> Checking for existing auth state..."

# Try loading saved state first
if [ -f "$STATE_FILE" ]; then
    "$AGENT_BROWSER" --session "$SESSION" state load "$STATE_FILE" 2>/dev/null || true
    "$AGENT_BROWSER" --session "$SESSION" open "$BASE_URL" 2>/dev/null
    "$AGENT_BROWSER" --session "$SESSION" wait --load networkidle 2>/dev/null

    # Check if we're already authenticated (dashboard means logged in)
    CURRENT_URL=$("$AGENT_BROWSER" --session "$SESSION" get url 2>/dev/null || echo "")
    if echo "$CURRENT_URL" | grep -q "dashboard"; then
        echo "==> Already authenticated (restored from saved state)"
        exit 0
    fi
    echo "==> Saved state expired, re-authenticating..."
fi

# Navigate to login page
echo "==> Opening login page..."
"$AGENT_BROWSER" --session "$SESSION" open "$BASE_URL"
"$AGENT_BROWSER" --session "$SESSION" wait --load networkidle

# Click the GitHub sign-in button
echo "==> Clicking Sign in with GitHub..."
"$AGENT_BROWSER" --session "$SESSION" find text "Sign in with GitHub" click 2>/dev/null \
    || "$AGENT_BROWSER" --session "$SESSION" find role button click 2>/dev/null

sleep 3
# Check if we landed on GitHub login or the OAuth authorization page
CURRENT_URL=$("$AGENT_BROWSER" --session "$SESSION" get url 2>/dev/null || echo "")

if echo "$CURRENT_URL" | grep -q "github.com/login"; then
    echo "==> On GitHub login page, entering credentials..."

    # Try auth vault first (recommended — credentials never exposed to LLM)
    if "$AGENT_BROWSER" auth show github >/dev/null 2>&1; then
        echo "==> Using auth vault credentials..."
        "$AGENT_BROWSER" --session "$SESSION" auth login github
    elif [ -n "${GH_TEST_USERNAME:-}" ] && [ -n "${GH_TEST_PASSWORD:-}" ]; then
        echo "==> Using environment variable credentials..."
        # Use CSS selectors directly — avoids aria snapshot timeout on external pages
        "$AGENT_BROWSER" --session "$SESSION" fill "#login_field" "$GH_TEST_USERNAME"
        "$AGENT_BROWSER" --session "$SESSION" fill "#password" "$GH_TEST_PASSWORD"
        "$AGENT_BROWSER" --session "$SESSION" click "[name=commit]"
        sleep 3
    else
        echo "ERROR: No GitHub credentials available." >&2
        echo "Set up auth vault:  echo 'password' | $AGENT_BROWSER auth save github --url https://github.com/login --username USER --password-stdin" >&2
        echo "Or set env vars:    GH_TEST_USERNAME and GH_TEST_PASSWORD" >&2
        exit 1
    fi

    "$AGENT_BROWSER" --session "$SESSION" wait --load networkidle
    sleep 2
fi

# ─── Handle 2FA (TOTP) if prompted ──────────────────────────────────────────
# GitHub may redirect to WebAuthn first (/sessions/two-factor/webauthn).
# Navigate explicitly to the TOTP form (/sessions/two-factor/app) to bypass it.
CURRENT_URL=$("$AGENT_BROWSER" --session "$SESSION" get url 2>/dev/null || echo "")
if echo "$CURRENT_URL" | grep -qE "github.com/sessions/two-factor|github.com/sessions/verified-device"; then
    echo "==> 2FA page detected, generating TOTP code..."

    if [ -z "${GH_TEST_MFA_SECRET:-}" ]; then
        echo "ERROR: GitHub 2FA is required but GH_TEST_MFA_SECRET is not set." >&2
        echo "Set the TOTP base32 secret as the GH_TEST_MFA_SECRET environment variable." >&2
        exit 1
    fi

    # If on WebAuthn page, navigate to TOTP page instead
    if echo "$CURRENT_URL" | grep -q "webauthn"; then
        echo "==> WebAuthn page detected, switching to TOTP form..."
        "$AGENT_BROWSER" --session "$SESSION" open "https://github.com/sessions/two-factor/app"
        "$AGENT_BROWSER" --session "$SESSION" wait --load networkidle
    fi

    TOTP_CODE=$(node "$REPO_ROOT/.claude/hooks/generate-totp.mjs")
    if [ -z "$TOTP_CODE" ]; then
        echo "ERROR: Failed to generate TOTP code." >&2
        exit 1
    fi

    echo "==> Entering 2FA code..."
    # Use the known CSS selector; fall back to other methods
    "$AGENT_BROWSER" --session "$SESSION" fill "#app_totp" "$TOTP_CODE" 2>/dev/null \
        || "$AGENT_BROWSER" --session "$SESSION" find placeholder "XXXXXX" fill "$TOTP_CODE" 2>/dev/null \
        || "$AGENT_BROWSER" --session "$SESSION" find role textbox fill "$TOTP_CODE" 2>/dev/null

    sleep 3
fi

# Handle OAuth authorization page ("Authorize <app>")
CURRENT_URL=$("$AGENT_BROWSER" --session "$SESSION" get url 2>/dev/null || echo "")
if echo "$CURRENT_URL" | grep -q "github.com/login/oauth"; then
    echo "==> Authorizing OAuth app..."
    "$AGENT_BROWSER" --session "$SESSION" find text "Authorize" click 2>/dev/null || true
    "$AGENT_BROWSER" --session "$SESSION" wait --load networkidle
fi

# Wait for redirect back to app
echo "==> Waiting for OAuth callback..."
"$AGENT_BROWSER" --session "$SESSION" wait --url "**/dashboard/**" 2>/dev/null \
    || "$AGENT_BROWSER" --session "$SESSION" wait 5000

# Verify we're authenticated
FINAL_URL=$("$AGENT_BROWSER" --session "$SESSION" get url 2>/dev/null || echo "")
if echo "$FINAL_URL" | grep -q "dashboard"; then
    echo "==> Authentication successful! Saving state..."
    "$AGENT_BROWSER" --session "$SESSION" state save "$STATE_FILE"
    echo "==> Done. Browser session '$SESSION' is authenticated."
else
    echo "WARNING: May not be fully authenticated. Current URL: $FINAL_URL" >&2
    echo "==> You may need to complete authentication manually." >&2
    exit 1
fi
