# Architecture Overview

Full-stack TypeScript application for GitHub organization administration with AI assistance. Runs on Cloudflare Workers with Durable Objects for per-user stateful AI agents. Structured as a **pnpm workspace monorepo** with `clients/web` (React web app), `clients/mcp` (MCP server), `packages/shared` (shared types/config), and `server` (Cloudflare Worker core). Each workspace package owns its dependencies; the root `package.json` contains only global tooling.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router + Start (SSR), Tailwind CSS v4, Shadcn/ui |
| Backend | Cloudflare Workers (direct fetch handler, no framework) |
| API layer | oRPC with TanStack Start adapter |
| Database | Cloudflare D1 (SQLite via Drizzle ORM), Durable Object embedded SQLite |
| Auth | Better Auth with GitHub OAuth (PKCE), sessions in D1 |
| AI | OpenAI via Vercel AI SDK, Cloudflare Agents framework (WebSocket-based) |
| AI Chat UI | `@cloudflare/ai-chat` + `@json-render/react` / `@json-render/shadcn` |
| Billing | Stripe with usage metering via `wrapLanguageModel` |
| CLI | oclif-based thin client; WebSocket (chat) + HTTP (oRPC); see `docs/cli.md` |
| MCP | Remote MCP server via `McpAgent` + `@cloudflare/workers-oauth-provider`; Streamable HTTP transport |

## Request Routing

The Cloudflare Worker entry point (`server/index.ts`) dispatches requests in priority order:

```
Incoming request
       │
       ├─ /api/auth/**           → Better Auth handler
       │
       ├─ /mcp/**                → OAuthProvider + GitHubMcpAgent DO
       │                           (OAuth discovery, authorize, token, register,
       │                            Streamable HTTP MCP endpoint, callback)
       │
       ├─ /api/orpc/durable-iterator  → GitHubAgentEvents DO (WebSocket upgrade)
       │
       ├─ /agents/**             → routeAgentRequest() (Cloudflare Agents SDK)
       │                           routes WebSocket and RPC traffic to GitHubAgent DOs
       │                           CLI clients send Bearer token → session cookie bridge
       │
       └─ everything else        → TanStack Start SSR handler
                                   (includes /api/orpc/** via file-based route)
```

## Durable Objects

Four Durable Object classes are deployed:

### `GitHubAgent`

Extends `AIChatAgent` from the Cloudflare Agents framework.

- **One instance per user**, identified by GitHub user ID
- Maintains WebSocket connections for real-time AI chat
- Persists conversation history and user preferences in DO-local SQLite
- 3-tier GitHub token management: **in-memory cache → DO SQLite → D1**
- Entity caching for large GitHub result sets (org repos, org teams) via `CacheManager`
- Usage tracking: per-session tool count (`#sessionToolCount`), `usage_stats` DO SQLite table, `calculateUsageStats()` + `checkUsageLimit()` for subscription tier enforcement, Analytics Engine telemetry
- Scheduled token refresh via agents framework (`schedule()`)
- `@callable()` RPC methods exposed to the Worker over HTTP RPC

**Token resolution order in `getGitHubToken()`:**

| Tier | Source | When used |
|---|---|---|
| 1 | In-memory `#tokenCache` | Every call within the same DO lifecycle — zero SQL cost |
| 2 | DO SQLite (`github_tokens`) | After hibernation; populated by `setTokens()` on sign-in |
| 3 | D1 `accounts` table (`#readTokensFromD1()`) | DO evicted before any `setTokens()` call; D1 hit backfills tiers 1 & 2 |

D1 timestamps are stored as Unix seconds; `#readTokensFromD1()` converts to milliseconds before returning. After a D1 hit, `setTokens()` is called to backfill DO SQLite, warm the in-memory cache, and schedule the proactive refresh — subsequent calls are served from tier 1.

**Key methods:**

