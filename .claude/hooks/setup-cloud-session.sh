#!/usr/bin/env bash
# SessionStart hook: configures Cloudflare and browser auth for cloud sessions.
#
# Prerequisites (one-time, in the Claude Code web environment settings):
#   1. Add all .dev.vars secrets as environment variables
#   2. Install agent-browser: npm install -g agent-browser && agent-browser install
#   3. Install GitHub CLI: apt install -y gh (or via setup script)
#
# This hook runs on every session start and:
#   - Loads Cloudflare dev vars into the session environment
#   - Configures GitHub CLI authentication
#   - Sets up agent-browser for headless GitHub OAuth

set -euo pipefail

# ─── Guard: only meaningful when CLAUDE_ENV_FILE is available ────────────────
[ -z "${CLAUDE_ENV_FILE:-}" ] && exit 0

# ─── 1. Cloudflare dev server environment (.dev.vars) ───────────────────────
# Wrangler reads secrets from .dev.vars. In cloud sessions this file does not
# exist on disk, so we generate it from the environment variables set in the
# Claude Code web UI (Settings → Environment → Environment variables).
#
# If .dev.vars already exists locally, we use it as-is (local dev).
# Otherwise we create it from the environment so `pnpm dev` works immediately.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEV_VARS_FILE="$REPO_ROOT/.dev.vars"

# Variables that wrangler needs in .dev.vars for the dev server
DEV_VARS_KEYS=(
    GITHUB_CLIENT_ID
    GITHUB_CLIENT_SECRET
    AUTH_SECRET
    COOKIE_ENCRYPTION_KEY
    OPENAI_API_KEY
    STRIPE_SECRET_KEY
    STRIPE_WEBHOOK_SECRET
    STRIPE_WEBHOOK_SECRET_SANDBOX
    STRIPE_PRICE_ID
    CLOUDFLARE_D1_ACCOUNT_ID
    CLOUDFLARE_DATABASE_ID
    CLOUDFLARE_D1_API_TOKEN
    CLOUDFLARE_ANALYTICS_API_TOKEN
    AUTH_URL
    SUBSCRIPTION_LIMITS_FREE
    SUBSCRIPTION_LIMITS_STANDARD
    SUBSCRIPTION_LIMITS_UNLIMITED
)

if [ ! -f "$DEV_VARS_FILE" ]; then
    # Generate .dev.vars from env vars (cloud session or fresh clone)
    {
        for key in "${DEV_VARS_KEYS[@]}"; do
            val="${!key:-}"
            [ -n "$val" ] && echo "${key}=${val}"
        done
    } > "$DEV_VARS_FILE"
fi

# Load .dev.vars into CLAUDE_ENV_FILE so all subsequent Bash commands have them
if [ -f "$DEV_VARS_FILE" ]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        echo "export ${key}=${value}" >> "$CLAUDE_ENV_FILE"
    done < "$DEV_VARS_FILE"
fi

# ─── 2. GitHub CLI authentication ───────────────────────────────────────────
# gh CLI is used for test cleanup (deleting repos, PRs created during E2E).
# If GH_TOKEN is set (from env vars in cloud UI), configure gh to use it.
if [ -n "${GH_TOKEN:-}" ]; then
    echo "export GH_TOKEN=${GH_TOKEN}" >> "$CLAUDE_ENV_FILE"
fi

# ─── 3. GitHub test account & org ─────────────────────────────────────────────
# For browser E2E testing with 2FA-enabled GitHub accounts.
if [ -n "${GH_TEST_MFA_SECRET:-}" ]; then
    echo "export GH_TEST_MFA_SECRET=${GH_TEST_MFA_SECRET}" >> "$CLAUDE_ENV_FILE"
fi
# The GitHub org used for destructive E2E testing (create/delete repos, etc.).
echo "export GH_TEST_ORG=${GH_TEST_ORG:-gh-admin-test}" >> "$CLAUDE_ENV_FILE"

# ─── 4. agent-browser proxy + encryption key ────────────────────────────────
# In cloud sessions, outbound traffic goes through an HTTPS_PROXY with TLS
# inspection. Playwright (used by agent-browser) must be told to:
#   (a) route through the proxy, and
#   (b) accept the proxy's CA certificate (IGNORE_HTTPS_ERRORS)
# These are read by browser-github-auth.sh but also exported here so any
# inline agent-browser calls in Claude's bash commands work too.
if [ -n "${HTTPS_PROXY:-}" ]; then
    echo "export AGENT_BROWSER_PROXY=${HTTPS_PROXY}" >> "$CLAUDE_ENV_FILE"
    echo "export AGENT_BROWSER_PROXY_BYPASS=localhost,127.0.0.1" >> "$CLAUDE_ENV_FILE"
    echo "export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=true" >> "$CLAUDE_ENV_FILE"
