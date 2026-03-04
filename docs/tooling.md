# Tooling Reference

A consolidated reference for every framework, library, and development tool used in Better Hub.

---

## Runtime & Package Management

| Tool | Version | Role |
|------|---------|------|
| **Bun** | 1.3.5 | JavaScript runtime, package manager, task runner |
| **Node.js** | 22+ | Minimum runtime requirement (used by some tooling) |
| **pnpm** | (via bun lockfile) | Lock-file compatibility |

Bun workspaces are declared in the root `package.json`:

```jsonc
{
  "workspaces": ["apps/*", "packages/*"]
}
```

---

## Frontend

| Tool | Version | Role |
|------|---------|------|
| **Next.js** | 16.1.6 | Full-stack framework (App Router, RSC, API Routes) |
| **React** | 19.2.4 | UI library |
| **TypeScript** | 5.7.0 | Static typing |
| **Tailwind CSS** | 4 | Utility-first styling |
| **PostCSS** | — | Tailwind transformation pipeline |
| **Radix UI** | various | Accessible, unstyled UI primitives |
| **Lucide React** | — | Icon set |
| **TanStack Query** | v5 | Server-state caching and async UI |
| **nuqs** | — | URL search-param state management |
| **Zustand** | — | Lightweight client state (via React Context pattern) |
| **TipTap** | 3.19 | Rich-text / Markdown editor for comments |
| **react-markdown** | — | Markdown rendering with remark/rehype plugins |
| **Shiki** | 3.22 | Syntax highlighting (server + client) |

---

## Backend / API

| Tool | Version | Role |
|------|---------|------|
| **Better Auth** | 1.5.1 | Authentication (OAuth, session, admin, Stripe plugin) |
| **Octokit** | 22.0.1 | Official GitHub REST + GraphQL API client |
| **Vercel AI SDK** | 6.0.97 | LLM streaming, tool-calling orchestration |
| **Inngest** | 3.52.3 | Durable background jobs and event-driven workflows |
| **E2B** | 2.12.1 | Sandboxed code execution for AI tools |
| **Stripe** | 20.4.0 | Billing, subscriptions, webhooks |
| **Zod** | — | Schema validation for API inputs and AI tool parameters |
| **@vercel/functions** | — | `waitUntil` for non-blocking post-response work |

---

## AI & Machine Learning

| Tool | Version | Role |
|------|---------|------|
| **OpenRouter** | (via `@openrouter/ai-sdk-provider`) | LLM gateway; routes to many models |
| **Anthropic SDK** | 3.0.44 | Direct Claude model access |
| **Mixedbread AI SDK** | 2.2.11 | Text embeddings for semantic search |
| **Supermemory** | 4.11.1 | Cross-session conversation memory persistence |

Default models (configurable via `.env`):

```
GHOST_MODEL=moonshotai/kimi-k2.5      # Default chat model
GHOST_MERGE_MODEL=google/gemini-2.5-pro-preview  # Merge-conflict resolution
```

---

## Database & Storage

| Tool | Version | Role |
|------|---------|------|
| **PostgreSQL** | 16 | Primary relational database |
| **Prisma** | 7.4.1 | ORM — schema, migrations, generated client |
| **Upstash Redis** | — | ETag cache, sync-job deduplication |
| **@upstash/redis** | — | HTTP client for Upstash Redis |
| **AWS SDK v3** | — | S3 file uploads |
| **Cloudflare R2** | — | Alternative S3-compatible storage |

Local development uses Docker Compose:

```yaml
# docker-compose.yml
services:
  postgres:    # PostgreSQL 16-alpine on port 54320
  redis:       # Redis 7-alpine (in-memory)
  redis-http:  # serverless-redis-http on port 8079
```

---

## Monitoring & Observability

| Tool | Version | Role |
|------|---------|------|
| **Sentry** | 10 | Error tracking, performance monitoring |
| **Vercel Analytics** | 1.6.1 | Web vitals, visitor analytics |

Sentry is configured in `next.config.ts` via `withSentryConfig`.

---

## Development Tools

| Tool | Version | Role |
|------|---------|------|
| **oxlint** | 1.43.0 | Fast JavaScript/TypeScript linter |
| **oxfmt** | 0.34.0 | Opinionated formatter (Rust-based) |
| **lint-staged** | 16.2.7 | Run linter/formatter on staged files before commit |
| **simple-git-hooks** | — | Lightweight Git hook manager |

### Common Commands

Run all commands from the repo root:

```bash
bun dev          # Start all apps in watch mode
bun build        # Production build
bun lint         # Run oxlint
bun lint:fix     # Auto-fix lint issues
bun fmt          # Format with oxfmt
bun fmt:check    # Check formatting without modifying files
bun typecheck    # Run tsc --noEmit
bun check        # lint + fmt:check + typecheck (run before every PR)
```

### Database Commands

```bash
cd apps/web

# Apply migrations in development
npx prisma migrate dev

# Generate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (GUI)
npx prisma studio
```

---

## Browser Extensions

| Tool | Role |
|------|------|
| **Manifest v3** | Extension API version (Chrome + Firefox) |
| **Declarative Net Request** | Redirect rules without background script network interception |

The extensions have no build step — they load raw JSON/JS files directly.

---

## CI / CD

GitHub Actions workflows live in `.github/workflows/`. Deployments target **Vercel** (configured via the Vercel GitHub integration). The `bun check` command acts as the gate for all pull requests.
