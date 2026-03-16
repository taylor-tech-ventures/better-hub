# Error Handling & Resilience

Structured error handling patterns for production-ready GitHub API interactions.

## Octokit Retry Policy

Configured in `server/data-access-layer/github/client.ts` via `@octokit/plugin-retry`:

| Condition | Behavior |
|-----------|----------|
| 5xx server errors | Retry up to 3 times with exponential backoff |
| Network failures | Retry up to 3 times with exponential backoff |
| 429 Rate Limited | Retry once after the server-specified `Retry-After` delay |
| 4xx client errors (400, 401, 403, 404, 422, 451) | No retry — these indicate real problems that retrying cannot fix |

The `retry: { retries: 3 }` option is set explicitly to document the policy; this matches the plugin default.

## DAL Error Convention: `GitHubResult<T>`

All GitHub DAL functions return `GitHubResult<T>` — a discriminated union on `success`:

```typescript
type GitHubResult<T> =
  | { success: true; data: T }
  | { success: false; error: GitHubError };

type GitHubError = {
  code: GitHubErrorCode;   // machine-readable
  message: string;         // human-readable
  resetAt?: number;        // Unix ms; only on RATE_LIMITED
};
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `TOKEN_EXPIRED` | 401 | Access token invalid or expired; user must re-authenticate |
| `FORBIDDEN` | 403 | Insufficient GitHub permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request payload rejected by GitHub API |
| `RATE_LIMITED` | 429 | GitHub API rate limit reached; `resetAt` holds reset time |
| `NETWORK_ERROR` | — | Network-level failure (DNS, timeout, etc.) |
| `INTERNAL_ERROR` | 5xx / unknown | Unexpected server or client error |

### Helper Functions

All defined in `server/data-access-layer/github/types.ts`:

```typescript
import { ok, fail, mapStatusToErrorCode, GitHubErrorCode } from '@/server/data-access-layer/github/types';

// Construct a success result:
return ok(data);

// Construct a failure result:
return fail(GitHubErrorCode.NOT_FOUND, 'Repository acme/foo not found');

// With rate limit reset time:
return fail(GitHubErrorCode.RATE_LIMITED, 'Rate limit exceeded', { resetAt: 1720000000000 });

// Map Octokit status code to GitHubErrorCode:
const code = mapStatusToErrorCode(error.status);
```

### Writing a New DAL Function

```typescript
import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  GitHubErrorCode,
  type GitHubResult,
  fail,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export async function myDalFunction({
  accessToken,
  org,
  repo,
}: {
  accessToken: string | undefined;
  org: string;
  repo: string;
}): Promise<GitHubResult<MyResponseType>> {
  if (!accessToken) {
    return fail(GitHubErrorCode.TOKEN_EXPIRED, 'GitHub access token is required. Please re-authenticate.');
  }
  try {
    const octokit = getOctokit(accessToken);
    const data = await octokit.request('GET /repos/{owner}/{repo}', { owner: org, repo });
    return ok(data.data);
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      const resetAt =
        error.status === 429
          ? parseRateLimitReset(error.response?.headers?.['x-ratelimit-reset'] as string | undefined)
          : undefined;
      return fail(code, `Error fetching ${org}/${repo}: ${error.message}`, resetAt !== undefined ? { resetAt } : undefined);
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching ${org}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseRateLimitReset(header: string | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}
```

### Consuming `GitHubResult<T>` in AI Tools

Use `unwrapResult` in `server/agent/tools/index.ts` when calling a DAL function that returns `GitHubResult<T>`:

```typescript
const result = await myDalFunction({ accessToken: await getAccessToken(), org, repo });
const data = unwrapResult(result); // throws with actionable message on failure
```

`unwrapResult` produces AI-friendly error messages:
- **RATE_LIMITED**: "GitHub rate limit reached: ... Resets in 47s (2024-01-01T00:00:47Z)."
- **TOKEN_EXPIRED**: "GitHub authentication required: ... Please sign in again via GitHub OAuth."
- **FORBIDDEN**: "Access denied: ... Check your GitHub permissions."
- **NOT_FOUND**: "Not found: ..."

The AI agent can then relay these messages to the user with actionable next steps.

## Token Refresh & 401 Recovery

Token expiry is handled proactively in `GitHubAgent.getGitHubToken()`:

1. The access token is checked before use; if expired, `refreshAccessToken()` is called inline.
2. If the refresh token is also expired, `getGitHubToken()` returns `undefined`.
3. DAL functions that receive `undefined` return `fail(TOKEN_EXPIRED, ...)`.
4. `unwrapResult` converts this to: *"GitHub authentication required: ... Please sign in again via GitHub OAuth."*

Proactive token refresh is scheduled `REFRESH_BUFFER_MS` (5 minutes) before expiry via the Agents framework scheduler, so inline refresh on tool calls is a last-resort fallback.

## WebSocket Connection Resilience

The Cloudflare Agents framework (`AIChatAgent`) handles WebSocket reconnection automatically:
- Pending tool approvals are part of the persisted message history in DO SQLite and survive reconnection.
- The `useAgentChat` hook on the client side re-establishes the WebSocket connection automatically.
- No additional reconnection logic is required in application code.

## Key Files

| File | Purpose |
|------|---------|
| `server/data-access-layer/github/client.ts` | Octokit factory with explicit retry config |
| `server/data-access-layer/github/types.ts` | `GitHubErrorCode`, `GitHubError`, `GitHubResult<T>`, `ok()`, `fail()`, `mapStatusToErrorCode()` |
| `server/data-access-layer/github/org/get-user-orgs.ts` | Reference implementation using `GitHubResult<T>` |
| `server/agent/tools/index.ts` | `unwrapResult()` for consuming `GitHubResult<T>` in AI tools |
