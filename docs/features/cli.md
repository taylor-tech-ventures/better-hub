# Feature: CLI Client

The `gh-admin` CLI brings the full AI chat interface and direct GitHub administration commands to your terminal. It's a thin client — all the intelligence, tool execution, and billing enforcement runs on the server. The CLI is ideal for scripting, automation pipelines, and developers who prefer terminal-first workflows.

---

## What It Does

- Interactive AI chat session in the terminal — same agent and tools as the web app
- Single-shot commands for common operations without entering a chat session
- Direct commands for listing orgs, repos, and teams without AI overhead
- Billing status and usage tracking from the terminal
- Scriptable with `--yes` auto-approval flag for CI/CD use cases

---

## Installation

### Standalone binary (recommended)

Download from [GitHub Releases](https://github.com/taylor-tech-ventures/gh-admin.com/releases):

```bash
# macOS
curl -L https://github.com/taylor-tech-ventures/gh-admin.com/releases/latest/download/gh-admin-macos -o /usr/local/bin/gh-admin
chmod +x /usr/local/bin/gh-admin

# Linux
curl -L https://github.com/taylor-tech-ventures/gh-admin.com/releases/latest/download/gh-admin-linux -o /usr/local/bin/gh-admin
chmod +x /usr/local/bin/gh-admin
```

### npm package

```bash
npm install -g @gh-admin/cli
```

---

## Authentication

```bash
gh-admin auth login
```

This uses GitHub's OAuth **Device Flow**:

1. The command prints a one-time code and a URL: `https://github.com/login/device`
2. Open the URL in your browser, enter the code, and authorize the app
3. The CLI polls for completion; once authorized, your session is stored locally
4. Sessions last 8 hours; `gh-admin auth login` refreshes them

Sessions are stored in `~/.config/gh-admin/config.json`. The access token is never stored in plain text.

```bash
# Check current auth status
gh-admin auth status

# Log out
gh-admin auth logout
```

---

## Commands

### `gh-admin chat`

Start an interactive AI chat session.

```bash
gh-admin chat
```

The chat works identically to the web interface: natural language input, full tool access, confirmation prompts for destructive operations.

**Single-shot mode** — send a prompt and exit:

```bash
gh-admin chat "List all repos in acme-corp that haven't been updated in 90 days"
```

**Auto-approve mode** — skip confirmation prompts (useful for scripting; use with caution):

```bash
gh-admin chat --yes "Archive all repos in the legacy-team org with no activity in 365 days"
```

**Output format:** Markdown tables (not the json-render components of the web UI). Results are plain text suitable for terminal display or piping.

---

### `gh-admin org`

Direct commands for organization management without AI overhead.

```bash
# List your organizations
gh-admin org list

# List repositories in an org
gh-admin org repos [org]

# List teams in an org
gh-admin org teams [org]
```

These call the server directly via oRPC HTTP — no AI, no token usage consumed.

---

### `gh-admin billing`

View your subscription and usage from the terminal.

```bash
# Show current plan and monthly usage
gh-admin billing status

# Show detailed usage breakdown
gh-admin billing usage

# Open upgrade page in browser
gh-admin billing upgrade
```

---

### `gh-admin config`

Manage CLI configuration.

```bash
# Set a configuration value
gh-admin config set key value

# Get a configuration value
gh-admin config get key

# List all configuration
gh-admin config list
```

**Configurable values:**

| Key | Default | Description |
|---|---|---|
| `api_url` | `https://gh-admin.com` | Backend URL (override for self-hosted or local dev) |
| `output` | `table` | Output format (`table`, `json`, `csv`) |
| `no_color` | `false` | Disable ANSI color output |

---

## Output Formats

The CLI uses markdown tables by default, which render well in terminals with monospace fonts. Use `--json` for machine-readable output:

```bash
gh-admin org repos acme-corp --json
```

Returns a JSON array suitable for `jq` processing:

```bash
gh-admin org repos acme-corp --json | jq '.[] | select(.visibility == "public") | .name'
```

---

## Scripting and CI/CD

### Auto-approval flag

The `--yes` flag auto-approves all confirmation prompts, enabling use in scripts:

```bash
# In a CI/CD pipeline — be careful with destructive operations
gh-admin chat --yes "Archive the repo $REPO_NAME in $ORG"
```

**Security note:** `--yes` bypasses all confirmation gates. Only use it when you've verified the operation is safe. Prefer the interactive mode for operations that affect multiple resources.

### Environment variables

| Variable | Description |
|---|---|
| `GH_ADMIN_API_URL` | Override the backend URL |
| `GH_ADMIN_SESSION_TOKEN` | Session token (avoids `~/.config/gh-admin/config.json`) |
| `NO_COLOR` | Disable color output (standard convention) |

### Using in scripts

```bash
#!/bin/bash
# Find and archive stale repos

STALE=$(gh-admin chat --yes "Find repos in $ORG with no activity in 180 days" --json | jq -r '.repos[].name')

if [ -n "$STALE" ]; then
  echo "Archiving: $STALE"
  gh-admin chat --yes "Archive the following repos in $ORG: $STALE"
else
  echo "No stale repos found"
fi
```

---

## Architecture

The CLI is a thin client — all computation runs on the server:

| Communication | Transport | Used for |
|---|---|---|
| AI chat | WebSocket to `GitHubAgent` DO | `gh-admin chat` interactive mode |
| Direct commands | HTTP to `/api/orpc/*` | `gh-admin org`, `gh-admin billing` |
| Auth | HTTP to `/api/orpc/cliAuth/*` | Device flow, session management |

CLI WebSocket connections include `?client=cli` in the URL. The `GitHubAgent` detects this and:
- Uses the CLI system prompt (markdown tables instead of json-render specs)
- Skips the json-render stream transformation
- Returns plain markdown output

CLI HTTP requests use `Authorization: Bearer <sessionToken>`. The server converts this to a session cookie transparently.

---

## Tool Approval in the CLI

Destructive tools trigger Y/n prompts in the terminal:

```
The following operation requires confirmation:
  Delete repository: acme-corp/test-repo

This action is irreversible. Proceed? [y/N]:
```

With `--yes`, all confirmations are automatically approved. The same `TOOLS_REQUIRING_APPROVAL` list from the web app applies — no operations are skipped silently.

---

## Plan Requirements

The CLI uses the same usage quota as the web app and MCP server. All tool calls from `gh-admin chat` count against your monthly limit:

| Plan | Monthly limit (shared) |
|---|---|
| Free | 50 tool calls |
| Standard | 500 tool calls |
| Unlimited | No limit |

Direct commands (`gh-admin org`, `gh-admin billing`) do not consume tool call quota.

---

## E2E Test Scenarios

### Scenario 1: Initial authentication
1. Run: `gh-admin auth login`
2. **Expect:** One-time code and GitHub URL printed; after browser authorization, "Authenticated successfully" message; `gh-admin auth status` shows logged-in user

### Scenario 2: Interactive chat
1. Run: `gh-admin chat`
2. Type: `List all repos in [test org]`
3. **Expect:** Markdown table output with repo names, visibility, URLs; no confirmation prompt; usage counter shows in footer

### Scenario 3: Single-shot chat
1. Run: `gh-admin chat "List all teams in [test org]"`
2. **Expect:** Output printed as markdown table; process exits with code 0

### Scenario 4: Destructive operation — terminal confirmation
1. Run: `gh-admin chat "Delete the e2e-test-cli-repo in [test org]"`
2. **Expect:** Confirmation prompt with repo name; entering `y` executes; entering `n` cancels; process reflects outcome in exit code

### Scenario 5: Auto-approve flag
1. First create a test repo via the web or API
2. Run: `gh-admin chat --yes "Delete the e2e-test-auto repo in [test org]"`
3. **Expect:** No confirmation prompt; repo deleted; output confirms success

### Scenario 6: JSON output
1. Run: `gh-admin org repos [test org] --json`
2. **Expect:** Valid JSON array with repo objects; `jq '.[] | .name'` produces repo names

### Scenario 7: Direct org commands
1. Run: `gh-admin org list`
2. **Expect:** Table of organizations with name and URL; no tool quota consumed

### Scenario 8: Config override
1. Run: `gh-admin config set api_url http://localhost:8787`
2. Run: `gh-admin org list`
3. **Expect:** Uses local dev server; `gh-admin config get api_url` returns the set value

### Scenario 9: Usage limit in CLI
1. With a Free-tier account at 50/50 tool calls, run: `gh-admin chat "List repos in [test org]"`
2. **Expect:** Tool call returns usage exceeded message with upgrade URL

### Scenario 10: Session persistence
1. Authenticate; exit terminal; reopen terminal
2. Run: `gh-admin auth status`
3. **Expect:** Still authenticated; no re-auth required until 8-hour session expires

---

## Technical Reference

| Component | Location |
|---|---|
| CLI workspace | `cli/` |
| Auth command | `cli/src/commands/auth.ts` |
| Chat command | `cli/src/commands/chat.ts` |
| Org commands | `cli/src/commands/org.ts` |
| Billing commands | `cli/src/commands/billing.ts` |
| Config command | `cli/src/commands/config.ts` |
| WebSocket chat client | `cli/src/lib/ws-chat-client.ts` |
| oRPC HTTP client | `cli/src/lib/orpc-client.ts` |
| Auth management | `cli/src/lib/auth.ts` |
| Output formatters | `cli/src/lib/formatters.ts` |
| Tool approval (Y/n) | `cli/src/lib/tool-approval.ts` |
| CLI system prompt | `packages/shared/prompts-cli.ts` |
| Build (binary) | `cli/sea` (Node.js SEA) |
| Bundle | `cli/bundle` (`@vercel/ncc`) |
