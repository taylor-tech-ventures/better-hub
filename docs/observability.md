# Observability & Health Checks

Production observability infrastructure for monitoring, logging, and metrics.

---

## Health Check Endpoint

**Endpoint:** `GET /api/orpc?method=health` (public, no auth required)

The health check validates critical dependencies and returns a structured response:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-13T12:00:00.000Z",
  "checks": {
    "d1": { "status": "ok", "latencyMs": 3 },
    "github": { "status": "ok", "latencyMs": 120 }
  }
}
```

- **HTTP 200** when all dependencies are `ok` (status: `"healthy"`)
- **HTTP 200** with `status: "degraded"` when one or more checks fail — the response still includes per-dependency details
- **D1 check:** `SELECT 1` to verify SQLite connectivity
- **GitHub check:** Unauthenticated `GET /rate_limit` to verify API reachability

**Implementation:** `server/orpc/router.ts` — `checkD1()` and `checkGitHub()` run in parallel

---

## Structured Logging with pino

All server-side logging uses [pino](https://github.com/pinojs/pino) for structured JSON output, compatible with `wrangler tail` and Cloudflare Logpush.

### Logger Factory

**File:** `shared/logger.ts`

```typescript
import { createLogger } from '@/shared/logger';

// Module-level logger
const logger = createLogger({ module: 'auth' });

// Child logger with request-scoped context
const log = logger.child({ userId: 'abc123' });
log.info({ tier: 'standard' }, 'subscription tier pushed');
// → {"level":30,"time":"...","module":"auth","userId":"abc123","tier":"standard","msg":"subscription tier pushed"}
```

### Usage Pattern

1. Create a **module-level** logger with `createLogger({ module: 'moduleName' })`
2. Use `.child({ ... })` to add request-scoped fields (e.g. `userId`)
3. Always pass structured data as the first argument, message as the second:
   ```typescript
   logger.info({ tool: 'listRepos', durationMs: 42 }, 'tool execution complete');
   logger.error({ err }, 'token refresh failed');
   logger.warn({ staleTier: 'free' }, 'D1 unreachable, using stale cache');
   ```

### Files Using pino

| File | Logger Context |
|------|----------------|
| `shared/logger.ts` | Factory (`createLogger`) |
| `server/auth/index.ts` | `{ module: 'auth' }` — auth hooks, token push, user deletion |
| `server/durable-objects/github-agent.ts` | `{ module: 'GitHubAgent', userId }` — token management, usage limits, cleanup |
| `server/agent/tools/index.ts` | `{ module: 'tools' }` — cache failures |
| `server/data-access-layer/github/refresh-github-token.ts` | `{ module: 'refreshGitHubToken' }` — token refresh lifecycle |
| `server/workflows/admin-action.ts` | `{ module: 'AdminActionWorkflow' }` — approval workflow steps |
| `server/functions/admin-analytics.ts` | `{ module: 'admin-analytics' }` — AE cache hit/miss |
| `server/orpc/router.ts` | `{ module: 'health' }` — degraded health warnings |
| `server/index.ts` | `{ module: 'server' }` — top-level fetch handler errors |
| `server/functions/billing.ts` | `{ module: 'billing' }` — billing operations |
| `server/data-access-layer/github/fetch-github-user.ts` | `{ module: 'fetchGitHubUser' }` — user profile fetching |
| `server/data-access-layer/github/settings/copy-branch-protection.ts` | `{ module: 'copy-branch-protection' }` — ruleset copy operations |
| `server/data-access-layer/github/settings/copy-general.ts` | `{ module: 'copy-general' }` — general settings copy |
| `server/data-access-layer/github/settings/synchronize-general.ts` | `{ module: 'synchronize-general' }` — general settings sync |
| `shared/prompts.ts` | `{ module: 'prompts' }` — prompt composition |

### Why pino?

- **Performance:** Fastest structured JSON logger in Node.js — critical under Workers CPU time limits
- **Edge-compatible:** pino's browser transport works in Cloudflare Workers without native bindings
- **Well-maintained:** OpenJS Foundation project with 14k+ GitHub stars, weekly releases, LTS
- **Structured JSON by default:** Output is natively compatible with Cloudflare Logpush and `wrangler tail --format=json`
- **Child loggers:** `logger.child({ requestId })` adds correlation context without manual field threading

---

## Analytics Engine Metrics

### Tool Execution Tracking

Each tool execution writes a data point to the `GH_AGENT_TOOL_CALLS` Analytics Engine dataset:

```
blob1 = userId
blob2 = toolName (e.g. "listOrgRepos", "deleteGitHubRepos")
double1 = 1 (_sample_interval)
index1 = userId
```

**Implementation:** `GitHubAgent.#recordToolExecutions()` in `server/durable-objects/github-agent.ts`

