# Background Entity Sync on Login (Paid Users)

**Status:** Implemented
**Availability:** Standard, Unlimited, and Admin users (not free tier)

---

## Overview

On sign-in, the auth hook triggers a non-blocking background entity cache sync for paid (Standard/Unlimited) and admin users. This proactively populates `CacheManager` with the user's GitHub org repos and teams so the first AI tool call is served from cache rather than making a live GitHub API round-trip.

---

## Behavior

- **Trigger:** Auth hook calls `stub.backgroundEntitySync()` fire-and-forget immediately after tokens, tier, and admin status are pushed to the `GitHubAgent` DO.
- **Gating:** `backgroundEntitySync()` reads `#isAdmin()` and `#getSubscriptionTier()` inside the DO. Free-tier, non-admin users return early with no work done.
- **Cache population:** `warmCache()` fetches all orgs via `GET /user/orgs`, then for each org fetches repos (`GET /orgs/{org}/repos`) and teams (`GET /orgs/{org}/teams`) in parallel and writes them through `CacheManager`.
- **Periodic refresh:** After each sync `warmCache()` checks the `cache_refresh_active_until` preference (set to `now + 8 hours` by `backgroundEntitySync()`). If still within the window it schedules the next `warmCache` call 20 minutes out via `this.schedule()`. The chain stops automatically after 8 hours without requiring a manual cancellation.
- **Non-blocking:** The auth hook uses `.catch()` and does not await the sync. Sign-in latency is unaffected by sync failures.
- **Analytics Engine:** Each sync writes a data point (`blob1=userId`, `blob2='entity_sync'`, `double1=orgCount`) to `GH_AGENT_TOOL_CALLS` for monitoring.

---

## Key Files

| File | Role |
|---|---|
| `server/durable-objects/github-agent.ts` | `warmCache()` and `backgroundEntitySync()` methods |
| `server/auth/index.ts` | Auth hook — fire-and-forget trigger after sign-in |
| `server/durable-objects/cache-manager.ts` | `setCachedOrgRepos` / `setCachedOrgTeams` — cache writes |
| `server/data-access-layer/github/org/get-user-orgs.ts` | Fetches the user's org list |
| `server/data-access-layer/github/org/get-org-repos.ts` | Fetches repos per org |
| `server/data-access-layer/github/org/get-org-teams.ts` | Fetches teams per org |

---

## Constants (in `github-agent.ts`)

| Constant | Value | Purpose |
|---|---|---|
| `PREF_CACHE_REFRESH_UNTIL` | `'cache_refresh_active_until'` | Preference key storing session window end (Unix ms) |
| `CACHE_REFRESH_INTERVAL_MS` | 20 minutes | How often `warmCache` reschedules itself |
| `SESSION_DURATION_MS` | 8 hours | Matches Better Auth session expiry; bounds the refresh window |
