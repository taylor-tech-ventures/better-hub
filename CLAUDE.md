# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack TypeScript app for GitHub organization administration with AI assistance. Runs on Cloudflare Workers with Durable Objects for per-user stateful AI agents. Structured as a **pnpm workspace monorepo** with `clients/web` (React web app), `clients/mcp` (MCP server), `packages/shared` (shared types/config), and `server` (Cloudflare Worker core). Each workspace package owns its dependencies; the root `package.json` contains only global tooling (`zod`, `typescript`, `vite`, `vitest`, `wrangler`, `biome`).

## Common Commands

```bash
# Development
pnpm dev                    # Start Vite + Wrangler dev server

# Build & Verify
pnpm build                  # vite build + tsc --noEmit
pnpm typecheck              # tsc --noEmit only (faster type-only check)
pnpm check                  # Full check: tsc, build, wrangler dry-run

# Linting
pnpm lint                   # Biome check
pnpm lint:fix               # Biome check --write (auto-fix)

# Testing
pnpm test                   # Vitest watch mode
pnpm test:run               # Vitest single run

# Database
pnpm db:generate            # Generate Drizzle migrations
pnpm db:migrate:local       # Apply D1 migrations locally
pnpm db:migrate:dev         # Apply to dev D1
pnpm db:studio:dev          # Open Drizzle Studio for dev DB

# Deploy
pnpm deploy:dev             # Deploy to Cloudflare dev environment
pnpm deploy:prod            # Deploy to Cloudflare production

# Auth schema generation
pnpm auth:generate          # Regenerate Better Auth schemas

# CLI
cd cli && pnpm dev          # Run CLI in development mode
cd cli && pnpm build        # Compile CLI TypeScript
cd cli && pnpm bundle       # Bundle CLI with ncc
cd cli && pnpm sea          # Build standalone binary (SEA)
```

## Architecture

### Stack
- **Frontend**: React 19, TanStack Router + Start (file-based routing with SSR), Tailwind CSS v4, Shadcn/ui components
- **Backend**: Cloudflare Workers (no framework — direct fetch handler)
- **APIs**: oRPC with TanStack Start adapter; integrates with Better Auth for session-aware server functions
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM; Durable Objects with embedded SQLite
- **Auth**: Better Auth with GitHub OAuth (PKCE), sessions stored in D1
- **AI**: OpenAI via AI SDK, Cloudflare Agents framework (WebSocket-based)
- **AI Chat UI**: `@cloudflare/ai-chat` + `@json-render/react` for chat interface; tool confirmation via `@cloudflare/ai-chat` tool parts
- **json-render**: `@json-render/core` / `@json-render/react` / `@json-render/shadcn` — AI generates UI specs streamed as JSONL patches; rendered client-side as React components
- **Billing**: Stripe with usage metering via `wrapLanguageModel`; annual pricing toggle; organization billing with seat management

- **MCP**: Remote MCP server via Cloudflare Agents `McpAgent` + `@cloudflare/workers-oauth-provider`; Streamable HTTP transport; GitHub OAuth for authentication
- **Webhook Automation**: Event-driven automation engine; GitHub webhook ingestion at `/api/webhooks/github`; user-defined rules with conditions and actions
- **Security Headers**: CORS, HSTS, X-Frame-Options, CSP, and other security headers via `server/middleware/security-headers.ts`
- **Logging**: pino (structured JSON) via `packages/shared/logger.ts`; see `docs/observability.md`
- **CLI**: oclif-based CLI client; thin client connecting to the same backend via WebSocket (chat) and HTTP (oRPC); see `docs/cli.md`

### Key Directories