| Method | Description |
|---|---|
| `setTokens(data)` | Store OAuth tokens in DO SQLite + cache; schedule proactive refresh |
| `getGitHubToken()` | Resolve access token via 3-tier lookup; inline-refresh if expired |
| `refreshAccessToken()` | Scheduled callback: exchange refresh token for new access token; mirrors result back to D1 |
| `getPreference(key)` | Read a single user preference from DO SQLite |
| `setPreference(key, value)` | Upsert a user preference |
| `getPreferences()` | Return all preferences as a plain object |
| `getStatus()` | Return connection count and token presence |
| `onChatMessage(onFinish, options)` | Handle incoming AI chat message |
| `getCachedOrgRepos(org)` | Return cached repos for the org, or `null` on miss |
| `setCachedOrgRepos(org, repos)` | Replace the entire cached repo list for the org |
| `getCachedOrgTeams(org)` | Return cached teams for the org, or `null` on miss |
| `setCachedOrgTeams(org, teams)` | Replace the entire cached team list for the org |
| `addCachedRepo(org, repo)` | Write-through: add a single repo after creation |
| `removeCachedRepos(org, names)` | Write-through: remove repos after deletion |
| `updateCachedRepo(org, oldName, updates)` | Write-through: update a repo entry after mutation |

### `GitHubAgentEvents`

Extends `DurableIteratorObject` from `@orpc/experimental-durable-iterator`.

- Handles **oRPC DurableIterator WebSocket connections** separately from AI chat
- Enables real-time server-to-client event streaming with automatic reconnection
- All connections are signed with `AUTH_SECRET` to prevent unauthorized subscriptions
- WebSocket upgrades are routed here from `server/orpc/durable-iterator.ts` at the `/api/orpc/durable-iterator` path

### `GitHubMcpAgent`

Extends `McpAgent` from the Cloudflare Agents framework (`clients/mcp/agent.ts`).

- **One instance per MCP session**, serves MCP clients (Claude Code, Cursor, Windsurf, etc.) via Streamable HTTP transport
- Registers all 81 GitHub administration tools via `registerMcpTools()` from `server/agent/tools/mcp-adapter.ts`
- Uses shared tool definitions from `server/agent/tools/definitions.ts` — same execute logic as the web AI chat
- Destructive tools use a `confirmed` parameter pattern: first call returns a human-readable confirmation prompt; second call with `confirmed: true` executes the action
- GitHub token and subscription tier passed in via `props` from the OAuth handler (`clients/mcp/oauth.ts`)
- Usage enforcement: tracks tool calls per session, enforces subscription tier limits
- OAuth flow: `@cloudflare/workers-oauth-provider` provides OAuth 2.1 with dynamic client registration; GitHub OAuth (via Better Auth) as upstream identity provider

### `PromptTemplateDO`

Extends `DurableObject` from `cloudflare:workers`.

- **One instance per user**, identified by GitHub user ID (same naming convention as `GitHubAgent`)
- Stores custom prompt template definitions and execution run history in DO-local SQLite
- Fully isolated from `GitHubAgent` — separate schema, lifecycle, and storage budget
- Tables: `prompt_templates` (full definitions with steps/parameter bindings) and `prompt_template_runs` (execution history with step results)
- Per-user isolation: `env.PromptTemplateDO.idFromName(userId)` — no `userId` column needed

**Key methods:**

| Method | Description |
|---|---|
| `listTemplates()` | Return lightweight summaries (id, name, description, tags, stepCount, updatedAt) |
| `getTemplate(id)` | Return full template definition with steps and parameter bindings |
| `saveTemplate(template)` | Insert or replace a template; computes `step_count` from steps array |
| `deleteTemplate(id)` | Delete template and cascade to associated runs |
| `recordRun(run)` | Store a template execution record |
| `listRuns(templateId?, limit?)` | Query run history, optionally filtered by template |

### Stub Factories

**`getGitHubAgentStub(env, userId)`** (`server/durable-objects/github-agent-stub.ts`):
A shared factory for creating named `GitHubAgent` stubs. Use this everywhere instead of calling `env.GitHubAgent.get()` directly — named stubs improve observability in the Cloudflare dashboard.

