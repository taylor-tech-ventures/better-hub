# Entity Caching System

GitHub organization data (repos and teams) is cached in per-user DO SQLite via the `CacheManager` class, reducing GitHub API calls and improving response times.

## Architecture

- **Location:** `server/durable-objects/cache-manager.ts`
- **Storage:** DO SQLite tables within each user's `GitHubAgent` Durable Object
- **TTL:** 15-minute freshness threshold
- **Strategy:** Cache-on-first-use (lazy) + write-through on mutations

## What Gets Cached

| Entity | Cache Table | Cache Key Pattern |
|--------|------------|-------------------|
| Org repositories | `entity_cache_repos` | `repos:{org}` |
| Org teams | `entity_cache_teams` | `teams:{org}` |

### What Is NOT Cached

Small, specific results that are fast to fetch directly:
- Teams assigned to a single repo
- Users with access to a single repo
- Individual repo details
- Branch lists, rulesets

## Cache Flow

### Read (Cache-on-First-Use)
1. AI tool calls `listOrgRepos` or `listOrgTeams`
2. `CacheManager` checks DO SQLite for cached data
3. If fresh (< 15 min old): return cached data immediately
4. If stale or missing: fetch from GitHub API → store in cache → return

### Write-Through Updates
When mutation tools execute, the cache is updated immediately:
- `createGitHubRepo` → adds new repo to `entity_cache_repos`
- `deleteGitHubRepos` → removes repos from `entity_cache_repos`
- `updateGitHubRepos` → updates repo metadata in cache

### User-Triggered Refresh
Tools accept a `forceRefresh` parameter to bypass cache. The AI can suggest refreshing when results seem stale. Cache freshness metadata (`cachedAt`, `isFresh`) is included in tool responses.

## Key Files

| File | Purpose |
|------|---------|
| `server/durable-objects/cache-manager.ts` | `CacheManager` class with read/write/invalidate methods |
| `server/durable-objects/github-agent.ts` | Instantiates `CacheManager`, exposes cache via tools |
| `server/agent/tools/index.ts` | Tools call cache methods before/after DAL calls |

## Design Decisions

- **Per-user isolation:** Cache is stored in individual DO SQLite — no cross-user data leakage possible
- **No sensitive data:** Cache stores only entity metadata (names, URLs, descriptions, permissions) — never tokens or secrets
- **Survives hibernation:** DO SQLite persists across hibernation cycles
- **Write-through, not invalidate:** Mutations update the cache in-place rather than invalidating, so subsequent reads remain fast without a GitHub API round-trip
- **Cache errors don't fail tools:** If a cache write fails (e.g., SQLite full), the error is logged and the parent tool execution continues — the cache self-heals on next read