```
clients/web/                  # Web UI (React 19 + TanStack Start) — @gh-admin/web
  routes/
    __root.tsx                # Root layout: session + theme SSR, ThemeProvider
    index.tsx                 # Login/home page (/)
    dashboard/                # Protected routes (auth guard + AppShell layout)
      prompt-templates/       # Custom prompt templates CRUD + builder
        route.tsx             # Layout route (ssr: false)
        index.tsx             # Template list table with CRUD
        new.tsx               # New template builder
        $templateId.tsx       # Edit template / run modal
    docs/                     # Documentation pages (MCP setup, scheduled tools)
    api/orpc.$.ts             # TanStack Start server route → oRPC HTTP handler
  components/
    layout/                   # AppMenubar, NavDrawer, AiDrawer
    ui/                       # Shadcn components + chat/ sub-components
    form/                     # TanStack Form field components
    prompt-templates/         # Template builder, run modal
  providers/
    theme-provider.tsx        # Theme context (SSR initial value, persists to DO via oRPC)
  lib/
    orpc.ts                   # Client-side oRPC typed client (browser-only)
    prompt-templates/
      generate-prompt.ts      # Prompt generation + dynamic input extraction
clients/mcp/                  # MCP server — @gh-admin/mcp
  agent.ts                    # GitHubMcpAgent DO: extends McpAgent, registers all 81 tools
  oauth.ts                    # OAuth handler: GitHub upstream → MCP token issuance
  handler.ts                  # Route handler: OAuthProvider + McpAgent.serve()
packages/shared/              # Shared types and config — @gh-admin/shared
  logger.ts                   # pino logger factory (createLogger)
  prompts.ts                  # System prompts: BASE_SYSTEM_PROMPT + getSystemPrompt() + getMcpSystemPrompt()
  prompts-cli.ts              # CLI-specific system prompt (markdown tables instead of json-render)
  config/tool-approval.ts     # TOOLS_REQUIRING_APPROVAL + toolNeedsApproval() helper
  json-render/catalog.ts      # explorerCatalog (component registry + prompt)
  schemas/prompt-templates.ts # Zod schemas for prompt template types
server/                       # Server core — @gh-admin/server (workspace package)
  index.ts                    # Worker entry point: exports all DOs, main fetch handler
  orpc/                       # oRPC middleware, router, routes
    routes/prompt-templates.ts # Prompt template oRPC sub-router
  auth/                       # Better Auth configuration
  durable-objects/             # GitHubAgent, GitHubAgentEvents, PromptTemplateDO, cache-manager
    prompt-template.ts        # PromptTemplateDO: template definitions + run history (per-user SQLite)
    prompt-template-stub.ts   # getPromptTemplateDOStub() — named stub factory
  agent/tools/
    contracts.ts              # oRPC contracts (schemas) — single source of truth
    definitions.ts            # Platform-agnostic tool definitions (shared execute logic)
    index.ts                  # AI SDK adapter: definitions → implementTool()
    mcp-adapter.ts            # MCP adapter: definitions → server.tool() with confirmation
  data-access-layer/           # All DB/API access (GitHub, Stripe, D1)
    github/pr/                # PR management DAL (list, merge)
    github/issues/            # Issue management DAL (list, create, labels)
    github/actions/           # Actions DAL (workflows, secrets, environments, usage)
    github/security/          # Security DAL (alerts, audit log, deploy keys, invitations)
    github/release/           # Release & tag management DAL (list, create)
    github/repo/              # Repo DAL (stats, contributors, settings, archive, webhooks, tags, code search, compare)
    github/org/               # Org DAL (members, stale repos, webhooks, billing, blocked users, settings)
    github/team/              # Team DAL (CRUD, child teams, repo/user membership)
    github/user/              # User DAL (collaborators, permissions, outside collaborator removal)
    prompt-templates.ts       # Template CRUD via PromptTemplateDO RPC
    org-billing.ts            # Organization billing DAL (orgs, seats, members)
    webhook-automation.ts     # Webhook automation rules and logs DAL
  middleware/
    security-headers.ts       # CORS + security headers middleware
  webhooks/
    github-webhook-handler.ts # GitHub webhook ingestion endpoint
  functions/                   # TanStack Start server functions
  db/                          # Drizzle schema + migrations
    schemas/organizations.ts  # Organization + member schemas
    schemas/webhook-automation.ts # Webhook rules + logs schemas
  workflows/                   # AdminActionWorkflow
  lib/crypto.ts                # AES-256-GCM token encryption
cli/                           # CLI workspace (oclif-based, thin client)
  src/commands/               #   Command implementations (auth, chat, org, billing, config)
  src/lib/                    #   CLI libraries (auth, orpc-client, ws-chat-client, formatters)
__tests__/                     # All unit tests, mirroring the source path structure
  server/                      #   e.g. __tests__/server/data-access-layer/
  clients/web/                 #   e.g. __tests__/clients/web/routes/
  setup.ts                     #   Common setup: nock activation, mock resets, etc.
```