**`getPromptTemplateDOStub(env, userId)`** (`server/durable-objects/prompt-template-stub.ts`):
Same pattern for `PromptTemplateDO`. Used by the prompt templates DAL.

## CLI Interface

The `cli/` workspace provides a terminal-based client for gh-admin.com built with oclif. It is a **thin client** — all intelligence, tools, and billing enforcement run server-side.

### Authentication

The CLI uses GitHub's **OAuth Device Flow** (not the web PKCE flow):

1. `gh-admin auth login` → server creates a device code via `cliAuth.initDeviceFlow` oRPC procedure
2. User authorizes in browser at `https://github.com/login/device`
3. CLI polls `cliAuth.pollDeviceFlow` → server exchanges device code for tokens, creates a Better Auth session in D1, and pushes tokens to the user's `GitHubAgent` DO
4. Session token is stored locally in `~/.config/gh-admin/`

### CLI → Server Communication

| Channel | Transport | Path |
|---|---|---|
| AI chat | WebSocket | `/agents/GitHubAgent/{userId}?client=cli` |
| Direct commands | HTTP | `/api/orpc/*` (same as web) |
| Auth | HTTP | `/api/orpc/cliAuth/*` |

CLI WebSocket connections include `?client=cli` in the URL. The `GitHubAgent` detects this and:
- Switches to `getCliSystemPrompt()` (markdown tables instead of json-render specs)
- Skips `pipeJsonRender()` stream transformation

CLI HTTP requests use `Authorization: Bearer <sessionToken>`. The Worker entry point (`server/index.ts`) converts this to a session cookie so Better Auth resolves the session normally.

### Tool Approval in CLI

Destructive tools use Y/n terminal prompts (via `cli/src/lib/tool-approval.ts`) instead of the web UI's Approve/Deny buttons. The same `TOOLS_REQUIRING_APPROVAL` list from `shared/config/tool-approval.ts` is used. The `--yes` flag auto-approves all tools for scripting.

## Key Directories

