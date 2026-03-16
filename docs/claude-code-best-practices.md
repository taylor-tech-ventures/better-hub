# Getting the Most Out of Claude Code

A guide for the gh-admin.com team based on current best practices (March 2026). This covers what we're already doing well and what we should adopt next.

---

## 1. CLAUDE.md — Our Foundation (Already Strong)

Our `CLAUDE.md` is well-structured with architecture docs, code conventions, and common commands. Here's how to keep it effective:

**What we're doing right:**
- Path aliases, import conventions, and code style rules that Claude can't infer
- Specific build/test/deploy commands
- Architecture overview with key directories
- Documentation maintenance table with hook enforcement

**Improvements to consider:**

- **Prune regularly.** The official docs say: *"For each line, ask: Would removing this cause Claude to make mistakes? If not, cut it."* Our CLAUDE.md is comprehensive (~500 lines) — some sections could be moved to skills that load on demand.
- **Add compaction instructions.** Add a line like: `When compacting, always preserve the full list of modified files, test commands, and the current task context.` This ensures critical context survives auto-compaction.
- **Use `@imports` for stable docs.** Instead of duplicating content, reference files:
  ```markdown
  See @docs/architecture.md for full architecture details.
  See @docs/error-handling.md for GitHubResult<T> convention.
  ```
  This keeps the root CLAUDE.md lean while making detailed docs available when needed.
- **Use emphasis for critical rules.** Rules that Claude occasionally ignores should use "IMPORTANT" or "YOU MUST" prefixes — we already do this in some places, apply it consistently.

### CLAUDE.md vs Hooks vs Skills

| If it's a... | Use |
|---|---|
| Suggestion / guideline | CLAUDE.md |
| Hard requirement (must always happen) | Hook |
| Domain knowledge / reusable workflow | Skill |
| External service integration | MCP server |

---

## 2. Skills — Reusable Workflows

Skills (`.claude/skills/`) are the modern replacement for custom commands. They load on demand, keeping context lean.

**Recommended skills to create for our project:**

```markdown
# .claude/skills/fix-issue/SKILL.md
---
name: fix-issue
description: Fix a GitHub issue end-to-end
disable-model-invocation: true
---
Fix the GitHub issue: $ARGUMENTS

1. Use `gh issue view` to get issue details
2. Search the codebase for relevant files
3. Implement changes following our conventions in CLAUDE.md
4. Write tests in `__tests__/` mirroring source structure
5. Run `pnpm typecheck` and `pnpm test:run`
6. Run `pnpm lint` and fix any issues
7. Commit with a descriptive message and push
8. Create a PR with `gh pr create`
```

```markdown
# .claude/skills/add-dal-function/SKILL.md
---
name: add-dal-function
description: Scaffold a new DAL function with tests
---
Create a new DAL function following our conventions:

1. Add function in `server/data-access-layer/`
2. Return `GitHubResult<T>` using `ok()`/`fail()`/`mapStatusToErrorCode()`
3. Create unit tests in `__tests__/server/data-access-layer/` using nock
4. Cover success, error, and auth guard paths
5. Run `pnpm typecheck` and `pnpm test:run`
```

```markdown
# .claude/skills/add-tool/SKILL.md
---
name: add-tool
description: Add a new AI tool to the agent
---
Add a new AI tool following our tool architecture:

1. Add oRPC contract in `server/agent/tools/contracts.ts`
2. Add definition in `server/agent/tools/definitions.ts`
3. Register in `server/agent/tools/index.ts` (AI SDK) and `mcp-adapter.ts` (MCP)
4. If destructive, add to `TOOLS_REQUIRING_APPROVAL` in `packages/shared/config/tool-approval.ts`
5. Add tests and verify with `pnpm typecheck && pnpm test:run`
6. Update docs per the documentation maintenance table
```

**Key skill settings:**
- `disable-model-invocation: true` — for workflows with side effects (deploy, commit, PR creation). Only you can trigger these via `/skill-name`.
- `user-invocable: false` — for background knowledge that Claude should auto-apply when relevant but isn't a command.

---

## 3. Hooks — Deterministic Enforcement

We already have a docs-update-reminder hook. Here are additional hooks to consider:

### Auto-format after edits
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "pnpm lint:fix --changed"
      }
    ]
  }
}
```

### Block direct DB/API access outside DAL
```bash
#!/bin/bash
# .claude/hooks/enforce-dal.sh
# PreToolUse hook — exit 2 to block the action
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.file_path // empty')

