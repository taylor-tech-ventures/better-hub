# gh-admin.com

AI-powered GitHub organization administration. Runs on Cloudflare Workers with per-user stateful AI agents.

## What It Does

gh-admin gives GitHub org admins a natural-language interface to manage repos, teams, users, branch protection, rulesets, security, PRs, Actions, and more — across all your organizations at once. The AI agent executes operations via 81 typed tools, presents structured results, and requires explicit confirmation before destructive actions.

**Three ways to use it:**
- **Web app** — chat interface at `gh-admin.com/dashboard`
- **MCP server** — connect from Claude Code, Cursor, Windsurf, or Claude Desktop via `https://gh-admin.com/mcp`
- **CLI** — `gh-admin chat` for terminal-first workflows

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (edge) |
| Frontend | React 19, TanStack Router + Start (SSR), Tailwind CSS v4, Shadcn/ui |
| API | oRPC with TanStack Start adapter |
| Database | Cloudflare D1 (SQLite via Drizzle ORM) + Durable Object SQLite |
| Auth | Better Auth — GitHub OAuth PKCE (web), Device Flow (CLI) |
| AI | OpenAI via Vercel AI SDK, Cloudflare Agents framework |
| AI UI | `@cloudflare/ai-chat` + `@json-render/react` for structured output |
| Billing | Stripe (3 tiers: Free / Standard $19 / Unlimited $49) |
| MCP | `McpAgent` + `@cloudflare/workers-oauth-provider`, Streamable HTTP |
| CLI | oclif-based thin client |

## Monorepo Structure

```
clients/web/        # React web app (@gh-admin/web)
clients/mcp/        # MCP server (@gh-admin/mcp)
packages/shared/    # Shared types, prompts, logger (@gh-admin/shared)
server/             # Cloudflare Worker core (auth, oRPC, DOs, DAL, tools)
cli/                # oclif CLI client
__tests__/          # Vitest unit tests (mirrors source structure)
docs/               # Architecture and feature documentation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start dev server (Vite + Wrangler)
pnpm dev

# Type-check
pnpm typecheck

# Run tests
pnpm test:run

# Lint
pnpm lint
```

See `CLAUDE.md` for the full command reference and architecture guide.

## Documentation

| Doc | Contents |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Primary architecture reference, conventions, and development guide |
| [`docs/architecture.md`](./docs/architecture.md) | Request routing, Durable Objects, auth flows, AI chat pipeline |
| [`docs/error-handling.md`](./docs/error-handling.md) | `GitHubResult<T>` convention, `unwrapResult`, retry policy |
| [`docs/client-orpc-dal-durable-object.md`](./docs/client-orpc-dal-durable-object.md) | Full request flow: browser → oRPC → DAL → DO |
| [`docs/ai-tools.md`](./docs/ai-tools.md) | 81 AI tool categories and DAL structure |
| [`docs/tool-confirmation.md`](./docs/tool-confirmation.md) | Approval system for destructive tools |
| [`docs/entity-caching.md`](./docs/entity-caching.md) | Per-user DO SQLite caching (repos, teams) |
| [`docs/entity-sync-paid-users.md`](./docs/entity-sync-paid-users.md) | Background entity sync for paid users |
| [`docs/system-prompt.md`](./docs/system-prompt.md) | Agent identity, 3-D methodology, prompt composition |
| [`docs/observability.md`](./docs/observability.md) | Logging patterns, pino, Analytics Engine |
| [`docs/billing.md`](./docs/billing.md) | Stripe plans, usage metering, webhook handling |
| [`docs/usage-tracking.md`](./docs/usage-tracking.md) | Per-user tool count, tier enforcement, UI |
| [`docs/custom-prompt-templates.md`](./docs/custom-prompt-templates.md) | Prompt template builder, run history |
| [`docs/cli.md`](./docs/cli.md) | CLI architecture, auth, commands |
| [`docs/audit-logging.md`](./docs/audit-logging.md) | Tool execution audit trail |
| [`docs/gdpr-data-lifecycle.md`](./docs/gdpr-data-lifecycle.md) | Data export, deletion, 28-day cleanup |
| [`docs/cookie-consent.md`](./docs/cookie-consent.md) | GDPR cookie consent banner |
| [`docs/ai-chat-patch.md`](./docs/ai-chat-patch.md) | `@cloudflare/ai-chat` patch tracking |
| [`docs/claude-code-best-practices.md`](./docs/claude-code-best-practices.md) | Claude Code cloud session setup and E2E testing guide |
| [`docs/strategy/post-mvp-audit-and-recommendations.md`](./docs/strategy/post-mvp-audit-and-recommendations.md) | Post-MVP roadmap and strategic recommendations |

## Key Architecture Points

- **Durable Objects**: `GitHubAgent` (one per user — AI chat, tokens, entity cache), `GitHubAgentEvents` (oRPC streaming), `PromptTemplateDO` (template storage), `GitHubMcpAgent` (one per MCP session)
- **3-tier token management**: in-memory cache → DO SQLite → D1 (with AES-256-GCM encryption at rest)
- **Tool architecture**: shared `definitions.ts` layer consumed by both the AI SDK adapter (web) and MCP adapter — 81 tools, same execute logic across both surfaces
- **json-render**: AI streams RFC 6902 JSON Patches inside ` ```spec ``` ` fences; client assembles and renders as React components
- **GitHubResult\<T\>**: all DAL functions return a discriminated union — never throw directly; `unwrapResult()` in tools produces actionable error messages for the AI