### Data Access Layer

All database queries and third-party API interactions (GitHub via Octokit, Stripe, etc.) must live in `server/data-access-layer/`. Components and route handlers call DAL functions — they do not interact with the DB or external APIs directly.

Every new DAL function must be accompanied by unit tests in `__tests__/server/data-access-layer/` (mirroring the source path). Use nock to intercept HTTP requests; no real network calls are permitted in tests.

**GitHub DAL error convention:** All GitHub DAL functions return `GitHubResult<T>` (defined in `server/data-access-layer/github/types.ts`) — a discriminated union on `success`. Use the `ok()` / `fail()` / `mapStatusToErrorCode()` helpers. AI tools consume these results via `unwrapResult()` in `server/agent/tools/index.ts`, which produces actionable error messages (including rate-limit reset times and re-auth prompts). See `docs/error-handling.md` for the full convention and a reference implementation (`get-user-orgs.ts`).

### Server APIs (oRPC)

Use oRPC with the TanStack Start adapter for all server-side API endpoints. oRPC integrates directly with Better Auth so procedures can access the authenticated session.

**Request flow:** `client (browser) → oRPC HTTP handler → router procedure → DAL function → DB / Durable Object / GitHub API`

**Key files:**
- `clients/web/routes/api/orpc.$.ts` — TanStack Start route that mounts the `RPCHandler`; passes `{ headers, env }` as initial context; includes `DurableIteratorHandlerPlugin` for streaming support
- `server/orpc/middleware.ts` — `base` middleware (headers + Cloudflare env); `authorized` middleware (adds `session` + `user` via Better Auth)
- `server/orpc/router.ts` — all oRPC procedures; add new procedures here (or in sub-routers imported here)
- `server/orpc/durable-iterator.ts` — routes `/api/orpc/durable-iterator` WebSocket upgrades to the `GitHubAgentEvents` DO
- `clients/web/lib/orpc.ts` — typed browser client (`orpcClient`); uses `DurableIteratorLinkPlugin` for WebSocket-backed streaming; use this in React event handlers and mutations

**Adding a new procedure:**
```typescript
// server/orpc/router.ts
import { base, authorized } from '@/server/orpc/middleware';
import { myDalFunction } from '@/server/data-access-layer/my-module';
import { z } from 'zod';

export const router = {
  // Public (no auth):
  health: base.handler(() => ({ status: 'ok' })),

  // Authenticated:
  myFeature: {
    doSomething: base
      .use(authorized)
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) =>
        myDalFunction(context.env, context.session.userId, input.id),
      ),
  },
};
```

**Calling from the browser:**
```typescript
import { orpcClient } from '@/web/lib/orpc';

const result = await orpcClient.myFeature.doSomething({ id: '123' });
```

**Rules:**
- Procedures call DAL functions — never query the DB or GitHub API directly
- Use `base.use(authorized)` for any procedure that requires a logged-in session
- Zod schemas are required for all inputs at system boundaries

### Durable Objects

Three Durable Object classes are registered in `wrangler.jsonc`:

**`GitHubAgent`** (one instance per GitHub user ID) — extends `AIChatAgent`:
- Maintains WebSocket connections for real-time AI chat
- Persists conversation history and user preferences in DO SQLite
- Uses 3-tier token management: **memory cache → DO SQLite → D1 database**
  - Tier 1 (memory cache): zero-cost, valid for a single DO lifecycle
  - Tier 2 (DO SQLite): survives hibernation; populated by `setTokens()`
  - Tier 3 (D1 `accounts` table): authoritative source written by Better Auth on sign-in; used when the DO has no token row (e.g. after eviction with no prior `setTokens` call). A D1 hit backfills tiers 1 & 2 via `setTokens()` so subsequent calls are served from cache. Implemented in the private `#readTokensFromD1()` method.