```
clients/web/                  # Web UI (React 19 + TanStack Start) — @gh-admin/web
  routes/
    __root.tsx              # Root layout: session + theme SSR, ThemeProvider
    index.tsx               # Login/home page (/)
    dashboard/
      route.tsx             # Auth guard + AppShell layout for /dashboard/*
      index.tsx             # /dashboard overview (command center)
      chat.tsx              # /dashboard/chat full-page AI chat
      admin.tsx             # /dashboard/admin analytics (admin-only)
      prompt-templates/
        route.tsx           # Layout route for /dashboard/prompt-templates/*
        index.tsx           # Template list table with CRUD actions
        new.tsx             # New template builder
        $templateId.tsx     # Edit template / run modal
    docs/                   # Documentation pages (MCP setup, etc.)
  functions/
    admin-analytics.ts      # Admin analytics server function (AE + D1)
    api/orpc.$.ts           # TanStack Start route → oRPC RPCHandler
  components/
    layout/                 # AppMenubar, NavDrawer, AiDrawer
    ui/                     # Shadcn components + chat/ sub-components
    form/                   # TanStack Form field components
    prompt-templates/       # Template builder, run modal
  providers/
    theme-provider.tsx      # Theme context (SSR-seeded, persisted to DO via oRPC)
  lib/
    orpc.ts                 # Browser oRPC client with DurableIteratorLinkPlugin
    prompt-templates/
      generate-prompt.ts    # Prompt generation + dynamic input extraction

clients/mcp/                  # MCP server — @gh-admin/mcp
  agent.ts                  # GitHubMcpAgent DO: extends McpAgent, registers all 81 tools
  oauth.ts                  # OAuth handler: GitHub upstream → MCP token issuance
  handler.ts                # Route handler: OAuthProvider + McpAgent.serve()

packages/shared/              # Shared types and config — @gh-admin/shared
  logger.ts                 # pino logger factory (createLogger)
  prompts.ts                # System prompts: BASE + WEB + MCP variants
  config/tool-approval.ts   # TOOLS_REQUIRING_APPROVAL + toolNeedsApproval() helper
  json-render/catalog.ts    # explorerCatalog (component registry + prompt)

server/                       # Server core — @gh-admin/server
  index.ts                  # Worker entry: auth, MCP, durable-iterator, agents, SSR
  auth/                     # Better Auth configuration
  orpc/
    middleware.ts           # base + authorized oRPC middleware
    router.ts               # oRPC router root (preferences, promptTemplates)
    durable-iterator.ts     # Routes DurableIterator WebSocket upgrades to GitHubAgentEvents
    routes/                 # Sub-routers (preferences.ts, prompt-templates.ts)
  durable-objects/
    github-agent.ts         # GitHubAgent DO
    github-agent-events.ts  # GitHubAgentEvents DO
    github-agent-stub.ts    # getGitHubAgentStub() factory
    cache-manager.ts        # CacheManager: entity cache R/W backed by DO SQLite
    prompt-template.ts      # PromptTemplateDO: templates + run history (per-user SQLite)
    prompt-template-stub.ts # getPromptTemplateDOStub() factory
  data-access-layer/
    preferences.ts          # User preference CRUD via GitHubAgent RPC
    prompt-templates.ts     # Template CRUD via PromptTemplateDO RPC
    github/                 # GitHub API (Octokit) functions
  agent/tools/
    contracts.ts            # oRPC contracts (schemas) — single source of truth
    definitions.ts          # Platform-agnostic tool definitions (shared execute logic)
    index.ts                # AI SDK adapter: definitions → implementTool()
    mcp-adapter.ts          # MCP adapter: definitions → server.tool() with confirmation
  functions/                # TanStack Start server functions (auth, preferences)
  db/                       # Drizzle schema + D1 migrations
  workflows/
    admin-action.ts         # AdminActionWorkflow: human-in-the-loop approval

cli/                        # CLI workspace (oclif-based, thin client)
  src/commands/             #   Command implementations (auth, chat, org, billing, config)
  src/lib/                  #   CLI libraries (auth, orpc-client, ws-chat-client, formatters)
__tests__/                    # Vitest unit tests, mirroring src directory structure
  server/data-access-layer/ # Unit tests for every DAL function (nock for HTTP mocking)
  clients/web/              # Unit tests for web client
```

## Authentication Flow

### Web (PKCE)

1. User initiates GitHub OAuth via Better Auth (PKCE flow)
2. On successful sign-in, Better Auth fires a `user.created` / `session.created` hook
3. The hook reads the user's GitHub access token from the `accounts` D1 table and calls `stub.setTokens()` to push it into the user's `GitHubAgent` DO
4. The token is stored in DO SQLite (tier 2) and in-memory cache (tier 1); a proactive refresh is scheduled
5. If the DO is evicted before any tool call, the next `getGitHubToken()` call falls back to D1 (tier 3) and re-populates the DO automatically
6. Sessions expire after 8 hours; Better Auth auto-refreshes within 1 hour of expiry
7. All `/dashboard/*` routes are protected by a TanStack Start server middleware that validates the session

### CLI (Device Flow)

1. `gh-admin auth login` calls `cliAuth.initDeviceFlow` → server requests a device code from GitHub
2. User enters the one-time code at `https://github.com/login/device`
3. CLI polls `cliAuth.pollDeviceFlow` → server exchanges the device code for GitHub tokens
4. Server creates a Better Auth-compatible session row in D1 and pushes tokens to the user's `GitHubAgent` DO (same as the web hook)
5. Session token returned to CLI, stored locally in `~/.config/gh-admin/config.json`
6. Subsequent requests use `Authorization: Bearer <token>` → Worker converts to session cookie for Better Auth

## AI Chat Flow