fi

# If AGENT_BROWSER_ENCRYPTION_KEY is set, persist it so the auth vault works.
if [ -n "${AGENT_BROWSER_ENCRYPTION_KEY:-}" ]; then
    echo "export AGENT_BROWSER_ENCRYPTION_KEY=${AGENT_BROWSER_ENCRYPTION_KEY}" >> "$CLAUDE_ENV_FILE"
fi

# ─── 5. Ensure dependencies and DB migrations are current ───────────────────
# Run for both local and cloud sessions so Claude Code always starts with a
# fully wired-up environment. Both operations are fast no-ops when up to date.

# Install deps if node_modules is missing (e.g. fresh clone, local or cloud)
if [ ! -d "$REPO_ROOT/node_modules" ]; then
    (cd "$REPO_ROOT" && pnpm install --frozen-lockfile) 2>&1 | tail -1
fi

# Ensure the Playwright chromium binary required by agent-browser is present.
# IMPORTANT: Do NOT use `agent-browser install` — it runs `npx playwright install`
# which may resolve a different playwright version than agent-browser's own
# playwright-core dependency, causing a chromium revision mismatch (e.g.,
# npx resolves playwright@1.56.1 → rev 1194, but agent-browser uses
# playwright-core@1.58.2 → expects rev 1208).
# Instead, use agent-browser's resolved playwright-core CLI directly.
# Run in the background so it doesn't block session start.
if [ -x "$REPO_ROOT/node_modules/.bin/agent-browser" ]; then
    (cd "$REPO_ROOT" && \
     PLAYWRIGHT_CORE="$(node -e "console.log(require.resolve('playwright-core/cli.js', {paths:[require.resolve('agent-browser')]}))")" && \
     node "$PLAYWRIGHT_CORE" install chromium-headless-shell >/tmp/agent-browser-install.log 2>&1) &
fi

# Symlink fallback: if the background install above lost the race (session start
# proceeded before the download finished) or the download was network-blocked,
# create a symlink from any already-installed chromium revision to the path
# agent-browser expects. Version numbers are read dynamically from playwright-core's
# own browsers.json so this stays correct when agent-browser updates its dep.
EXPECTED_SHELL=$(node -e "
  try {
    var path = require('path');
    // Derive browsers.json path from package.json (package.json is always exported;
    // browsers.json may not be in the exports map of newer playwright-core versions).
    var pkgJson = require.resolve('playwright-core/package.json', {paths:[require.resolve('agent-browser')]});
    var p = path.join(path.dirname(pkgJson), 'browsers.json');
    var b = JSON.parse(require('fs').readFileSync(p)).browsers.find(function(x){return x.name==='chromium-headless-shell'});
    if (b) console.log(process.env.HOME + '/.cache/ms-playwright/' + b.name.replace(/-/g,'_') + '-' + b.revision + '/chrome-headless-shell-linux64/chrome-headless-shell');
  } catch(e){}
" 2>/dev/null)
if [ -n "$EXPECTED_SHELL" ] && [ ! -x "$EXPECTED_SHELL" ]; then
    AVAILABLE=$(find /root/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/chrome" 2>/dev/null | head -1)
    if [ -n "$AVAILABLE" ]; then
        mkdir -p "$(dirname "$EXPECTED_SHELL")"
        ln -sf "$AVAILABLE" "$EXPECTED_SHELL"
    fi
fi

# Apply pending D1 migrations (idempotent — no-op when already applied)
(cd "$REPO_ROOT" && pnpm db:migrate:local) 2>&1 | tail -1

# ─── 6. Transparent proxy for workerd ────────────────────────────────────────
# workerd (Cloudflare's local runtime) does not honor HTTPS_PROXY. In cloud
# sessions, set up redsocks + iptables to transparently route workerd's HTTPS
# connections through the proxy. See setup-workerd-proxy.sh for details.
if [ -n "${HTTPS_PROXY:-}" ]; then
    bash "$REPO_ROOT/.claude/hooks/setup-workerd-proxy.sh" 2>&1 || true
fi

exit 0