- Entity caching for GitHub org repos/teams via `CacheManager` (DO SQLite-backed, 15-minute TTL, write-through on mutations)
- Background entity sync: `backgroundEntitySync()` is triggered fire-and-forget from the auth hook on login; warms the cache for all the user's orgs and self-reschedules every 20 minutes for the 8-hour session duration. Available to Standard, Unlimited, and admin users only — free-tier users are excluded. `warmCache()` fetches repos + teams via the GitHub DAL and writes them through `CacheManager`.
- Usage tracking: per-session tool count, `usage_stats` DO SQLite table, subscription tier limit enforcement, Analytics Engine telemetry
- Implements TTL cleanup via Agent framework scheduling
- 28-day inactivity cleanup: `scheduleInactivityCleanup()` resets on every login; `checkInactivityCleanup` fires after 28 days and destroys data only for free-tier non-admin users
- `deleteAllData()`: wipes all DO SQLite tables, KV storage, and chat history; used by `afterDelete` auth hook and inactivity cleanup
- D1 tokens are encrypted at rest with AES-256-GCM (`server/lib/crypto.ts`); `#readTokensFromD1()` decrypts transparently
- Exposes `@callable()` RPC methods (e.g. `getStatus`, `setTokens`, `getPreference`, `deleteAllData`, `scheduleInactivityCleanup`, `backgroundEntitySync`)

**`GitHubAgentEvents`** (keyed by user ID) — extends `DurableIteratorObject`:
- Handles oRPC DurableIterator WebSocket connections separately from AI chat
- Enables real-time event streaming and automatic client reconnection
- Signed with `AUTH_SECRET` to prevent unauthorized subscriptions
- WebSocket upgrade requests routed to it via `server/orpc/durable-iterator.ts` at `/api/orpc/durable-iterator`

**`PromptTemplateDO`** (one instance per GitHub user ID) — standalone Durable Object:
- Stores user-created prompt templates and execution history in DO SQLite
- Two tables: `prompt_templates` (id, name, description, tags, steps, step_count, created_at, updated_at) and `prompt_template_runs` (id, template_id, status, inputs, started_at, completed_at, step_results)
- Exposes `@callable()` RPC methods: `listTemplates`, `getTemplate`, `saveTemplate`, `deleteTemplate`, `recordRun`, `listRuns`
- Per-user isolation via `idFromName(userId)` — no userId column needed in tables
- `getPromptTemplateDOStub(env, userId)` returns a `DurableObjectStub<PromptTemplateDO>`

**`GitHubMcpAgent`** (one instance per MCP session) — extends `McpAgent`:
- Serves MCP clients (Claude Code, Cursor, Windsurf, etc.) via Streamable HTTP transport
- Registers all 81 GitHub administration tools via `registerMcpTools()` from `server/agent/tools/mcp-adapter.ts`
- Uses the shared tool definitions from `server/agent/tools/definitions.ts` — same execute logic as web chat
- Destructive tools use a `confirmed` parameter pattern: first call returns a confirmation prompt, second call with `confirmed: true` executes
- GitHub token and subscription tier passed in via `props` from the OAuth handler
- Usage enforcement: tracks tool calls per session, enforces subscription tier limits
- Registered in `wrangler.jsonc` with DO SQLite migration tag `v3`

**`getGitHubAgentStub(env, userId)`** (`server/durable-objects/github-agent-stub.ts`):
- Async factory — returns `Promise<DurableObjectStub<GitHubAgent>>`. Uses `getByName()` + `await setName()` to initialize the partyserver identity
- All callers must `await` the stub before invoking RPC methods
- Used by the auth hook (on sign-in token push), the preferences DAL, and any future server code needing to call into a `GitHubAgent`

