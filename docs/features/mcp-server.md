# Feature: MCP Server

gh-admin exposes all 81 GitHub administration tools as a remote MCP (Model Context Protocol) server. This lets you use gh-admin's capabilities directly from any MCP-compatible AI client — Claude Code, Cursor, Windsurf, Claude Desktop, and others — without opening a browser.

MCP access is included at every plan tier, including Free.

---

## What It Does

- Exposes all 81 GitHub administration tools to any MCP-compatible AI client
- Authenticates via GitHub OAuth — no separate account or API key needed
- Works within your existing AI workflow; the tools appear natively in your client's tool list
- Enforces the same confirmation pattern for destructive operations
- Counts tool executions against the same monthly usage pool as the web app

---

## MCP Endpoint

```
https://gh-admin.com/mcp
```

Transport: **Streamable HTTP** (the current MCP standard)

---

## Connecting Your Client

### Claude Code

```bash
claude mcp add gh-admin --transport streamable-http https://gh-admin.com/mcp
```

Then in any Claude Code session, gh-admin's tools are available. On first use, Claude Code will open a browser window for GitHub OAuth authorization.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gh-admin": {
      "url": "https://gh-admin.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "gh-admin": {
      "url": "https://gh-admin.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Windsurf

Add to Windsurf's MCP configuration using the same JSON format as Cursor.

---

## Authentication Flow

gh-admin's MCP server uses OAuth 2.1 with dynamic client registration, so your MCP client handles the auth flow automatically:

1. **Discovery** — your client fetches OAuth metadata from `https://gh-admin.com/mcp/.well-known/oauth-authorization-server`
2. **Registration** — client registers dynamically at `/mcp/register` (no manual setup needed)
3. **Authorization** — browser opens to `/mcp/authorize`; if you already have a gh-admin session, this completes immediately; otherwise you sign in with GitHub
4. **Token** — client exchanges the authorization code for an MCP access token at `/mcp/token` (8-hour TTL, same as web sessions)
5. **Tool calls** — all subsequent requests use the MCP access token; no re-auth until the token expires

You only authorize once per client. Tokens are refreshed automatically when they expire.

---

## How Tools Work in MCP Clients

All 81 tools appear in your MCP client's tool list. The client's AI model selects and calls them the same way it uses any other tool.

### Read-only tools

Tools like `listOrgRepos`, `listOrgTeams`, `getAuditLog`, `findStaleRepos`, and all other non-destructive tools execute immediately with no interruption.

### Destructive tools — the `confirmed` parameter

Instead of Approve/Deny buttons (which are a web UI concept), destructive tools use a `confirmed` parameter pattern:

1. **First call** (without `confirmed: true`): The tool returns a human-readable description of exactly what will happen — repos to delete, users to remove, settings to change — and instructs the AI to ask the user before proceeding
2. **The AI shows this to you** and asks: "Do you want to proceed?"
3. **Second call** (with `confirmed: true`): If you confirm, the AI calls the tool again with `confirmed: true` and it executes

Example exchange in Claude Code:

```
You: Delete the test-repo repository from acme-corp

Tool (first call): ⚠️ CONFIRMATION REQUIRED
This will permanently delete the repository acme-corp/test-repo.
This action is irreversible.
Call this tool again with confirmed: true to proceed.

Claude: This will permanently delete acme-corp/test-repo. This cannot be undone.
Do you want to proceed? (yes/no)

You: yes

Tool (second call, confirmed: true): ✓ Repository acme-corp/test-repo deleted successfully.
```

This pattern works with any MCP client — no web UI required.

---

## System Prompt

gh-admin registers a system prompt via the MCP protocol that configures the AI model's behavior:

- Use markdown tables for structured output (repos, teams, users, branches)
- Include full clickable GitHub URLs for every entity
- Use markdown headings to organize multi-section responses
- Summarize batch operation results in a table with a Status column per item
- Explain the `confirmed` pattern when presenting destructive tool results

In Claude Code, you can apply this prompt with: `/mcp__gh-admin__prompt`

---

## Usage and Billing