### Tool Approval Tracking

Approval/denial decisions for destructive tools are recorded as separate AE data points:

```
blob1 = userId
blob2 = "toolApproval:approved" | "toolApproval:denied"
blob3 = toolName
double1 = 1
index1 = userId
```

**Implementation:** `GitHubAgent.#recordToolApproval()` — called from `onStepFinish` by comparing `toolCalls` vs `toolResults` for tools in `TOOLS_REQUIRING_APPROVAL`

### AE Query Caching

Admin analytics AE queries are cached in-memory with a 5-minute TTL, keyed by `yearMonth` parameter. This prevents redundant API calls when the admin dashboard reloads.

**Implementation:** `server/functions/admin-analytics.ts` — `aeCache` Map with `AE_CACHE_TTL_MS = 5 * 60 * 1_000`

### Example AE SQL Queries

Use these queries in the [Cloudflare Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) or dashboard.

**Top 10 most-used tools (last 24 hours):**
```sql
SELECT blob2 AS tool_name, SUM(_sample_interval) AS total
FROM gh_admin_tool_calls_prod
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND blob2 NOT IN ('autoApproved', 'confirmationRequired')
  AND blob2 NOT LIKE 'toolApproval:%'
GROUP BY tool_name
ORDER BY total DESC
LIMIT 10
```

**Per-user tool call volume (current month):**
```sql
SELECT blob1 AS user_id, SUM(_sample_interval) AS total
FROM gh_admin_tool_calls_prod
WHERE timestamp >= toDateTime('2026-03-01 00:00:00')
  AND timestamp < toDateTime('2026-04-01 00:00:00')
  AND blob2 NOT LIKE 'toolApproval:%'
GROUP BY user_id
ORDER BY total DESC
LIMIT 20
```

**Tool approval rates (current month):**
```sql
SELECT
  blob3 AS tool_name,
  blob2 AS decision,
  SUM(_sample_interval) AS count
FROM gh_admin_tool_calls_prod
WHERE timestamp >= toDateTime('2026-03-01 00:00:00')
  AND timestamp < toDateTime('2026-04-01 00:00:00')
  AND blob2 LIKE 'toolApproval:%'
GROUP BY tool_name, decision
ORDER BY tool_name, decision
```

**Daily tool execution trend (last 7 days):**
```sql
SELECT
  toDate(timestamp) AS day,
  SUM(_sample_interval) AS total
FROM gh_admin_tool_calls_prod
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob2 NOT LIKE 'toolApproval:%'
GROUP BY day
ORDER BY day
```

---

## Design Decisions

### Why Analytics Engine over D1 for metrics?

- AE is purpose-built for high-volume, append-only event data
- D1 is transactional — high-frequency writes would degrade performance
- `admin_actions` in D1 serves a different purpose (audit trail with full payloads)

### Why in-memory cache for AE queries?

- AE queries run against a remote SQL API — not free
- 5-minute TTL balances freshness with API call reduction
- In-memory is sufficient: the admin dashboard is low-traffic, and a Worker restart simply means a cold cache miss
- KV would persist across requests but adds complexity for minimal benefit at current traffic levels