**DO `.name` constraint:** Durable Objects do not know their own name from within ([docs](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)). The `partyserver` base class (used by the Agents SDK) stores the name in a private `#_name` field, set via `setName()` or `routePartykitRequest()`. **Never read `this.name` in a DO constructor** — it will throw. Defer to a lazy getter or `onStart()`.

### AI Chat & json-render

The chat interface is built with `@cloudflare/ai-chat/react` (`useAgent`, `useAgentChat`) and renders AI-generated structured UIs via `@json-render/react`.

**Server-side streaming pipeline (`server/durable-objects/github-agent.ts`):**
1. `streamText` produces a UI message stream with 81 AI tools (contracts in `server/agent/tools/contracts.ts`, implementations in `server/agent/tools/index.ts`)
2. `pipeJsonRender(result.toUIMessageStream())` intercepts the stream via `createJsonRenderTransform` — any line inside a ` ```spec ``` ` fence is parsed as an RFC 6902 JSON Patch and emitted as a `data-spec` part; surrounding text flows through as text parts
3. `createUIMessageStreamResponse` wraps the transformed stream as SSE, returned from `onChatMessage`

**System prompt (`packages/shared/prompts.ts`):**
- `BASE_SYSTEM_PROMPT` — core agent identity, 3-D methodology, tool-first directive, security boundaries (shared by web and MCP)
- `WEB_OUTPUT_PROMPT` — json-render Table output formatting (web chat only)
- `MCP_OUTPUT_PROMPT` — markdown table output formatting (MCP only)
- `getSystemPrompt()` composes `BASE_SYSTEM_PROMPT` + `WEB_OUTPUT_PROMPT` + `explorerCatalog.prompt()` — use for web chat
- `getMcpSystemPrompt()` composes `BASE_SYSTEM_PROMPT` + `MCP_OUTPUT_PROMPT` — use for MCP server
- `SYSTEM_PROMPT` is a backward-compatible alias = `BASE_SYSTEM_PROMPT` + `WEB_OUTPUT_PROMPT`
- Always call `getSystemPrompt()` for web or `getMcpSystemPrompt()` for MCP — never construct the system prompt inline

**Tool confirmation (`packages/shared/config/tool-approval.ts` + `clients/web/components/ui/chat/interface.tsx`):**
- `TOOLS_REQUIRING_APPROVAL` lists destructive tools (delete, create, update repos; modify teams/users; copy access; manage rulesets)
- `applyApprovalPolicy()` sets `needsApproval: true` on tools in the approval list
- Client renders Approve/Deny buttons for tools in `approval-requested` state via AI Elements `Confirmation` components
- Read-only tools (list, get) auto-approve; destructive tools pause for user confirmation

**Client-side rendering (`clients/web/components/ui/chat/interface.tsx`):**
- `MessageParts` calls `useJsonRenderMessage` to aggregate all text parts into one string and assemble the spec from `data-spec` parts
- A single `<MessageResponse>` renders the combined text (via `ReactMarkdown`)
- `<ExplorerRenderer spec={spec}>` renders the json-render spec as React components
- Usage stats display: shows current session tool count and subscription tier limits

**Catalog & prompt (`packages/shared/json-render/catalog.ts` + `packages/shared/prompts.ts`):**
- `explorerCatalog` registers all `@json-render/shadcn` components plus custom ones (Table, Metric, charts, etc.)
- `explorerCatalog.prompt({ mode: 'chat', customRules: [...] })` generates the system prompt fragment instructing the LLM on output format, `repeat` + `$item` for lists, state management, and Table usage for GitHub data
- **Always use `mode: 'chat'`** — this tells the LLM to wrap JSONL in ` ```spec ``` ` fences; `mode: 'generate'` (the default) produces raw JSONL-only output which is not appropriate for a conversational agent
- The centralized `getSystemPrompt()` in `shared/prompts.ts` composes the full system prompt — use this instead of constructing prompts inline

**Component registry (`clients/web/json-render/registry.tsx`):**
- `defineRegistry(explorerCatalog, { components: { ... } })` maps component type names to React implementations
- All `@json-render/shadcn` components are registered via `shadcnComponents.*`
- Custom components (Table with sorting, charts, Metric, etc.) are registered inline