if [[ "$FILE" == server/* && "$FILE" != server/data-access-layer/* ]]; then
  if echo "$INPUT" | jq -r '.new_content // empty' | grep -qE 'octokit|\.execute\(|\.select\(' ; then
    echo "Direct DB/API access detected outside DAL. Move this to server/data-access-layer/." >&2
    exit 2
  fi
fi
exit 0
```

### Key hook concepts:
- **Exit code 2** = block the action (security hooks must use this)
- **Exit code 1** = non-blocking error (action proceeds)
- **Exit code 0** = allow
- Hook data arrives via **stdin as JSON** (not env vars)
- Configure in `.claude/settings.json` (project-level, committed) or `~/.claude/settings.json` (personal)

---

## 4. Cloud Session Setup — Dev Server + Browser Auth

Cloud sessions (Claude Code on the web) need two things our local dev doesn't: Cloudflare secrets for `pnpm dev`, and GitHub credentials for browser E2E testing.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Claude Code Web Environment Settings (one-time setup)  │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Environment Variables (secrets)                  │    │
│  │  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,        │    │
│  │  AUTH_SECRET, COOKIE_ENCRYPTION_KEY,             │    │
│  │  OPENAI_API_KEY, STRIPE_SECRET_KEY,             │    │
│  │  CLOUDFLARE_D1_ACCOUNT_ID, CLOUDFLARE_D1_API..  │    │
│  │  GH_TOKEN (for gh CLI cleanup)                  │    │
│  │  GH_TEST_USERNAME, GH_TEST_PASSWORD             │    │
│  │  GH_TEST_MFA_SECRET (TOTP base32 secret)       │    │
│  │  GH_TEST_ORG (org for destructive E2E tests)   │    │
│  │  AGENT_BROWSER_ENCRYPTION_KEY (optional)        │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Setup Script (runs before Claude Code launches)  │    │
│  │  apt install -y gh                              │    │
│  │  npm install -g pnpm                            │    │
│  │  pnpm install (includes agent-browser + otpauth)│    │
│  │  node node_modules/playwright-core/cli.js       │    │
│  │    install chromium-headless-shell              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼ session starts
┌─────────────────────────────────────────────────────────┐
│  SessionStart Hook (.claude/hooks/setup-cloud-session.sh)│
│  - Reads .dev.vars (local) or env vars (cloud)         │
│  - Writes them to CLAUDE_ENV_FILE                      │
│  - Configures GH_TOKEN for gh CLI                      │
│  - Runs pnpm install if needed (cloud only)            │
│  - Applies D1 migrations (pnpm db:migrate:local)       │
│  - Sets up workerd transparent proxy (redsocks)        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼ pnpm dev starts
┌─────────────────────────────────────────────────────────┐
│  Browser Auth (.claude/hooks/browser-github-auth.sh)    │
│  - Restores saved auth state (fast path)               │
│  - Or: opens localhost:8787 → clicks GitHub sign-in    │
│  - Fills credentials via auth vault or env vars        │
│  - Handles 2FA via TOTP (GH_TEST_MFA_SECRET + otpauth)│
│  - Handles OAuth consent + callback redirect           │
│  - Saves state for reuse across runs                   │
└─────────────────────────────────────────────────────────┘
```

### Step 1: Configure the Cloud Environment (one-time)

In the Claude Code web UI, go to **Settings → Environment → Environment variables** and add every key from your `.dev.vars` file. These are the same secrets that `pnpm dev` (wrangler) needs:

| Variable | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app |
| `AUTH_SECRET` | Better Auth signing |
| `COOKIE_ENCRYPTION_KEY` | Session cookies |
| `OPENAI_API_KEY` | AI model access |
| `STRIPE_SECRET_KEY` | Billing |
| `CLOUDFLARE_D1_ACCOUNT_ID` | D1 database |
| `CLOUDFLARE_DATABASE_ID` | D1 database |
| `CLOUDFLARE_D1_API_TOKEN` | D1 API access |
| `BASEURL` | `http://localhost:8787` |
| `AUTH_URL` | `http://localhost:8787` |

For browser testing, also add:

| Variable | Purpose |
|---|---|
| `GH_TOKEN` | GitHub PAT for `gh` CLI (test cleanup) |
| `GH_TEST_USERNAME` | GitHub account for OAuth login |
| `GH_TEST_PASSWORD` | GitHub account password |
| `GH_TEST_MFA_SECRET` | TOTP base32 secret for 2FA (from GitHub authenticator app setup) |
| `GH_TEST_ORG` | GitHub org for destructive E2E testing (create/delete repos, teams, etc.) |
| `AGENT_BROWSER_ENCRYPTION_KEY` | (Optional) Encryption key for agent-browser auth vault |

### Step 1b: Configure the Network Allowlist (one-time)

In the Claude Code web UI, go to **Settings → Environment → Network** and ensure these domains are **allowed**:

| Domain | Required for |
|---|---|
| `github.com` | GitHub OAuth login + token exchange (workerd needs **direct** access) |
| `api.github.com` | GitHub REST API calls from the worker (Octokit) |
| `api.openai.com` | OpenAI API calls for AI chat |
| `cdn.playwright.dev` | Chromium headless shell binary download (used by `agent-browser@0.17.x`) |
| `storage.googleapis.com` | Chromium download redirects here from `cdn.playwright.dev` |

> **Note:** `workerd` (the Cloudflare Workers local runtime) cannot use HTTP proxies — it makes direct TCP connections. The `setup-workerd-proxy.sh` hook handles this automatically by setting up a transparent proxy (redsocks + iptables) that intercepts workerd's connections and routes them through the cloud environment's HTTPS proxy. No direct outbound access from the container is needed.

> **What breaks without `cdn.playwright.dev`**: `agent-browser` (v0.17.x) uses `playwright-core` to launch the browser. The setup script runs `pnpm run browser install` which downloads `chromium_headless_shell` from `cdn.playwright.dev`. If that domain is blocked, the download silently fails and `pnpm run browser open <url>` will error with *"Executable doesn't exist at chromium_headless_shell-1208/..."*.

### Step 2: Add a Setup Script (one-time)

In the Claude Code web UI, add a **setup script** that installs system-level dependencies. This runs *before* Claude Code launches:

```bash
#!/bin/bash

# Install GitHub CLI
if ! type gh > /dev/null 2>&1; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  apt update && apt install gh -y
fi

# Install redsocks for workerd transparent proxy (see Known Limitations)
if ! type redsocks > /dev/null 2>&1; then
  apt-get install -y redsocks
fi

# Install pnpm if not present
if ! type pnpm > /dev/null 2>&1; then
  npm install -g pnpm
fi

# Install project dependencies — includes agent-browser@0.17.x and otpauth for TOTP 2FA.
# agent-browser is a local dep (package.json), no global install needed.
# IMPORTANT: cd into the project root first — pnpm requires a package.json and the
# setup script may run from a different directory (e.g. /home/user).
cd /home/user/gh-admin.com
pnpm install

# Download the Chromium browser binaries that agent-browser needs.
# IMPORTANT: Do NOT use `pnpm run browser install` — it runs `npx playwright install`
# which may resolve a different playwright version than agent-browser's playwright-core,
# causing a revision mismatch (e.g., installs rev 1194 but runtime expects rev 1208).
# Instead, use agent-browser's resolved playwright-core directly:
PLAYWRIGHT_CORE="$(node -e "console.log(require.resolve('playwright-core/cli.js', {paths:[require.resolve('agent-browser')]}))")"
node "$PLAYWRIGHT_CORE" install --with-deps chromium-headless-shell
```

### Step 3: How It Works at Runtime

The `SessionStart` hook (`.claude/hooks/setup-cloud-session.sh`) runs automatically when a session starts. It:

1. **Generates `.dev.vars`** (if missing): Writes all required Wrangler secrets from env vars into `.dev.vars` so that `pnpm dev` finds them immediately — no manual file creation needed
2. **Loads `.dev.vars` into `CLAUDE_ENV_FILE`**: Makes all secrets available to every subsequent `Bash` command
3. **Configures `gh` CLI**: Exports `GH_TOKEN` so the `gh` CLI works without extra setup
4. **Installs dependencies**: Runs `pnpm install` in cloud sessions if `node_modules` is missing
5. **Applies D1 migrations**: Runs `pnpm db:migrate:local` to ensure the local SQLite database has all required tables (e.g., `accounts` for OAuth)
6. **Sets up workerd transparent proxy**: Runs `setup-workerd-proxy.sh` to configure redsocks + iptables so `workerd` can reach external HTTPS hosts (see Known Limitations below)

> **Why `.dev.vars` must exist**: Wrangler reads secrets from `.dev.vars` at startup and injects them as `env.VARIABLE_NAME` bindings in the Cloudflare Worker. Without this file, secrets like `GITHUB_CLIENT_ID` are unavailable to the Worker and OAuth login silently breaks (the authorize URL will show `client_id=`). The hook now creates this file automatically from env vars on every fresh session.

When `/implement-and-verify` reaches the browser E2E phase, the auth helper script (`.claude/hooks/browser-github-auth.sh`) handles GitHub login:

1. **Fast path**: Tries to restore previously saved browser state (`/tmp/gh-admin-auth-state.json`)
2. **Full OAuth flow**: If no saved state, opens `localhost:8787`, clicks "Sign in with GitHub", fills credentials on `github.com`
3. **2FA handling**: If GitHub presents a 2FA page, generates a TOTP code from `GH_TEST_MFA_SECRET` using the `otpauth` library (`.claude/hooks/generate-totp.mjs`) and fills it automatically
4. **OAuth consent**: Handles the "Authorize" page, waits for the callback redirect to `/dashboard`
5. **Credential sources** (in priority order):
   - **agent-browser auth vault** (recommended — password never exposed to the LLM)
   - **`GH_TEST_USERNAME` + `GH_TEST_PASSWORD`** environment variables
6. **Saves state**: After successful login, saves cookies/localStorage so the next run skips the login entirely

### Step 4: Obtain the TOTP Secret for 2FA

When enabling 2FA on the GitHub test account, GitHub shows a QR code and a **setup key** (a base32-encoded string like `JBSWY3DPEHPK3PXP`). This is the value for `GH_TEST_MFA_SECRET`.

**If 2FA is already enabled**, you need the original setup key you saved when configuring 2FA. If you didn't save it:
1. Go to GitHub → Settings → Password and authentication → Two-factor authentication
2. Click "Edit two-factor methods" → reconfigure your authenticator app
3. When shown the QR code, click "setup key" to reveal the base32 secret
4. Save that string as `GH_TEST_MFA_SECRET`

**How it works at runtime**: The auth script calls `.claude/hooks/generate-totp.mjs`, which uses the `otpauth` library to generate a time-based 6-digit code (RFC 6238, SHA1, 30-second period) — the same algorithm as Google Authenticator, Authy, etc.

### Step 5: Set Up the Auth Vault (optional, more secure)

The auth vault encrypts credentials locally so the LLM never sees passwords. Set it up once locally, then the encryption key travels via environment variable:

```bash
# Local machine — save credentials once
echo 'your-github-password' | agent-browser auth save github \
  --url https://github.com/login \
  --username your-github-username \
  --password-stdin

# Copy the auto-generated encryption key
cat ~/.agent-browser/.encryption-key
# Add this value as AGENT_BROWSER_ENCRYPTION_KEY in cloud env settings
```

In cloud sessions, the SessionStart hook persists `AGENT_BROWSER_ENCRYPTION_KEY` to `CLAUDE_ENV_FILE`, and the auth vault works transparently.

### Known Cloud Environment Limitations

#### `workerd` cannot reach `github.com` — OAuth login and GitHub API calls fail

**Symptom:** GitHub OAuth redirects back to `/api/auth/error?error=oauth_code_verification_failed`. Wrangler dev log shows:
```
DNS lookup failed; params.host = github.com; Temporary failure in name resolution
```

**Root cause:** The Cloudflare Workers local runtime (`workerd`) does not honor `HTTPS_PROXY` / `HTTP_PROXY` environment variables. In the cloud session environment, **all** outbound traffic (DNS on port 53, HTTPS on port 443) is blocked at the firewall level — only the authenticated HTTPS proxy can reach external hosts. `curl` and Node.js work because they read the proxy env vars, but `workerd` is a separate C++ binary that makes direct connections, which are blocked.

Additionally:
- DNS resolution fails (`/etc/resolv.conf` points to 8.8.8.8 which is unreachable)
- Direct TCP to github.com IPs is blocked even with correct IPs in `/etc/hosts`
- `proxychains4` cannot be used because the proxy's JWT password (718 chars) exceeds the 255-char limit
- workerd has no built-in proxy support and no plans for one upstream

This affects:
- GitHub OAuth code exchange (auth callback → `POST https://github.com/login/oauth/access_token`)
- All GitHub API calls from the worker (Octokit, Better Auth token validation)
- OpenAI API calls (AI chat would also fail for the same reason)

**How it's fixed — redsocks transparent proxy (automatic):**

The `setup-cloud-session.sh` hook calls `setup-workerd-proxy.sh`, which sets up a transparent proxy using [redsocks](https://github.com/darkk/redsocks) and `iptables`. This runs automatically on every cloud session start. Here's what it does:

1. **Resolves external host IPs** via DNS-over-HTTPS (Cloudflare DoH through the proxy), since direct DNS is blocked
2. **Adds `/etc/hosts` entries** so workerd can resolve hostnames without DNS
3. **Starts redsocks** on `localhost:12345`, configured to forward through the upstream HTTPS proxy with full JWT auth credentials
4. **Configures iptables NAT rules** to transparently redirect port 443 traffic for specific external IPs through redsocks

Hosts proxied: `github.com`, `api.github.com`, `api.openai.com`, `api.stripe.com`

This approach works because:
- redsocks operates at the kernel level (iptables REDIRECT), so workerd doesn't need to know about the proxy
- redsocks has no password length limit (unlike `proxychains4` which caps at 255 chars)
- Only traffic to known external hosts is redirected; local traffic is unaffected

> **No manual steps required.** The proxy setup is fully automatic. If it fails (e.g., `redsocks` not installed), the hook logs a warning but doesn't block the session — `pnpm dev` will start, but workerd won't be able to reach external hosts.

**Prerequisites in the cloud environment setup script:**
```bash
# Install redsocks (add to the setup script in Step 2 if not already present)
apt-get install -y redsocks
```

**Alternative: Test against the deployed dev environment**

If the transparent proxy approach doesn't work, skip local `pnpm dev` and test against the deployed Cloudflare dev environment where the worker runs on Cloudflare's edge with full internet access.

1. Add `CLOUDFLARE_API_TOKEN` to cloud environment variables (a Cloudflare API token with Workers permissions)
2. Deploy: `pnpm deploy:dev`
3. Ensure the GitHub OAuth app has the dev deployment URL (e.g., `https://gh-admin-com.workers.dev`) as an authorized redirect URI
4. Set `AUTH_URL` and `BASEURL` to the deployed dev URL in `.dev.vars.dev`
5. Test against the deployed URL instead of `localhost:8787`

This tests the real production-like stack but has a slower iteration cycle (deploy before each test).

#### `agent-browser install` downloads the wrong Chromium revision

**Symptom:** `pnpm run browser open <url>` fails with: `Executable doesn't exist at chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`

**Root cause:** `agent-browser install` internally runs `npx playwright install chromium`. In a pnpm workspace, `npx` resolves the `playwright` package independently from `agent-browser`'s own `playwright-core` dependency. When the versions differ (e.g., `npx` resolves `playwright@1.56.1` while `agent-browser` uses `playwright-core@1.58.2`), the installed chromium revision (1194) doesn't match what `agent-browser` expects at runtime (1208).

**Fix (primary):** Use `agent-browser`'s resolved `playwright-core` CLI directly:

```bash
PLAYWRIGHT_CORE="$(node -e "console.log(require.resolve('playwright-core/cli.js', {paths:[require.resolve('agent-browser')]}))")"
node "$PLAYWRIGHT_CORE" install --with-deps chromium-headless-shell
```

**Fix (fallback — no network required):** If the download is network-blocked or the background install hasn't finished yet, symlink from any already-installed chromium revision to the path `agent-browser` expects. The `setup-cloud-session.sh` hook does this automatically using version numbers read dynamically from `playwright-core`'s own `browsers.json`:

```bash
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
```

This works because a standard `chromium` binary (installed by an earlier `playwright install` call with the wrong version) is functionally compatible for running the app. The `find` is dynamic so it adapts as the underlying installed revision changes.

If both approaches fail, download manually via `curl`:

```bash
# 1. Find the expected revision
node -e "const b=require(require.resolve('playwright-core/browsers.json',{paths:[require.resolve('agent-browser')]}));console.log(b.browsers.find(x=>x.name==='chromium-headless-shell'))"

# 2. Download via curl (inherits proxy automatically)
curl -sL -o /tmp/chrome-headless-shell.zip "https://cdn.playwright.dev/builds/cft/<VERSION>/linux64/chrome-headless-shell-linux64.zip"

# 3. Extract to the correct cache location
mkdir -p ~/.cache/ms-playwright/chromium_headless_shell-<REVISION>
cd ~/.cache/ms-playwright/chromium_headless_shell-<REVISION> && unzip /tmp/chrome-headless-shell.zip
```

**Network allowlist:** Both `cdn.playwright.dev` and `storage.googleapis.com` must be allowed for the download approach (the CDN redirects to GCS for the actual binary). The symlink fallback requires no network access.

#### Playwright cannot load `github.com` without proxy configuration

**Symptom:** `agent-browser open https://github.com` shows `ERR_CERT_AUTHORITY_INVALID` or the page hangs indefinitely.

**Root cause:** Same proxy as above — but for Playwright, the fix is available. The `browser-github-auth.sh` hook and `setup-cloud-session.sh` now automatically configure these env vars when `HTTPS_PROXY` is detected:
- `AGENT_BROWSER_PROXY=$HTTPS_PROXY` — routes Playwright through the proxy
- `AGENT_BROWSER_PROXY_BYPASS=localhost,127.0.0.1` — keeps the dev server reachable
- `AGENT_BROWSER_IGNORE_HTTPS_ERRORS=true` — accepts the proxy's TLS inspection cert

These are set automatically. No manual action needed.

### Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm dev` fails with missing secrets | The SessionStart hook auto-creates `.dev.vars`; if it's still missing, verify secrets are set in Settings → Environment |
| GitHub OAuth URL shows `client_id=` (empty) | `.dev.vars` was missing when the dev server started — the SessionStart hook now creates it automatically; restart `pnpm dev` after the hook runs |
| OAuth callback → `/api/auth/error?error=oauth_code_verification_failed` | `workerd` cannot reach `github.com` — redsocks proxy should fix this automatically; check `pgrep redsocks` and `/tmp/redsocks.log` for errors |
| `redsocks` not found during session start | Add `apt-get install -y redsocks` to the cloud environment setup script (Step 2) |
| `agent-browser` not found | Use `./node_modules/.bin/agent-browser` (project-local); `browser-github-auth.sh` does this automatically |
| `pnpm run browser open` fails with "Executable doesn't exist at chromium_headless_shell-NNNN" | **Playwright version mismatch.** `agent-browser install` runs `npx playwright install chromium`, which may resolve a different `playwright` version than `agent-browser`'s own `playwright-core` dependency, so the installed revision doesn't match what `agent-browser` expects at runtime. The `setup-cloud-session.sh` hook handles this in two ways: (1) installs the correct binary via `playwright-core`'s own CLI in the background, and (2) if the download hasn't finished or is network-blocked, creates a symlink from any available chromium revision to the expected path — version numbers are resolved dynamically from `playwright-core/browsers.json`. If this still fails manually, see the Known Limitations section above for curl download instructions. |
| `pnpm run browser open https://github.com` hangs or shows cert error | `AGENT_BROWSER_PROXY` env var not set — the `setup-cloud-session.sh` hook sets this automatically when `HTTPS_PROXY` is detected; re-run the hook or set it manually |
| 2FA fails with "GH_TEST_MFA_SECRET is not set" | Add the TOTP base32 secret from your authenticator app setup to cloud env settings |
| 2FA code rejected | TOTP codes are time-sensitive — check that the server clock is accurate; the secret must be the base32-encoded key from GitHub's 2FA setup page |
| GitHub shows WebAuthn 2FA instead of TOTP | `browser-github-auth.sh` now navigates to `/sessions/two-factor/app` automatically to switch to TOTP |
| OAuth consent page doesn't appear | App was already authorized — the flow should skip straight through |
| Auth state expired | Delete `/tmp/gh-admin-auth-state.json` and re-run the auth helper |
| `gh` CLI says "not authenticated" | Verify `GH_TOKEN` is set in cloud env settings |

---

## 5. Chrome DevTools MCP — Debug Your Browser Session

This is directly relevant to our web app development. The Chrome DevTools MCP server gives Claude access to a live Chrome browser for debugging.

### Setup

```bash
# Add the official Google Chrome DevTools MCP server
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

For connecting to an existing Chrome session (useful for authenticated pages like our dashboard):

```bash
# Launch Chrome with remote debugging
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# Add MCP with auto-connect
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --autoConnect
```

### Capabilities
- **Performance profiling**: Record traces and get actionable insights
- **Network analysis**: Inspect requests, responses, headers
- **Console access**: Read console messages with source-mapped stack traces
- **Screenshots**: Capture page state for visual verification
- **DOM inspection**: Navigate and query the page structure
- **Reliable automation**: Uses Puppeteer with automatic wait-for-result

### Practical use cases for gh-admin.com
- Debug the AI chat interface rendering issues without switching tools
- Inspect WebSocket connections to Durable Objects
- Profile dashboard performance (metric cards, data tables)
- Verify json-render spec rendering matches expectations
- Test OAuth flow by inspecting redirects and token exchange

### Alternative: Claude in Chrome Extension

Claude Code also has a native Chrome extension (`/mcp` → select `claude-in-chrome`) that opens new tabs, shares your browser's login state, and runs actions in a visible Chrome window. This is simpler for basic UI verification but less powerful than the full DevTools MCP.

---

## 6. Context Management — The #1 Skill

Context is the most important resource. Performance degrades as the 200K token window fills.

### Rules of thumb
- **Don't let context exceed 60-70%.** Use a statusline to monitor.
- **`/clear` between unrelated tasks.** Always.
- **`/compact` at 70%** — don't wait for auto-compaction at 75-92%.
- **After 2 failed corrections**, `/clear` and start fresh with a better prompt.
- **Use subagents for research** — they explore in their own context and return summaries.
- **Use `/btw` for quick questions** — answers appear in a dismissible overlay without entering conversation history.

### Set up a statusline

Add to `~/.claude/settings.json`:
```json
{
  "statusline": {
    "enabled": true,
    "script": "echo '{\"context_pct\": \"$CONTEXT_PERCENT%\", \"cost\": \"$SESSION_COST\", \"model\": \"$MODEL\"}'"
  }
}
```

Or install a community statusline like [ccstatusline](https://github.com/sirmalloc/ccstatusline) for richer metrics (context %, session cost, burn rate, block timer).

### Rewind and checkpoints
- **`Esc + Esc`** or **`/rewind`** — restore conversation, code, or both to any checkpoint
- Use it immediately after observing incorrect changes — becomes less effective as more operations occur
- Checkpoints persist across sessions
- Treat risky approaches as experiments — rewind if they don't work out

---

## 7. The Workflow: Explore → Plan → Implement → Verify

### Step 1: Explore (Plan Mode — `Shift+Tab` twice)
```
Read server/agent/tools/ and understand how tools are registered.
Also check how the MCP adapter works.
```

### Step 2: Plan (still in Plan Mode)
```
I want to add a new "archive-repo" tool. What files need to change?
Create a detailed plan.
```

Press `Ctrl+G` to edit the plan in your editor before proceeding.

### Step 3: Implement (Normal Mode)
```
Implement the archive-repo tool from your plan. Write tests using nock,
run `pnpm typecheck && pnpm test:run` and fix any failures.
```

### Step 4: Verify & Ship
```
Run pnpm check. If everything passes, commit and push, then create a PR
with gh pr create. Watch CI with gh pr checks — if anything fails, read
the logs with gh run view --log-failed, fix locally, and push again.
```

**When to skip planning:** If the change is a one-liner, a typo fix, or you can describe the diff in one sentence.

---

## 8. Prompting Techniques

### Be specific
| Instead of | Write |
|---|---|
| "add tests for the DAL" | "Write tests for `get-user-orgs.ts` covering the success path, 403 error, and rate limit. Use nock." |
| "fix the login bug" | "Users report login fails after session timeout. Check the auth flow in `server/auth/`, especially token refresh. Write a failing test first." |
| "make the dashboard look better" | "[paste screenshot] Implement this layout. Take a screenshot after and compare." |

### Reference existing patterns
```
Look at how get-user-orgs.ts is implemented in the DAL —
it returns GitHubResult<T> and has full test coverage.
Follow the same pattern for the new list-org-webhooks function.
```

### Let Claude interview you for large features
```
I want to add scheduled prompt template execution. Interview me about
requirements using AskUserQuestion. Ask about edge cases, error handling,
and tradeoffs. Then write a spec to docs/scheduled-templates-spec.md.
```

Start a fresh session to implement the spec — clean context focused entirely on execution.

---

## 9. Parallel Execution & Scaling

### Subagents (for focused, isolated tasks)
```
Use subagents to investigate how our CacheManager handles TTL expiry
and whether there are any race conditions in write-through updates.
```

Subagents report back to the parent. They can't talk to each other.

### Agent Teams (for coordinated multi-session work)
Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in settings. One session acts as team lead, coordinates tasks, and synthesizes results. Teammates work independently in their own context windows and can message each other.

Use agent teams when workers need to share findings and coordinate.

### `/batch` (for parallelizable file changes)
```
/batch migrate all DAL functions in server/data-access-layer/github/
to use the new GitHubResult<T> pattern
```

Decomposes into 5-30 independent units, each in an isolated git worktree. Great for migrations.

### Writer/Reviewer pattern (two sessions)
| Session A (Writer) | Session B (Reviewer) |
|---|---|
| Implement the rate limiter | _(wait)_ |
| _(wait)_ | Review `src/middleware/rateLimiter.ts` for edge cases and race conditions |
| Address review feedback | _(done)_ |

A fresh context improves review quality since Claude won't be biased toward code it just wrote.

---

## 10. MCP Servers Worth Adding

Beyond Chrome DevTools, these MCP servers are particularly relevant for our stack:

| Server | Why |
|---|---|
| **Context7** | Up-to-date, version-specific docs for React 19, TanStack, Drizzle, etc. Prevents Claude from using outdated API patterns. |
| **Sentry** | If we add error tracking — go from alert to fix without switching tools. |
| **Playwright** | Reliable web automation using accessibility snapshots instead of pixel coordinates. Alternative to our `agent-browser` setup. |

### MCP Tool Search (new feature)
Claude Code now supports lazy-loading for MCP servers, reducing context usage by up to 95%. Tools are only loaded when relevant — you can run many MCP servers without bloating context.

---

## 11. Plugins

Plugins bundle skills, hooks, subagents, and MCP servers into installable packages.

```bash
# Browse the marketplace
/plugin

# Install a plugin
/plugin install <name>
```

**Recommended:** Install a code intelligence plugin for TypeScript — gives Claude precise symbol navigation and automatic error detection after edits.

---

## 12. Common Anti-Patterns to Avoid

| Anti-pattern | Fix |
|---|---|
| **Kitchen sink session** — mixing unrelated tasks | `/clear` between unrelated tasks |
| **Correcting over and over** — 3+ failed corrections | `/clear`, write a better initial prompt |
| **Over-specified CLAUDE.md** — important rules get lost | Prune ruthlessly, move domain knowledge to skills |
| **Trust-then-verify gap** — no verification step | Always include tests, linting, or screenshots |
| **Infinite exploration** — unscoped "investigate" | Scope narrowly or use subagents |
| **Ignoring context usage** — working until auto-compaction | Monitor with statusline, `/compact` at 70% |
| **Unbounded CI polling** — waiting forever for stuck runners | Set a max poll count (10); stop and report if CI never turns green |

---

## Quick Reference

| Action | Command |
|---|---|
| Clear context | `/clear` |
| Compact with focus | `/compact Focus on the auth changes` |
| Quick question (no context cost) | `/btw what does this env var do?` |
| Plan mode | `Shift+Tab` twice |
| Rewind | `Esc + Esc` or `/rewind` |
| Resume last session | `claude --continue` |
| Pick a session | `claude --resume` |
| Rename session | `/rename oauth-migration` |
| Stop mid-action | `Esc` |
| Batch parallel changes | `/batch <description>` |
| Browse plugins | `/plugin` |
| View hooks | `/hooks` |

---

## Sources

- [Best Practices for Claude Code — Official Docs](https://code.claude.com/docs/en/best-practices)
- [Automate workflows with hooks — Official Docs](https://code.claude.com/docs/en/hooks-guide)
- [Chrome DevTools MCP for AI Agents](https://developer.chrome.com/blog/chrome-devtools-mcp)
- [Chrome DevTools MCP GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Claude Code Hooks Guide 2026](https://serenitiesai.com/articles/claude-code-hooks-guide-2026)
- [Claude Code Hooks: 5 Production Hooks From Scratch](https://blakecrosley.com/blog/claude-code-hooks-tutorial)
- [7 Claude Code Best Practices for 2026](https://www.eesel.ai/blog/claude-code-best-practices)
- [Claude Code Tips: 10 Real Productivity Workflows](https://www.f22labs.com/blogs/10-claude-code-productivity-tips-for-every-developer/)
- [How I Use Claude Code — Builder.io](https://www.builder.io/blog/claude-code)
- [Claude Code Extensions Explained](https://muneebsa.medium.com/claude-code-extensions-explained-skills-mcp-hooks-subagents-agent-teams-plugins-9294907e84ff)
- [Claude Code Agent Teams — Addy Osmani](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Agent Teams — Official Docs](https://code.claude.com/docs/en/agent-teams)
- [8 Best MCP Servers for Claude Code](https://www.bannerbear.com/blog/8-best-mcp-servers-for-claude-code-developers-in-2026/)
- [ccstatusline](https://github.com/sirmalloc/ccstatusline)
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
