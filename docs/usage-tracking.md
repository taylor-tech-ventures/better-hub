# Usage Tracking & Billing Enforcement

Tool execution usage is tracked per-user with subscription tier limits enforced before each tool execution.

## Architecture

### Server-Side Tracking

| Component | Location | Purpose |
|-----------|----------|---------|
| `#sessionToolCount` | `GitHubAgent` DO | Per-session tool counter (in-memory) |
| `usage_stats` table | DO SQLite | Persistent monthly usage data |
| `calculateUsageStats()` | `GitHubAgent` DO | Aggregates monthly usage for display |
| `checkUsageLimit()` | `GitHubAgent` DO | Enforces subscription tier limits before tool execution |
| `#recordToolExecutions()` | `GitHubAgent` DO | Writes events to Analytics Engine |
| Analytics Engine | `GH_AGENT_TOOL_CALLS` dataset | Aggregate metrics for admin analytics |

### Subscription Tiers

| Tier | Monthly Tool Limit | Configured In |
|------|-------------------|---------------|
| Free | 50 | `shared/config/subscription-limits.ts` |
| Standard | 500 | `shared/config/subscription-limits.ts` |
| Unlimited | No limit | `shared/config/subscription-limits.ts` |

### Client-Side Display

- **Chat UI:** Session tool count and tier limits displayed in the chat interface
- **Dashboard:** AI Usage card on the command center shows monthly usage
- **Billing page:** `/dashboard/billing` shows usage stats with progress bar
- **Analytics page:** `/dashboard/analytics` shows personal usage trends over time

### Admin Analytics

The admin dashboard (`/dashboard/admin`) queries Analytics Engine and D1 for:
- Top tools by usage (bar chart)
- Plan distribution across users (pie chart)
- Power users by tool execution count
- Month-over-month navigation

**Key files:**
- `server/functions/admin-analytics.ts` — server function querying AE + D1
- `server/data-access-layer/admin-analytics.ts` — DAL for D1 queries (`getPlanDistribution`, `getUserProfiles`)
- `server/lib/analytics-engine.ts` — AE query helper

### Usage Stats oRPC Procedure

```
usage.get → getUserUsageStats(env, userId) → stub.calculateUsageStats()
```

Returns: `{ monthly, session, limit, tier, resetDate, isUnlimited }`

## Key Files

| File | Purpose |
|------|---------|
| `server/durable-objects/github-agent.ts` | Usage counting, limit checks, AE writes |
| `server/data-access-layer/usage.ts` | `getUserUsageStats()` DAL function |
| `server/orpc/routes/usage.ts` | `usage.get` oRPC procedure |
| `shared/config/subscription-limits.ts` | Tier limit definitions |
| `shared/config/pricing.ts` | Plan pricing definitions |
| `server/lib/analytics-engine.ts` | AE query utility |
| `client/routes/dashboard/analytics.tsx` | User analytics page |
| `client/routes/dashboard/admin.tsx` | Admin analytics dashboard |

## Design Decisions

- **DO SQLite for monthly counts:** Simpler and more reliable than querying Analytics Engine for usage limits. AE is used for historical analytics.
- **Analytics Engine for metrics:** High-volume, append-only event store — ideal for tool call tracking without D1 write contention
- **`checkUsageLimit()` never throws:** If usage can't be determined (e.g., AE unreachable), defaults to allowing the request rather than blocking the user
- **Subscription tier cached in DO:** Pushed on login via auth hook, similar to token management