**json-render rules:**
- `repeat: { statePath: "/path", key: "field" }` is a top-level element field (sibling of `type`/`props`/`children`) — NOT inside `props`
- `{ "$item": "field" }` only resolves inside the children of a `repeat` element
- `{ "$state": "/path" }` reads from state; `{ "$bindState": "/path" }` is two-way (use on form inputs)
- For lists of GitHub data, always use the **Table** component with `data: { "$state": "/arrayPath" }` and `columns: [{ key, label }]`

### SSR Rules for Browser-Only Components

`useAgent` and `useAgentChat` (from `@cloudflare/ai-chat/react`) call `defaultGetInitialMessagesFetch` on mount, which makes a network request to the Cloudflare Agent endpoint. This **cannot run during SSR**.

Rules:
- Any route that renders `ChatInterface` directly must have `ssr: false` in its `createFileRoute` options
- Any layout component (e.g. `AiDrawer`) that contains `ChatInterface` must **lazy-mount** it — only render `ChatInterface` after the component has been opened/activated client-side (use a `useRef` flag set in `useEffect`)
- Do NOT use a `mounted` state pattern on the route page if the component is also present in a parent layout — fix the layout component instead

### Authentication Flow

1. GitHub OAuth via Better Auth with PKCE
2. Session: 8-hour expiration, 1-hour auto-refresh
3. On sign-in: GitHub access token pushed to user's GitHubAgent DO
4. Route protection enforced server-side via TanStack Start middleware

## Code Conventions

### Imports
Always use path aliases — never cross-directory relative imports (`../`):
```typescript
import { something } from '@/web/components/foo'
import { bar } from '@/server/auth'
import { baz } from '@/shared/config'
```
Same-directory sibling imports (`./sibling`) are acceptable within tightly-coupled modules (e.g. within `server/data-access-layer/github/`). Import order: external libraries → internal `@/` aliases → same-directory siblings.

### TypeScript
- Strict mode throughout — all code must be fully typed
- Zod v4 for all input validation at system boundaries
- camelCase for variables/functions, PascalCase for components/types

### Zod v4
- **Always use two-arg `z.record(z.string(), valueSchema)`** — never `z.record(valueSchema)`. In Zod v4 the single-arg form sets the *key* type, leaving the value type undefined. This causes `Cannot read properties of undefined (reading '_zod')` when the AI SDK converts tool schemas to JSON Schema.

### Logging
- Use `createLogger` from `@/shared/logger` — **never use `console.log/error/warn` directly**
- Create a module-level logger: `const logger = createLogger({ module: 'myModule' })`
- Use `.child({ userId })` for request-scoped context
- Structured data first, message second: `logger.info({ tool, durationMs }, 'tool executed')`
- Use `{ err }` (not `{ error }`) for error objects — pino serializes `err` specially
- See `docs/observability.md` for full patterns and file inventory

### Comments
- **No change comments** (e.g., "// added this", "// updated to use X")
- Doc comments and parameter descriptions are encouraged

### Testing
- Do not create new unit tests unless explicitly asked
- All tests live under `__tests__/`, mirroring the source directory structure
- Use **Vitest** exclusively; prefer built-in utilities like `vi.stubEnv` over manual mocks
- Use **nock** to intercept and mock GitHub API (and other HTTP) requests — no real network calls in tests
- `__tests__/setup.ts` handles shared setup: enabling/disabling nock, clearing mocks between tests, etc.
- **All new DAL functions must have unit tests** in `__tests__/server/data-access-layer/`, covering success paths, error paths, and auth guards where applicable

### Verification Loop

IMPORTANT: After implementing any code changes, YOU MUST use `/implement-and-verify` to complete the full verification loop. Do not stop after implementation — iterate until all checks pass.

**Primary:** Use `/implement-and-verify <task>` — the authoritative end-to-end workflow for this project. It enforces the full loop: typecheck → test → lint → build → browser E2E → docs → commit → PR → CI feedback. Works identically for local and cloud Claude Code sessions.