Tool executions via MCP count against your monthly plan limit, shared with web and CLI:

| Plan | Monthly limit (shared pool) |
|---|---|
| Free | 50 tool calls |
| Standard | 500 tool calls |
| Unlimited | No limit |

When you hit your limit, tools return a usage exceeded message with a link to upgrade.

---

## Security

- Your GitHub access token is stored encrypted (AES-256-GCM) in the `GitHubMcpAgent` Durable Object SQLite database — it never leaves Cloudflare's infrastructure
- The MCP access token has an 8-hour TTL and is scoped to your GitHub identity
- Each MCP session is a separate `GitHubMcpAgent` DO instance — sessions are isolated from each other
- OAuth tokens are never logged or exposed in tool outputs

---

## E2E Test Scenarios

### Scenario 1: Initial connection — Claude Code
1. Run: `claude mcp add gh-admin --transport streamable-http https://gh-admin.com/mcp`
2. Start a Claude Code session and ask: `What GitHub admin tools do you have?`
3. **Expect:** Browser opens for OAuth; after auth, tools list is returned; `listAvailableTools` shows 81 tools

### Scenario 2: Read-only tool — no confirmation
1. In a Claude Code session, prompt: `List all repos in [test org]`
2. **Expect:** `listOrgRepos` executes immediately; results formatted as markdown table with org, name, visibility, URL columns; no confirmation prompt

### Scenario 3: Destructive tool — confirmation pattern
1. Prompt: `Delete the test-repo repository from [test org]`
2. **Expect:** First tool call returns confirmation description; Claude presents it to user asking to confirm; user says yes; second call with `confirmed: true` executes; success message returned

### Scenario 4: Deny destructive operation
1. Prompt: `Delete the test-repo repository from [test org]`
2. When Claude asks for confirmation, say "no"
3. **Expect:** Claude does not make the second tool call; acknowledges cancellation

### Scenario 5: Multi-tool workflow
1. Prompt: `Create a new private repo called mcp-e2e-test in [test org] and add the [team] team as maintainers`
2. **Expect:** Two confirmation prompts (one for `createGitHubRepo`, one for `addGitHubTeamsToRepos`); after both confirmed, both operations execute

### Scenario 6: Usage limit reached
1. Use a Free-tier account with 50/50 tool calls used in the current month
2. Prompt: `List repos in [test org]`
3. **Expect:** Tool returns: "Monthly tool execution limit reached. Upgrade at https://gh-admin.com/dashboard/billing"

### Scenario 7: Token expiry re-auth
1. Connect with MCP; wait for token to expire (8 hours) or invalidate it manually
2. Make a tool call
3. **Expect:** MCP client prompts for re-authorization; after re-auth, tool call succeeds

### Scenario 8: System prompt application
1. In Claude Code, run: `/mcp__gh-admin__prompt`
2. Ask for a list of repos
3. **Expect:** Output is formatted as a markdown table with full GitHub URLs

### Scenario 9: Security — cross-user isolation
1. Connect two different accounts to the MCP server
2. **Expect:** Each account sees only their own organizations and repositories; no cross-user data leakage

### Scenario 10: Large org caching
1. Connect to an org with 200+ repositories
2. Call `listOrgRepos` twice in quick succession
3. **Expect:** Second call is served from cache (15-min TTL) and returns faster; both calls return identical results

---

## Technical Reference

| Component | Location |
|---|---|
| `GitHubMcpAgent` DO | `clients/mcp/agent.ts` |
| OAuth handler | `clients/mcp/oauth.ts` |
| MCP route handler | `clients/mcp/handler.ts` |
| MCP adapter (tool registration) | `server/agent/tools/mcp-adapter.ts` |
| Shared tool definitions | `server/agent/tools/definitions.ts` |
| MCP system prompt | `getMcpSystemPrompt()` in `packages/shared/prompts.ts` |
| Route mounting | `/mcp/**` in `server/index.ts` |
| OAuth metadata | `GET /mcp/.well-known/oauth-authorization-server` |
| Token endpoint | `POST /mcp/token` |
| MCP endpoint | `POST /mcp` |
