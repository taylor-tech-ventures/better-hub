# Advanced Analytics Dashboard

The admin analytics dashboard (`/dashboard/admin`) provides platform-wide usage insights sourced from Cloudflare Analytics Engine and D1.

## Features

### KPI Cards
- **Tool Executions** — total tool calls across all users for the selected month
- **Total Users** — registered accounts from D1 subscription data
- **Unique Tools Used** — distinct tool types executed in the period

### Monthly Execution Trend
A 12-month bar chart showing total tool executions per calendar month across all users. Helps identify usage growth, seasonal patterns, and the impact of feature launches.

### Most Popular Tools
Horizontal bar chart ranking the top 10 tools by execution count. Filters out internal event types (`autoApproved`, `confirmationRequired`).

### Plan Distribution
Pie chart showing the breakdown of users across subscription tiers (Free, Standard, Unlimited), sourced from D1 join between `users` and `subscriptions`.

### Power Users
Table of the top 20 users by tool execution count, enriched with profile data (name, email, GitHub login, avatar, subscription plan) from D1.

## Data Flow

```
GitHubAgent DO (on tool execution)
  │
  ├─ writeDataPoint() → Analytics Engine
  │     blob1 = userId, blob2 = toolName, double1 = 1
  │
  └─ UPDATE usage_stats (DO SQLite, per-user monthly counter)

Admin Dashboard (on page load)
  │
  ├─ getAdminAnalytics() server function
  │     ├─ queryAnalyticsEngine(top tools)     ─┐
  │     ├─ queryAnalyticsEngine(power users)     ├─ Promise.all (parallel)
  │     ├─ queryAnalyticsEngine(monthly trends)  │
  │     └─ getPlanDistribution(D1)             ─┘
  │
  └─ Enrich power user IDs with D1 profiles via getUserProfiles()
```

## KV Caching (OPT-009)

All Analytics Engine SQL queries are cached in the `ANALYTICS_CACHE` KV namespace with a **5-minute TTL**. This reduces Cloudflare API round-trips for repeated admin dashboard loads.

- **Cache key:** deterministic hash of the SQL query string (prefix `ae:`)
- **Cache miss:** executes the AE SQL HTTP API, stores result in KV (fire-and-forget)
- **Cache hit:** returns directly from KV, skipping the API call
- **TTL:** 300 seconds (5 minutes) via `expirationTtl`

### KV Namespace Configuration

| Environment | Binding | KV ID |
|-------------|---------|-------|
| Local | `ANALYTICS_CACHE` | `analytics-cache-local` |
| Dev | `ANALYTICS_CACHE` | `analytics-cache-dev` |
| Prod | `ANALYTICS_CACHE` | `analytics-cache-prod` |

## Key Files

| File | Purpose |
|------|---------|
| `server/functions/admin-analytics.ts` | Server function: AE queries + D1 enrichment |
| `server/data-access-layer/admin-analytics.ts` | D1 DAL: `getPlanDistribution()`, `getUserProfiles()` |
| `server/lib/analytics-engine.ts` | `queryAnalyticsEngine()` with KV caching, `aeDataset()` |
| `clients/web/routes/dashboard/admin.tsx` | Admin dashboard page (KPI cards, charts, table) |
| `server/functions/user-analytics.ts` | Per-user analytics (separate from admin) |
| `clients/web/routes/dashboard/analytics.tsx` | Per-user "My Usage" page |

## Access Control

- Admin-only: guarded by `session.user.role !== 'admin'` in both the route `beforeLoad` and the server function
- Non-admins are redirected to `/dashboard`

## Month Navigation

The dashboard supports month-over-month navigation via the `?month=YYYY-MM` search parameter. The `MonthNav` component provides prev/next controls. The trend chart always shows the trailing 12 months relative to the selected month.