**Quick in-session checks** (when already inside an implement-and-verify run, or for trivial one-liners):
```bash
pnpm typecheck              # Fix type errors first
pnpm test:run               # Then fix test failures
pnpm lint                   # Then fix lint issues
pnpm check                  # Full build + wrangler dry-run
```

Use the `$GH_TEST_ORG` GitHub org for any destructive E2E testing, and clean up test resources with the `gh` CLI when done.

### Custom Skills

Project-specific skills are in `.claude/skills/`:
- `/implement-and-verify <task>` — **Primary validation skill.** Full end-to-end: implement → typecheck → test → lint → build → browser E2E → docs → commit → PR → CI. Use for all feature work and fixes — local and cloud sessions.
- `/fix-issue <number>` — Fetch issue context from GitHub, then delegates to `/implement-and-verify`
- `/add-dal-function <name>` — Scaffold a DAL function with `GitHubResult<T>` and tests; delegates final verification to `/implement-and-verify`
- `/add-tool <name>` — Scaffold an AI tool across contracts, definitions, and adapters; delegates final verification to `/implement-and-verify`

## Configuration Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Workspace package declarations (`clients/*`, `packages/*`, `server`) |
| `.npmrc` | pnpm config (`shamefully-hoist=true` for single-bundle build) |
| `wrangler.jsonc` | Cloudflare Workers: D1, Durable Objects, KV, R2, env bindings |
| `drizzle.config.ts` | ORM config for D1 migrations |
| `vite.config.ts` | Build config with Cloudflare + TanStack Start plugins |
| `tsconfig.base.json` | Shared TS compiler options + path aliases (extended by all configs) |
| `tsconfig.json` | Root composite TS config with project references |
| `tsconfig.web.json` | Web client TS config (JSX, DOM libs) |
| `tsconfig.server.json` | Server + shared + MCP TS config (ESNext, decorators) |
| `tsconfig.node.json` | Build tooling TS config (vite.config.ts) |
| `biome.jsonc` | Linting and formatting (replaces ESLint + Prettier) |
| `components.json` | Shadcn/ui component generation config |
| `.dev.vars` | Local secrets (GitHub OAuth, OpenAI, Stripe, Cloudflare IDs) |

## Environment Variables

Secrets live in `.dev.vars` (local), `.dev.vars.dev`, `.dev.vars.prod`. Key variables:
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth app
- `AUTH_SECRET`, `COOKIE_ENCRYPTION_KEY` — Better Auth secrets
- `OPENAI_API_KEY` — AI model access
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Billing
- `CLOUDFLARE_D1_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` — D1 access
- `SUBSCRIPTION_LIMITS_FREE` / `_STANDARD` / `_UNLIMITED` — Usage caps
- `GH_TEST_ORG` — GitHub org for destructive E2E testing

## Cloud Session Setup

Cloud sessions (Claude Code on the web) require environment configuration for the dev server and browser E2E testing. See `docs/claude-code-best-practices.md` Section 4 for full setup instructions.

**Quick summary:**
1. **Environment variables**: Add all `.dev.vars` secrets + `GH_TOKEN` + `GH_TEST_USERNAME`/`GH_TEST_PASSWORD` + `GH_TEST_MFA_SECRET` (TOTP base32 secret for 2FA) in the Claude Code web UI (Settings → Environment → Environment variables)
2. **Setup script**: Install `gh` CLI and `agent-browser` in the cloud environment setup script
3. **SessionStart hook**: `.claude/hooks/setup-cloud-session.sh` loads secrets into `CLAUDE_ENV_FILE` automatically
4. **Browser auth**: `.claude/hooks/browser-github-auth.sh` automates the GitHub OAuth flow headlessly (including 2FA via TOTP), saving state for reuse
5. **Test org**: `GH_TEST_ORG` env var specifies the GitHub org for destructive E2E testing; clean up with `gh` CLI

## Documentation Maintenance

**Keep `CLAUDE.md` and `docs/` in sync with the code.** After any change that affects architecture, APIs, data flows, or documented behavior, update the relevant files before committing:

