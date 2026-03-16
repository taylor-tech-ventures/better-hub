# Remaining Work — Todo Index

Last updated: 2026-03-15

## Overview

This directory tracks intentionally deferred post-launch features. All P1 and P2 work streams are complete; what remains is post-launch polish and growth work.

## Active Work Streams

| # | File | Priority | Description |
|---|------|----------|-------------|
| 05 | [Post-Launch Features](./05-post-launch.md) | P3 | Deferred features for after launch |

## What's Been Completed

### Core Features (documented in `docs/`)

| Feature | Documentation |
|---------|--------------|
| 81 AI tools (contracts, definitions, MCP + web adapters) | [`docs/ai-tools.md`](../ai-tools.md) |
| MCP server (OAuth, 81 tools, Streamable HTTP) | [`docs/architecture.md`](../architecture.md) |
| Tool confirmation system (web UI + MCP `confirmed` param) | [`docs/tool-confirmation.md`](../tool-confirmation.md) |
| Entity caching (repos, teams, 15-min TTL) | [`docs/entity-caching.md`](../entity-caching.md) |
| Background entity sync for paid users | [`docs/entity-sync-paid-users.md`](../entity-sync-paid-users.md) |
| System prompt & 3-D methodology | [`docs/system-prompt.md`](../system-prompt.md) |
| Usage tracking & billing enforcement | [`docs/usage-tracking.md`](../usage-tracking.md) |
| Billing & subscription management | [`docs/billing.md`](../billing.md) |
| GDPR compliance & data lifecycle | [`docs/gdpr-data-lifecycle.md`](../gdpr-data-lifecycle.md) |
| Audit trail & tool execution logging | [`docs/audit-logging.md`](../audit-logging.md) |
| QA audit (security, optimization, traceability) | [`docs/qa-audit-results.md`](../qa-audit-results.md) |
| Error handling (GitHubResult, unwrapResult, retry) | [`docs/error-handling.md`](../error-handling.md) |
| Dashboard & settings UI | [`docs/dashboard-settings-ui.md`](../dashboard-settings-ui.md) |
| Observability & health checks | [`docs/observability.md`](../observability.md) |
| Security hardening (headers, CORS, CSP) | [`docs/04-security-hardening.md`](../04-security-hardening.md) |
| Custom prompt templates | [`docs/custom-prompt-templates.md`](../custom-prompt-templates.md) |
| CLI (oclif, Device Flow, WebSocket chat) | [`docs/cli.md`](../cli.md) |
| Advanced analytics dashboard | [`docs/advanced-analytics-dashboard.md`](../advanced-analytics-dashboard.md) |
| Cookie consent (GDPR banner) | [`docs/cookie-consent.md`](../cookie-consent.md) |

### Also Complete (documented in `CLAUDE.md`)
- Auth & session management (GitHub OAuth, Better Auth, PKCE, 8-hour sessions)
- Core architecture (Workers, DOs, D1, oRPC, TanStack Start, pnpm monorepo)
- 3-tier token management with AES-256-GCM encryption
- Chat UI with AI Elements + json-render streaming
- Stripe configuration (plans, plugin, webhooks, org billing)
- Database schema (users, sessions, accounts, subscriptions, admin_actions, scheduled_tasks, webhook_automation)
- Theme/preferences system (DO-backed, SSR-seeded)
- Admin action workflow (Cloudflare Workflows with `step.waitForEvent`)
- Scheduled tasks (PR merges, releases, workflow dispatches)
- Admin analytics dashboard (AE-backed, KV-cached)
- Webhook automation engine (event-driven rules and actions)