1. Browser opens a WebSocket to the user's `GitHubAgent` DO via the Cloudflare Agents client SDK
2. `AIChatAgent` (in the DO) receives messages and calls `onChatMessage`
3. `onChatMessage` runs `streamText` with 81 GitHub tools (contracts in `server/agent/tools/contracts.ts`), using the centralized system prompt from `getSystemPrompt()` (`packages/shared/prompts.ts`). Destructive tools have `needsApproval: true` set by `applyApprovalPolicy()`. The result is piped through `pipeJsonRender` which intercepts ` ```spec ``` `-fenced JSONL lines and emits them as `data-spec` stream parts
4. `createUIMessageStreamResponse` wraps the transformed stream as SSE
5. On the client, `useAgentChat` accumulates stream parts into `message.parts`; `data-spec` parts carry RFC 6902 JSON Patches that `buildSpecFromParts` assembles into a `Spec`
6. `MessageParts` renders all text parts as one `<MessageResponse>` (via `ReactMarkdown`) and the assembled spec via `<ExplorerRenderer>` (json-render React renderer backed by `explorerCatalog`)
7. Tool call parts render as collapsible `ToolCall` cards with input/output display; destructive tools show Approve/Deny buttons when in `approval-requested` state

**SSR constraint:** `useAgentChat` calls `defaultGetInitialMessagesFetch` on mount — this will fail during SSR. Routes that render `ChatInterface` must set `ssr: false`. Layout components (e.g. `AiDrawer`) must lazy-mount `ChatInterface` using a `useRef` flag set in `useEffect`, so it never renders server-side.

## MCP Server Flow

The MCP server (`clients/mcp/`) enables AI coding assistants (Claude Code, Cursor, Windsurf) to access all 81 GitHub administration tools via the Model Context Protocol.

**Authentication:**

1. MCP client discovers OAuth metadata at `/mcp/.well-known/oauth-authorization-server`
2. Client registers dynamically at `/mcp/register` (RFC 7591)
3. Client redirects user to `/mcp/authorize`
4. If user has an existing Better Auth session, MCP authorization completes immediately
5. Otherwise, user is redirected to GitHub OAuth via Better Auth; after login, `/mcp/callback` resumes the MCP flow
6. Client exchanges authorization code for an MCP access token at `/mcp/token` (8-hour TTL)

**Tool execution:**

1. Authenticated MCP requests hit `/mcp` and are routed to a `GitHubMcpAgent` DO instance
2. The DO registers all 81 tools via `registerMcpTools()` using shared definitions from `server/agent/tools/definitions.ts`
3. Read-only tools execute immediately; destructive tools require a `confirmed: true` parameter
4. First call to a destructive tool (without `confirmed`) returns a human-readable confirmation prompt via `summarizeAction()`
5. Second call with `confirmed: true` executes the action
6. Usage is tracked per session and enforced against subscription tier limits

**Shared tool architecture:**

- `server/agent/tools/definitions.ts` — Platform-agnostic `ToolDefinition` objects with `execute(input, ctx: ToolContext)`
- `server/agent/tools/index.ts` — AI SDK adapter (web chat): wraps definitions via `implementTool()` with `needsApproval` for destructive tools
- `server/agent/tools/mcp-adapter.ts` — MCP adapter: wraps definitions via `server.tool()` with `confirmed` parameter pattern
- Both adapters share the same execute logic, ensuring consistent behavior across web and MCP

## oRPC Streaming / DurableIterator Flow

For server-to-client push (e.g. real-time event feeds):

1. Browser `orpcClient` (configured with `DurableIteratorLinkPlugin`) calls an oRPC procedure that returns an async iterator
2. The plugin upgrades the connection to WebSocket at `/api/orpc/durable-iterator`
3. The Worker routes this to `GitHubAgentEvents` via `upgradeGitHubAgentEventsRequest()`
4. `GitHubAgentEvents` (a `DurableIteratorObject`) manages the signed WebSocket session and delivers events

See [client-orpc-dal-durable-object.md](./client-orpc-dal-durable-object.md) for a detailed walkthrough of the full request flow.