| Changed area | Files to update |
|---|---|
| Durable Object methods / token management | `CLAUDE.md` (Durable Objects section), `docs/architecture.md` |
| oRPC procedures / middleware | `CLAUDE.md` (Server APIs section), `docs/client-orpc-dal-durable-object.md` |
| Auth flow | `CLAUDE.md` (Authentication Flow), `docs/architecture.md` |
| Request routing (`server/index.ts`) | `docs/architecture.md` (Request Routing) |
| DAL functions | `CLAUDE.md` (Data Access Layer section), `docs/client-orpc-dal-durable-object.md` |
| Error handling convention (`GitHubResult<T>`, `unwrapResult`) | `CLAUDE.md` (Data Access Layer section), `docs/error-handling.md` |
| New top-level directories or key files | `CLAUDE.md` (Key Directories), `docs/architecture.md` |
| json-render catalog / registry / prompt | `CLAUDE.md` (AI Chat & json-render), `docs/architecture.md` (AI Chat Flow) |
| Chat interface / SSR rules | `CLAUDE.md` (SSR Rules for Browser-Only Components), `docs/architecture.md` |
| Logging / observability / health checks | `CLAUDE.md` (Logging section), `docs/observability.md` |
| Prompt templates (DO, DAL, routes, UI) | `CLAUDE.md` (Key Directories, Durable Objects), `docs/custom-prompt-templates.md` |
| CLI commands / auth / architecture | `CLAUDE.md` (Key Directories, Stack), `docs/cli.md` |
| MCP server / OAuth / tool adapter | `CLAUDE.md` (Durable Objects, AI Chat sections), `docs/architecture.md` |
| Webhook automation (rules, handler) | `CLAUDE.md` (Stack, Key Directories), `docs/architecture.md` |
| Organization billing / seats | `CLAUDE.md` (Stack), `docs/architecture.md` |
| Security headers / CORS | `CLAUDE.md` (Stack), `docs/architecture.md` |
| New AI tools (PR, Actions, Security, Insights) | `CLAUDE.md` (Key Directories, tool count), `docs/ai-tools.md` |

A Claude hook (`.claude/hooks/docs-update-reminder.sh`) fires after every source-file edit and outputs a reminder if the affected file is in `server/`, `clients/`, or `packages/shared/`. Do not skip or suppress these reminders.

## E2E Validation with agent-browser

**Only run E2E browser validation when the user explicitly asks for it** (e.g., "test this in the browser", "validate E2E", "run browser tests"). Do not proactively launch browser tests after code changes.

When requested, use `pnpm browser` (which runs `agent-browser`) to validate the app against the local dev server (`http://localhost:8787/`). The dev server must be running (`pnpm dev`).

**Workflow:**
1. Ensure the dev server is running: `lsof -i :8787` to check, or start with `pnpm dev` in the background
2. Navigate: `pnpm browser open http://localhost:8787/`
3. Wait for page: `pnpm browser wait --load networkidle`
4. Take screenshots: `pnpm browser screenshot /tmp/screenshot.png` — then read the image with the Read tool to see results
5. Get interactive elements: `pnpm browser snapshot -i` — returns refs like `@e1`, `@e2`
6. Interact: `pnpm browser click @e1`, `pnpm browser fill @e2 "text"`
7. After navigation or DOM changes, always re-snapshot to get fresh refs
8. Close when done: `pnpm browser close`

**Key pages to test:**
- `/` — Login/home page (shows user info if authenticated)
- `/dashboard` — Command center with metric cards and AI Actions
- `/dashboard/chat` — Full-page AI chat (SSR disabled)
- `/dashboard/admin` — Admin analytics (admin-only)

**Testing the AI chat:**
- Use the `$GH_TEST_ORG` GitHub org for testing
- Read-only tools (list repos, list teams) auto-execute
- Destructive tools (create/delete repos, modify teams) show Approve/Deny confirmation UI
- Wait 10-15 seconds for AI responses (the 53-tool set can be slow)
