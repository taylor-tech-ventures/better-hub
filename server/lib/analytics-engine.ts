import { env } from 'cloudflare:workers';

/** KV cache TTL for Analytics Engine queries (5 minutes). */
const AE_CACHE_TTL_SECONDS = 300;

/**
 * Returns the Analytics Engine dataset name based on the current environment.
 * Production traffic is stored in a separate dataset from dev/local.
 */
export function aeDataset(): string {
  return env.ENVIRONMENT === 'prod'
    ? 'gh_admin_tool_calls_prod'
    : 'gh_admin_tool_calls_dev';
}

/**
 * Generates a deterministic cache key from a SQL query string.
 * Uses a simple hash to keep keys short and KV-friendly.
 */
function cacheKey(sql: string): string {
  let hash = 0;
  for (let i = 0; i < sql.length; i++) {
    hash = ((hash << 5) - hash + sql.charCodeAt(i)) | 0;
  }
  return `ae:${hash.toString(36)}`;
}

/**
 * Executes a SQL query against the Cloudflare Analytics Engine SQL HTTP API.
 * Results are cached in KV with a 5-minute TTL to reduce API round-trips.
 *
 * @see https://developers.cloudflare.com/analytics/analytics-engine/sql-api/
 */
export async function queryAnalyticsEngine(
  sql: string,
): Promise<{ data: Record<string, unknown>[] }> {
  const kv = env.ANALYTICS_CACHE;
  const key = cacheKey(sql);

  // Try KV cache first
  const cached = await kv.get(key, 'json');
  if (cached) {
    return cached as { data: Record<string, unknown>[] };
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_ANALYTICS_API_TOKEN;

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: sql,
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Analytics Engine SQL API error ${resp.status}: ${text}`);
  }

  const result = (await resp.json()) as { data: Record<string, unknown>[] };

  // Store in KV with TTL (fire-and-forget — don't block the response)
  void kv.put(key, JSON.stringify(result), {
    expirationTtl: AE_CACHE_TTL_SECONDS,
  });

  return result;
}
