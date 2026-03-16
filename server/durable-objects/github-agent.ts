import { createOpenAI } from '@ai-sdk/openai';
import type { OnChatMessageOptions } from '@cloudflare/ai-chat';
import { AIChatAgent } from '@cloudflare/ai-chat';
import { pipeJsonRender } from '@json-render/core';
import { callable, getCurrentAgent } from 'agents';
import type { StreamTextOnFinishCallback, ToolSet } from 'ai';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from 'ai';
import { buildGitHubTools } from '@/server/agent/tools';
import { getGitHubOrgRepos } from '@/server/data-access-layer/github/org/get-org-repos';
import { getGitHubOrgTeams } from '@/server/data-access-layer/github/org/get-org-teams';
import { getGitHubUserOrgs } from '@/server/data-access-layer/github/org/get-user-orgs';
import refreshGitHubToken, {
  GitHubOAuthError,
} from '@/server/data-access-layer/github/refresh-github-token';
import {
  cancelScheduledTask,
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTasks,
} from '@/server/data-access-layer/scheduling/scheduled-tasks';
import {
  type CachedOrgRepos,
  type CachedOrgTeams,
  type CachedRepoEntry,
  type CachedTeamEntry,
  CacheManager,
  type SqlExecutor,
} from '@/server/durable-objects/cache-manager';
import { decryptToken } from '@/server/lib/crypto';
import type { SubscriptionTier } from '@/shared/config/subscription-limits';
import { getSubscriptionConfig } from '@/shared/config/subscription-limits';
import { toolNeedsApproval } from '@/shared/config/tool-approval';
import { createLogger } from '@/shared/logger';
import { GITHUB_AGENT_MODEL, getSystemPrompt } from '@/shared/prompts';
import { getCliSystemPrompt } from '@/shared/prompts-cli';
import type {
  GitHubAgentState,
  UsageStats,
} from '@/shared/types/github-agent-state';
import type {
  ScheduledTaskStatus,
  ScheduledTaskSummary,
  ToolCallPayload,
} from '@/shared/types/scheduling';

/** Full set of OAuth token data stored in the DO's SQLite database. */
export type GitHubTokenData = {
  accessToken: string;
  /** Unix timestamp in milliseconds when the access token expires. */
  accessTokenExpiresAt: number;
  refreshToken?: string;
  /** Unix timestamp in milliseconds when the refresh token expires. */
  refreshTokenExpiresAt?: number;
};

/** Row shape returned from the `github_tokens` SQLite table. */
type TokenRow = {
  access_token: string;
  access_token_expires_at: number;
  refresh_token: string | null;
  refresh_token_expires_at: number | null;
};

/** Row shape returned from the `usage_stats` SQLite table. */
type UsageStatsRow = {
  monthly_count: number;
  period_start: number;
};

/**
 * How many milliseconds before access-token expiry to trigger a proactive
 * refresh.  Defaults to 5 minutes.
 */
const REFRESH_BUFFER_MS = 5 * 60 * 1_000;

/**
 * Default access-token lifetime in seconds used when GitHub does not include
 * an `expires_in` field in the token response.  Matches GitHub's documented
 * default of 8 hours for GitHub App user tokens.
 */
const DEFAULT_TOKEN_EXPIRY_SECONDS = 28_800;

/** TTL in milliseconds for the cached subscription tier (5 minutes). */
const TIER_CACHE_TTL_MS = 5 * 60 * 1_000;

/** Preference key for cached subscription tier. */
const PREF_SUBSCRIPTION_TIER = 'subscription_tier';

/** Preference key for tier cache expiry (Unix ms timestamp). */
const PREF_TIER_EXPIRES_AT = 'subscription_tier_expires_at';

/** Preference key for cached admin flag ('true' | 'false'). */
const PREF_IS_ADMIN = 'is_admin';

/** TTL in milliseconds for the cached admin flag (1 hour). */
const ADMIN_CACHE_TTL_MS = 60 * 60 * 1_000;

/** Preference key for admin flag cache expiry (Unix ms timestamp). */
const PREF_ADMIN_EXPIRES_AT = 'is_admin_expires_at';

/** Preference key storing the Unix ms timestamp until which periodic cache refresh is active. */
const PREF_CACHE_REFRESH_UNTIL = 'cache_refresh_active_until';

/** How often to re-sync entity caches during an active session (20 minutes). */
const CACHE_REFRESH_INTERVAL_MS = 20 * 60 * 1_000;

/** Mirrors the Better Auth session expiry (8 hours) — sets the periodic refresh window. */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1_000;

/**
 * GitHubAgent is a stateful AI agent Durable Object that extends AIChatAgent
 * to provide AI chat capabilities over WebSocket and typed RPC endpoints via
 * @callable() decorators.
 *
 * Token management uses a 3-tier approach:
 *   1. In-memory cache   – avoids SQL round-trips during a single DO lifecycle.
 *   2. DO SQLite storage – survives Durable Object hibernation.
 *   3. D1 Database       – source of truth written by Better Auth on sign-in.
 *
 * Scheduled refresh is handled by the agents framework scheduling system.
 * A one-time schedule fires REFRESH_BUFFER_MS before the access token expires,
 * calling `refreshAccessToken`, which renews the token (when the refresh token
 * has not yet expired) and reschedules the next renewal.
 *
 * Usage tracking counts tool executions per billing period (calendar month).
 * Monthly counts are stored in DO SQLite and also written to the Analytics
 * Engine dataset for historical reporting. Usage stats are broadcast to
 * connected clients via `setState()` after each tool execution.
 */
export class GitHubAgent extends AIChatAgent<Cloudflare.Env, GitHubAgentState> {
  /** Tier-1 in-memory token cache. Invalidated when new tokens are stored. */
  #tokenCache: GitHubTokenData | null = null;

  /** Number of tool executions in the current chat session (in-memory only). */
  #sessionToolCount = 0;

  /** Whether the current connection is from the CLI client. */
  #isCliClient = false;

  /** Entity cache manager backed by this DO's SQLite storage. */
  readonly #cache: CacheManager;

  /** Structured logger scoped to this agent instance (lazy — `this.name` is not available in the constructor). */
  #log: ReturnType<typeof createLogger> | undefined;

  get log(): ReturnType<typeof createLogger> {
    if (!this.#log) {
      try {
        this.#log = createLogger({ module: 'GitHubAgent', userId: this.name });
      } catch {
        return createLogger({ module: 'GitHubAgent' });
      }
    }
    return this.#log;
  }

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.#cache = new CacheManager(this.sql.bind(this) as SqlExecutor);
    // Block all incoming requests until the SQLite schema is initialised.
    // This guarantees tables exist before any RPC or fetch is dispatched.
    ctx.blockConcurrencyWhile(async () => {
      try {
        this.sql`
          CREATE TABLE IF NOT EXISTS github_tokens (
            id                      INTEGER PRIMARY KEY,
            access_token            TEXT    NOT NULL,
            access_token_expires_at INTEGER NOT NULL,
            refresh_token           TEXT,
            refresh_token_expires_at INTEGER
          )
        `;
        this.sql`
          CREATE TABLE IF NOT EXISTS user_preferences (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `;
        this.sql`
          CREATE TABLE IF NOT EXISTS usage_stats (
            id            INTEGER PRIMARY KEY,
            monthly_count INTEGER NOT NULL DEFAULT 0,
            period_start  INTEGER NOT NULL
          )
        `;
        this.sql`
          CREATE TABLE IF NOT EXISTS query_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            query      TEXT    NOT NULL,
            favorite   INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
          )
        `;
        this.#cache.initSchema();
      } catch (error) {
        this.log.error({ err: error }, 'error during initialization');
      }
    });
  }

  // ── Token management ───────────────────────────────────────────────────

  /**
   * Initialises the GitHub token table on first Durable Object start.
   * Using `onStart` is idempotent — the CREATE IF NOT EXISTS guard means
   * this is safe to call on every wake-up.
   *
   * Also reschedules the access-token refresh after a DO cold-start so
   * that a pending refresh is not lost due to hibernation.
   */
  override async onStart(): Promise<void> {
    // Re-register the scheduled refresh after a cold-start so the alarm is
    // not silently dropped if the DO was hibernated while a refresh was pending.
    const tokens = this.#readTokensFromSql();
    if (tokens) {
      await this.#scheduleTokenRefresh(tokens.accessTokenExpiresAt);
    }
  }

  /**
   * Detect CLI client connections via the `?client=cli` query parameter
   * on the WebSocket upgrade URL. Sets the `#isCliClient` flag so that
   * `onChatMessage` can use a CLI-specific system prompt and skip
   * json-render stream transformation.
   */
  override onConnect(
    connection: import('agents').Connection,
    ctx: import('agents').ConnectionContext,
  ): void {
    try {
      const url = new URL(ctx.request.url);
      this.#isCliClient = url.searchParams.get('client') === 'cli';
      if (this.#isCliClient) {
        this.log.info('CLI client connected');
      }
    } catch {
      // URL parsing failure is non-fatal — default to web client
    }
    super.onConnect(connection, ctx);
  }

  // ── User preferences ───────────────────────────────────────────────────

  /** Retrieve a single preference value by key, or null if not set. */
  async getPreference(key: string): Promise<string | null> {
    const rows = this.sql<{ value: string }>`
      SELECT value FROM user_preferences WHERE key = ${key} LIMIT 1
    `;
    return rows[0]?.value ?? null;
  }

  /** Upsert a preference key/value pair. */
  async setPreference(key: string, value: string): Promise<void> {
    this.sql`
      INSERT OR REPLACE INTO user_preferences (key, value) VALUES (${key}, ${value})
    `;
  }

  /** Return all stored preferences as a plain object. */
  async getPreferences(): Promise<Record<string, string>> {
    const rows = this.sql<{ key: string; value: string }>`
      SELECT key, value FROM user_preferences
    `;
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /**
   * Persist a full set of GitHub OAuth tokens to both the in-memory cache
   * and the Durable Object's SQLite storage, then schedule the next
   * proactive refresh.
   *
   * Exposed as a @callable RPC so the auth hook can push fresh tokens into
   * the DO immediately after the user signs in.
   */
  @callable()
  async setTokens(data: GitHubTokenData): Promise<void> {
    this.sql`
      INSERT OR REPLACE INTO github_tokens (
        id,
        access_token,
        access_token_expires_at,
        refresh_token,
        refresh_token_expires_at
      ) VALUES (
        1,
        ${data.accessToken},
        ${data.accessTokenExpiresAt},
        ${data.refreshToken ?? null},
        ${data.refreshTokenExpiresAt ?? null}
      )
    `;

    // Warm the in-memory cache so the next getGitHubToken() call is free.
    this.#tokenCache = data;

    await this.#scheduleTokenRefresh(data.accessTokenExpiresAt);
  }

  /**
   * Returns a valid GitHub OAuth access token, proactively refreshing it
   * when the stored token has expired.
   *
   * Resolution order:
   *   1. In-memory cache  – avoids SQL round-trips during a single DO lifecycle.
   *   2. DO SQLite        – survives hibernation; populated by `setTokens`.
   *   3. D1 database      – authoritative source written by Better Auth on sign-in;
   *                         used when the DO has no token row (e.g. first request
   *                         after a cold-start with no prior auth hook call).
   *                         Reading from D1 backfills DO SQLite + cache via
   *                         `setTokens` so subsequent calls are served from tier 1.
   *
   * If the resolved token is expired, `refreshAccessToken()` is called inline
   * before returning.  Returns `undefined` only when no token exists at all or
   * when the refresh attempt fails (e.g. refresh token expired — user must
   * re-authenticate).
   */
  async getGitHubToken(): Promise<string | undefined> {
    // Tier 1 + 2: in-memory cache → DO SQLite.
    let tokens = this.#tokenCache ?? this.#readTokensFromSql();

    // Tier 3: D1 database.  Covers the case where the DO was cold-started
    // without a prior `setTokens` call (e.g. the auth hook ran but the DO was
    // evicted before any tool call).  `setTokens` backfills DO SQLite + cache
    // and schedules the proactive refresh.
    if (!tokens) {
      tokens = await this.#readTokensFromD1();
      if (!tokens) return undefined;
      await this.setTokens(tokens);
    }

    if (Date.now() < tokens.accessTokenExpiresAt) {
      return tokens.accessToken;
    }

    this.log.warn('access token expired, refreshing inline');
    await this.refreshAccessToken();

    const refreshed = this.#tokenCache;
    if (!refreshed || Date.now() >= refreshed.accessTokenExpiresAt) {
      this.log.error('inline refresh failed, user must re-authenticate');
      return undefined;
    }

    return refreshed.accessToken;
  }

  /**
   * Scheduled callback invoked by the agents framework when the access token
   * is about to expire.
   *
   * If the refresh token is present and has not yet expired the access token
   * is renewed via GitHub's OAuth token endpoint and the new tokens are
   * persisted.  If the refresh token is missing or expired this method logs a
   * warning and takes no action — the user will need to re-authenticate.
   */
  async refreshAccessToken(): Promise<void> {
    const tokens = this.#readTokensFromSql();
    if (!tokens) {
      this.log.info('refreshAccessToken: no tokens stored, skipping');
      return;
    }

    const { refreshToken, refreshTokenExpiresAt } = tokens;

    if (!refreshToken) {
      this.log.info('refreshAccessToken: no refresh token stored, skipping');
      return;
    }

    if (
      refreshTokenExpiresAt !== undefined &&
      Date.now() >= refreshTokenExpiresAt
    ) {
      this.log.warn('refresh token has expired, forcing sign out');
      await this.#forceSignOut();
      return;
    }

    try {
      this.log.info('refreshing access token');

      const refreshed = await refreshGitHubToken(refreshToken, {
        clientId: this.env.GITHUB_CLIENT_ID,
        clientSecret: this.env.GITHUB_CLIENT_SECRET,
      });

      const newAccessTokenExpiresAt =
        refreshed.expires_at ??
        Date.now() +
          (refreshed.expires_in ?? DEFAULT_TOKEN_EXPIRY_SECONDS) * 1_000;
      const newRefreshToken = refreshed.refresh_token ?? refreshToken;
      const newRefreshTokenExpiresAt =
        refreshed.refresh_token_expires_at ?? refreshTokenExpiresAt;

      // Persist to DO SQLite + in-memory cache and reschedule the next refresh.
      await this.setTokens({
        accessToken: refreshed.access_token,
        accessTokenExpiresAt: newAccessTokenExpiresAt,
        refreshToken: newRefreshToken,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
      });

      // Mirror the refreshed tokens back into the D1 `accounts` table so that
      // D1 remains the consistent source of truth.  The agent `name` is the
      // userId used when the DO was created via `idFromName(userId)`.
      if (this.env.GH_ADMIN_D1_PRIMARY) {
        await this.env.GH_ADMIN_D1_PRIMARY.prepare(
          `UPDATE accounts
           SET access_token              = ?,
               access_token_expires_at   = ?,
               refresh_token             = ?,
               refresh_token_expires_at  = ?
           WHERE user_id = ? AND provider_id = 'github-app'`,
        )
          .bind(
            refreshed.access_token,
            // D1 stores timestamps as Unix seconds; convert from milliseconds.
            Math.floor(newAccessTokenExpiresAt / 1_000),
            newRefreshToken,
            newRefreshTokenExpiresAt != null
              ? Math.floor(newRefreshTokenExpiresAt / 1_000)
              : null,
            this.name,
          )
          .run();

        this.log.info('D1 accounts table updated');
      }

      this.log.info('access token refreshed successfully');
    } catch (err) {
      // A GitHubOAuthError means GitHub explicitly rejected the refresh token
      // (e.g. "bad_refresh_token").  The user's credentials are unrecoverable
      // without a new sign-in, so force them out immediately.
      if (err instanceof GitHubOAuthError) {
        this.log.warn(
          { oauthErrorCode: err.code },
          'GitHub OAuth error, forcing sign out',
        );
        await this.#forceSignOut();
      } else {
        this.log.error({ err }, 'failed to refresh token');
      }
    }
  }

  /**
   * Clears all stored tokens from the DO (in-memory cache + SQLite) and
   * invalidates every D1 session for this user, effectively signing them out.
   *
   * Called when the refresh token has expired or GitHub rejects the refresh
   * token with an OAuth error.  The next page load will hit the session guard
   * in the dashboard route and redirect to the home page.
   */
  async #forceSignOut(): Promise<void> {
    // Clear tokens from DO storage so getGitHubToken() returns undefined.
    this.sql`DELETE FROM github_tokens WHERE id = 1`;
    this.#tokenCache = null;

    // Invalidate all server-side sessions for this user in D1.
    // The next request to any protected route will find no session and
    // redirect to the home page.
    if (this.env.GH_ADMIN_D1_PRIMARY) {
      await this.env.GH_ADMIN_D1_PRIMARY.prepare(
        'DELETE FROM sessions WHERE user_id = ?',
      )
        .bind(this.name)
        .run();

      this.log.warn('sessions cleared, user forced to sign out');
    }
  }

  /**
   * Reads the stored token row directly from SQLite, populates the in-memory
   * cache, and returns a `GitHubTokenData` object (or `null` when no row exists).
   */
  #readTokensFromSql(): GitHubTokenData | null {
    const rows = this.sql<TokenRow>`
      SELECT
        access_token,
        access_token_expires_at,
        refresh_token,
        refresh_token_expires_at
      FROM github_tokens
      LIMIT 1
    `;

    if (!rows[0]) return null;

    const row = rows[0];
    const data: GitHubTokenData = {
      accessToken: row.access_token,
      accessTokenExpiresAt: row.access_token_expires_at,
      refreshToken: row.refresh_token ?? undefined,
      refreshTokenExpiresAt: row.refresh_token_expires_at ?? undefined,
    };

    // Warm cache from SQL read.
    this.#tokenCache = data;
    return data;
  }

  /**
   * Reads the user's GitHub OAuth tokens from the D1 `accounts` table —
   * the authoritative source written by Better Auth on sign-in.
   *
   * Used as the tier-3 fallback in `getGitHubToken` when neither the
   * in-memory cache nor DO SQLite hold a token row.  Timestamps in D1 are
   * stored as Unix seconds and are converted to milliseconds here so the
   * returned value is compatible with the rest of the DO's token handling.
   *
   * Does NOT populate the DO SQLite or in-memory cache — callers are
   * responsible for calling `setTokens` if they want to backfill.
   */
  async #readTokensFromD1(): Promise<GitHubTokenData | null> {
    if (!this.env.GH_ADMIN_D1_PRIMARY) return null;

    const row = await this.env.GH_ADMIN_D1_PRIMARY.prepare(
      `SELECT access_token, access_token_expires_at, refresh_token, refresh_token_expires_at
       FROM accounts
       WHERE user_id = ? AND provider_id = 'github-app'
       LIMIT 1`,
    )
      .bind(this.name)
      .first<{
        access_token: string | null;
        access_token_expires_at: number | null;
        refresh_token: string | null;
        refresh_token_expires_at: number | null;
      }>();

    if (!row?.access_token) return null;

    this.log.info('loaded tokens from D1');

    const authSecret = this.env.AUTH_SECRET;
    const accessToken = await decryptToken(row.access_token, authSecret);
    const refreshToken = row.refresh_token
      ? await decryptToken(row.refresh_token, authSecret)
      : undefined;

    return {
      accessToken,
      accessTokenExpiresAt:
        row.access_token_expires_at != null
          ? row.access_token_expires_at * 1_000
          : Date.now() + DEFAULT_TOKEN_EXPIRY_SECONDS * 1_000,
      refreshToken,
      refreshTokenExpiresAt:
        row.refresh_token_expires_at != null
          ? row.refresh_token_expires_at * 1_000
          : undefined,
    };
  }

  /**
   * Schedules a one-time `refreshAccessToken` call for REFRESH_BUFFER_MS
   * before the access token expires.  If the computed fire-time is already
   * in the past the refresh is triggered immediately (1-second delay).
   *
   * The agents framework `schedule()` method is used rather than the raw
   * Durable Object alarm API so the framework can manage retries and
   * resume the schedule after hibernation.
   */
  async #scheduleTokenRefresh(accessTokenExpiresAt: number): Promise<void> {
    const fireAt = new Date(
      Math.max(Date.now() + 1_000, accessTokenExpiresAt - REFRESH_BUFFER_MS),
    );

    await this.schedule(fireAt, 'refreshAccessToken');
  }

  // ── Usage tracking ─────────────────────────────────────────────────────

  /**
   * Returns the Unix millisecond timestamp for the start of the current
   * calendar month in UTC. Used to determine when to reset the monthly counter.
   */
  #getMonthStart(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }

  /**
   * Returns an ISO-8601 date string for the start of the next calendar month —
   * i.e. when the monthly usage counter will reset.
   */
  #getNextMonthStart(): string {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ).toISOString();
  }

  /**
   * Ensures the `usage_stats` row exists and that `monthly_count` reflects
   * the current billing period.  If the stored `period_start` is earlier than
   * the current calendar month start, the counter is reset to zero.
   */
  #ensureCurrentPeriod(): void {
    const currentMonthStart = this.#getMonthStart();
    const rows = this.sql<UsageStatsRow>`
      SELECT monthly_count, period_start FROM usage_stats WHERE id = 1 LIMIT 1
    `;

    if (!rows[0]) {
      this.sql`
        INSERT INTO usage_stats (id, monthly_count, period_start)
        VALUES (1, 0, ${currentMonthStart})
      `;
      return;
    }

    if (rows[0].period_start < currentMonthStart) {
      // New billing period — reset the monthly counter.
      this.sql`
        UPDATE usage_stats
        SET monthly_count = 0, period_start = ${currentMonthStart}
        WHERE id = 1
      `;
      this.log.info('monthly counter reset for new period');
    }
  }

  /**
   * Reads the user's active subscription tier.
   *
   * Reads from the DO `user_preferences` table with a 5-minute cache TTL.
   * When the cache is absent or stale the D1 `subscriptions` table is queried
   * and the result is written back to preferences so subsequent calls are cheap.
   *
   * Defaults to `"free"` when no subscription row is found.  Never throws —
   * on any error the `"free"` tier is returned so limit checks are conservative.
   */
  async #getSubscriptionTier(): Promise<SubscriptionTier> {
    const cachedTier = await this.getPreference(PREF_SUBSCRIPTION_TIER);
    const cachedExpiresAt = await this.getPreference(PREF_TIER_EXPIRES_AT);

    if (cachedTier && cachedExpiresAt && Date.now() < Number(cachedExpiresAt)) {
      // Cache is valid — return without touching D1.
      return cachedTier as SubscriptionTier;
    }

    // Cache is absent or stale — attempt a fresh D1 read.
    try {
      const tier = await this.#readTierFromD1();
      const expiresAt = Date.now() + TIER_CACHE_TTL_MS;
      await this.setPreference(PREF_SUBSCRIPTION_TIER, tier);
      await this.setPreference(PREF_TIER_EXPIRES_AT, String(expiresAt));
      return tier;
    } catch (err) {
      // D1 is unreachable — fall back to the stale cached value if we have
      // one, so users are not incorrectly demoted to the free tier during a
      // transient outage.  Only default to 'free' when no cached value exists.
      if (cachedTier) {
        this.log.warn(
          { staleTier: cachedTier },
          'D1 unreachable, using stale cached tier',
        );
        return cachedTier as SubscriptionTier;
      }
      this.log.error(
        { err },
        'D1 unreachable and no cached tier, defaulting to free',
      );
      return 'free';
    }
  }

  /**
   * Reads the user's active subscription plan from the D1 `subscriptions`
   * table.  Returns `"free"` when no active subscription is found.
   */
  async #readTierFromD1(): Promise<SubscriptionTier> {
    if (!this.env.GH_ADMIN_D1_PRIMARY) return 'free';

    const row = await this.env.GH_ADMIN_D1_PRIMARY.prepare(
      `SELECT plan FROM subscriptions
       WHERE reference_id = ? AND (status = 'active' OR status = 'trialing')
       ORDER BY period_end DESC LIMIT 1`,
    )
      .bind(this.name)
      .first<{ plan: string | null }>();

    const plan = row?.plan;
    if (plan === 'standard' || plan === 'unlimited') {
      return plan;
    }
    return 'free';
  }

  /**
   * Calculates the user's current usage statistics including monthly/session
   * counts, limit, tier, reset date, and whether the user is on the unlimited tier.
   *
   * Admin users are always shown as unlimited regardless of their subscription.
   * Safe to call at any time — ensures the current billing period is
   * initialised before reading the counter.
   */
  @callable()
  async calculateUsageStats(): Promise<UsageStats> {
    this.#ensureCurrentPeriod();

    const rows = this.sql<UsageStatsRow>`
      SELECT monthly_count, period_start FROM usage_stats WHERE id = 1 LIMIT 1
    `;
    const monthly = rows[0]?.monthly_count ?? 0;

    if (await this.#isAdmin()) {
      return {
        monthly,
        session: this.#sessionToolCount,
        limit: -1,
        tier: 'Admin',
        resetDate: this.#getNextMonthStart(),
        isUnlimited: true,
      };
    }

    const tier = await this.#getSubscriptionTier();
    const config = getSubscriptionConfig(tier, this.env);

    return {
      monthly,
      session: this.#sessionToolCount,
      limit: config.toolExecutionLimit,
      tier: config.displayName,
      resetDate: this.#getNextMonthStart(),
      isUnlimited: config.isUnlimited,
    };
  }

  /**
   * Returns `true` if the user is allowed to execute tools, `false` if their
   * monthly limit has been reached.
   *
   * Admin and unlimited-tier users always receive `true`.  If usage stats
   * cannot be determined (e.g. D1 is unreachable), defaults to `true` to
   * avoid erroneously blocking users.
   */
  async checkUsageLimit(): Promise<boolean> {
    try {
      // Admins have no limits — short-circuit before touching subscription data.
      if (await this.#isAdmin()) return true;

      const stats = await this.calculateUsageStats();
      if (stats.isUnlimited) return true;
      const allowed = stats.monthly < stats.limit;
      this.log.info(
        {
          tier: stats.tier,
          monthly: stats.monthly,
          limit: stats.limit,
          allowed,
        },
        'usage limit check',
      );
      return allowed;
    } catch (err) {
      // Default to allowing on error — conservative approach per quality requirements.
      this.log.error(
        { err },
        'error checking usage limit, defaulting to allow',
      );
      return true;
    }
  }

  /**
   * Records tool executions: increments the DO SQLite monthly counter and
   * writes one Analytics Engine data point per tool execution.
   *
   * Each data point uses `blob1=userId`, `blob2=toolName`, `double1=1` so
   * the AE SQL API can aggregate by tool name or user across any time range.
   *
   * @param toolNames - Names of tools that actually executed this step.
   */
  async #recordToolExecutions(toolNames: string[]): Promise<void> {
    if (toolNames.length === 0) return;
    const count = toolNames.length;

    this.#ensureCurrentPeriod();

    this.sql`
      UPDATE usage_stats SET monthly_count = monthly_count + ${count} WHERE id = 1
    `;

    // One data point per tool execution — enables GROUP BY tool_name in AE SQL.
    if (this.env.GH_AGENT_TOOL_CALLS) {
      for (const toolName of toolNames) {
        this.env.GH_AGENT_TOOL_CALLS.writeDataPoint({
          blobs: [this.name, toolName],
          doubles: [1],
          indexes: [this.name],
        });
      }
    }

    await this.#broadcastUsageState();
  }

  /**
   * Records a tool approval decision (approved or denied) to Analytics Engine.
   *
   * Uses `blob2` values `'toolApproval:approved'` or `'toolApproval:denied'`
   * with `blob3=toolName` so AE queries can compute approval rates.
   */
  #recordToolApproval(toolName: string, approved: boolean): void {
    if (!this.env.GH_AGENT_TOOL_CALLS) return;
    const status = approved ? 'toolApproval:approved' : 'toolApproval:denied';
    this.env.GH_AGENT_TOOL_CALLS.writeDataPoint({
      blobs: [this.name, status, toolName],
      doubles: [1],
      indexes: [this.name],
    });
    this.log.info({ toolName, approved }, 'tool approval recorded');
  }

  /**
   * Calculates current usage stats and broadcasts them to all connected
   * WebSocket clients via `setState()`.
   */
  async #broadcastUsageState(): Promise<void> {
    const usage = await this.calculateUsageStats();
    this.setState({ usage });
  }

  /**
   * Store the user's subscription tier in the DO preference cache, bypassing
   * the TTL.  Called by the auth hook on sign-in so the DO always has an
   * up-to-date tier immediately after authentication.
   *
   * Subscription changes via Stripe webhooks update D1 directly; the DO's
   * TTL-based cache will pick up the new tier within 5 minutes automatically.
   */
  @callable()
  async setSubscriptionTier(tier: string): Promise<void> {
    const validTier: SubscriptionTier =
      tier === 'standard' || tier === 'unlimited' ? tier : 'free';
    const expiresAt = Date.now() + TIER_CACHE_TTL_MS;
    await this.setPreference(PREF_SUBSCRIPTION_TIER, validTier);
    await this.setPreference(PREF_TIER_EXPIRES_AT, String(expiresAt));
    this.log.info({ tier: validTier }, 'subscription tier set');
  }

  /**
   * Cache the user's admin status in DO preferences.  Called by the auth hook
   * on every sign-in so the DO always reflects the current role immediately.
   *
   * The cache expires after 1 hour; `#isAdmin()` re-reads from D1 when stale,
   * so a role change is picked up within 1 hour even without a sign-in.
   */
  @callable()
  async setAdminStatus(isAdmin: boolean): Promise<void> {
    const expiresAt = Date.now() + ADMIN_CACHE_TTL_MS;
    await this.setPreference(PREF_IS_ADMIN, String(isAdmin));
    await this.setPreference(PREF_ADMIN_EXPIRES_AT, String(expiresAt));
    this.log.info({ isAdmin }, 'admin status set');
  }

  /**
   * Returns `true` when the user holds the `admin` role in the `users` table.
   *
   * Reads from the 1-hour TTL preference cache.  Falls back to a live D1
   * query when the cache is absent or expired.  Never throws — returns `false`
   * on any error so admin checks fail-safe.
   */
  async #isAdmin(): Promise<boolean> {
    const cached = await this.getPreference(PREF_IS_ADMIN);
    const cachedExpiresAt = await this.getPreference(PREF_ADMIN_EXPIRES_AT);

    if (
      cached !== null &&
      cachedExpiresAt &&
      Date.now() < Number(cachedExpiresAt)
    ) {
      return cached === 'true';
    }

    try {
      if (!this.env.GH_ADMIN_D1_PRIMARY) return false;

      const row = await this.env.GH_ADMIN_D1_PRIMARY.prepare(
        'SELECT role FROM users WHERE id = ? LIMIT 1',
      )
        .bind(this.name)
        .first<{ role: string | null }>();

      const isAdmin = row?.role === 'admin';
      await this.setAdminStatus(isAdmin);
      return isAdmin;
    } catch (err) {
      // Fall back to stale cache if available; otherwise assume non-admin.
      if (cached !== null) {
        this.log.warn(
          { staleValue: cached },
          'D1 unreachable, using stale admin cache',
        );
        return cached === 'true';
      }
      this.log.error(
        { err },
        'error reading admin status, defaulting to false',
      );
      return false;
    }
  }

  // ── Data lifecycle ─────────────────────────────────────────────────────

  /**
   * Wipes all data stored in this Durable Object: SQLite tables, KV storage,
   * chat history, and in-memory caches.  Called by the auth `afterDelete` hook
   * when a user deletes their account, and by the inactivity cleanup scheduler.
   */
  @callable()
  async deleteAllData(): Promise<void> {
    this.log.info('wiping all data');
    this.#tokenCache = null;
    this.#sessionToolCount = 0;

    // Drop all DO SQLite tables
    this.sql`DROP TABLE IF EXISTS github_tokens`;
    this.sql`DROP TABLE IF EXISTS user_preferences`;
    this.sql`DROP TABLE IF EXISTS usage_stats`;
    this.sql`DROP TABLE IF EXISTS query_history`;
    this.#cache.dropTables();

    // Wipe KV storage (chat history, agent framework state)
    await this.ctx.storage.deleteAll();

    // Recreate empty tables so the DO remains functional
    this.sql`
      CREATE TABLE IF NOT EXISTS github_tokens (
        id                      INTEGER PRIMARY KEY,
        access_token            TEXT    NOT NULL,
        access_token_expires_at INTEGER NOT NULL,
        refresh_token           TEXT,
        refresh_token_expires_at INTEGER
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS user_preferences (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS usage_stats (
        id            INTEGER PRIMARY KEY,
        monthly_count INTEGER NOT NULL DEFAULT 0,
        period_start  INTEGER NOT NULL
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS query_history (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        query      TEXT    NOT NULL,
        favorite   INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `;
    this.#cache.initSchema();
  }

  // ── Query History ─────────────────────────────────────────────────────

  @callable()
  async saveQuery(query: string): Promise<void> {
    this.sql`
      INSERT INTO query_history (query, created_at) VALUES (${query}, ${Date.now()})
    `;
    // Keep only the last 50 queries
    this.sql`
      DELETE FROM query_history WHERE id NOT IN (
        SELECT id FROM query_history ORDER BY created_at DESC LIMIT 50
      )
    `;
  }

  @callable()
  async listQueryHistory(): Promise<
    Array<{ id: number; query: string; favorite: boolean; createdAt: number }>
  > {
    const rows = [
      ...this
        .sql`SELECT id, query, favorite, created_at FROM query_history ORDER BY created_at DESC LIMIT 50`,
    ] as Array<{
      id: number;
      query: string;
      favorite: number;
      created_at: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      query: r.query,
      favorite: r.favorite === 1,
      createdAt: r.created_at,
    }));
  }

  @callable()
  async toggleQueryFavorite(id: number): Promise<boolean> {
    this
      .sql`UPDATE query_history SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ${id}`;
    const row = [
      ...this.sql`SELECT favorite FROM query_history WHERE id = ${id}`,
    ] as Array<{ favorite: number }>;
    return row[0]?.favorite === 1;
  }

  @callable()
  async deleteQuery(id: number): Promise<void> {
    this.sql`DELETE FROM query_history WHERE id = ${id}`;
  }

  /**
   * Schedules a 28-day inactivity cleanup check.  Called on every login to
   * reset the timer.  When the timer fires, `checkInactivityCleanup` verifies
   * the user is still free-tier and non-admin before destroying data.
   *
   * Admin and paying users are never cleaned up.
   */
  @callable()
  async scheduleInactivityCleanup(): Promise<void> {
    const TWENTY_EIGHT_DAYS_MS = 28 * 24 * 60 * 60 * 1_000;
    const fireAt = new Date(Date.now() + TWENTY_EIGHT_DAYS_MS);
    await this.setPreference('inactivity_cleanup_at', fireAt.toISOString());
    await this.schedule(fireAt, 'checkInactivityCleanup');
    this.log.info(
      { fireAt: fireAt.toISOString() },
      'inactivity cleanup scheduled',
    );
  }

  /**
   * Scheduled callback: checks whether the user is free-tier and non-admin.
   * If so, wipes all DO data.  Admin and paying users are always preserved.
   */
  async checkInactivityCleanup(): Promise<void> {
    this.log.info('inactivity cleanup check firing');

    // Never clean up admin users
    if (await this.#isAdmin()) {
      this.log.info('skipping cleanup, user is admin');
      return;
    }

    // Never clean up paying users
    try {
      if (this.env.GH_ADMIN_D1_PRIMARY) {
        const subRow = await this.env.GH_ADMIN_D1_PRIMARY.prepare(
          `SELECT plan FROM subscriptions
           WHERE reference_id = ? AND (status = 'active' OR status = 'trialing')
           LIMIT 1`,
        )
          .bind(this.name)
          .first<{ plan: string }>();

        if (subRow && subRow.plan !== 'free') {
          this.log.info(
            { plan: subRow.plan },
            'skipping cleanup, user has paid plan',
          );
          return;
        }
      }
    } catch (err) {
      this.log.error({ err }, 'error checking subscription, aborting cleanup');
      return;
    }

    // Free-tier, non-admin user inactive for 28 days — destroy data
    this.log.info('destroying data for inactive free-tier user');
    await this.deleteAllData();
  }

  // ── Entity cache ───────────────────────────────────────────────────────

  /** Returns cached org repos, or `null` on cache miss. */
  getCachedOrgRepos(org: string): CachedOrgRepos | null {
    return this.#cache.getCachedOrgRepos(org);
  }

  /** Replaces the entire cached repo list for the org. */
  setCachedOrgRepos(org: string, repos: CachedRepoEntry[]): void {
    this.#cache.setCachedOrgRepos(org, repos);
  }

  /** Returns cached org teams, or `null` on cache miss. */
  getCachedOrgTeams(org: string): CachedOrgTeams | null {
    return this.#cache.getCachedOrgTeams(org);
  }

  /** Replaces the entire cached team list for the org. */
  setCachedOrgTeams(org: string, teams: CachedTeamEntry[]): void {
    this.#cache.setCachedOrgTeams(org, teams);
  }

  /** Adds a single repo entry to the cache (write-through after creation). */
  addCachedRepo(org: string, repo: CachedRepoEntry): void {
    this.#cache.addCachedRepo(org, repo);
  }

  /** Removes the given repos from the cache (write-through after deletion). */
  removeCachedRepos(org: string, repoNames: string[]): void {
    this.#cache.removeCachedRepos(org, repoNames);
  }

  /** Updates a cached repo entry (write-through after updates). */
  updateCachedRepo(
    org: string,
    oldName: string,
    updates: Partial<CachedRepoEntry>,
  ): void {
    this.#cache.updateCachedRepo(org, oldName, updates);
  }

  /** Returns freshness metadata for a cache key, or `null` if not cached. */
  getCacheFreshness(
    cacheKey: string,
  ): { cachedAt: number; ageMs: number; isFresh: boolean } | null {
    return this.#cache.getCacheFreshness(cacheKey);
  }

  // ── Background entity sync ─────────────────────────────────────────────

  /**
   * Proactively populates the entity cache for all of the user's GitHub orgs
   * by fetching repos and teams and writing them through `CacheManager`.
   *
   * Called on login (via `backgroundEntitySync`) and re-scheduled every
   * `CACHE_REFRESH_INTERVAL_MS` while the session is still active.  Errors
   * per-org are logged but do not abort the rest of the sync — a cache miss
   * is always safe; the tool layer falls back to a live GitHub API call.
   */
  async warmCache(): Promise<void> {
    this.log.info('warmCache: starting entity sync');

    const accessToken = await this.getGitHubToken();
    if (!accessToken) {
      this.log.warn('warmCache: no access token, skipping');
      return;
    }

    const orgsResult = await getGitHubUserOrgs({ accessToken });
    if (!orgsResult.success) {
      this.log.warn(
        { error: orgsResult.error.message },
        'warmCache: failed to fetch orgs',
      );
      return;
    }

    const orgs = orgsResult.data;
    let repoCount = 0;
    let teamCount = 0;

    for (const org of orgs) {
      try {
        const [reposResult, teamsResult] = await Promise.all([
          getGitHubOrgRepos({ org: org.login, accessToken }),
          getGitHubOrgTeams({ org: org.login, accessToken }),
        ]);

        if (reposResult.success) {
          this.#cache.setCachedOrgRepos(
            org.login,
            reposResult.data.map((r) => ({
              name: r.name,
              full_name: r.full_name,
              private: r.private,
              description: r.description ?? null,
              html_url: r.html_url,
            })),
          );
          repoCount += reposResult.data.length;
        }

        if (teamsResult.success) {
          this.#cache.setCachedOrgTeams(
            org.login,
            teamsResult.data.map((t) => ({
              name: t.name,
              slug: t.slug,
              description: t.description ?? null,
              privacy: t.privacy ?? null,
              permission: t.permission,
            })),
          );
          teamCount += teamsResult.data.length;
        }
      } catch (err) {
        this.log.error({ err, org: org.login }, 'warmCache: error syncing org');
      }
    }

    if (this.env.GH_AGENT_TOOL_CALLS) {
      this.env.GH_AGENT_TOOL_CALLS.writeDataPoint({
        blobs: [this.name, 'entity_sync'],
        doubles: [orgs.length],
        indexes: [this.name],
      });
    }

    this.log.info(
      { orgCount: orgs.length, repoCount, teamCount },
      'warmCache: entity sync complete',
    );

    // Reschedule the next refresh if still within the session window set by
    // `backgroundEntitySync`.  When the window lapses (> 8 hours after login)
    // the periodic sync stops automatically.
    const activeUntilStr = await this.getPreference(PREF_CACHE_REFRESH_UNTIL);
    if (activeUntilStr && Date.now() < Number(activeUntilStr)) {
      const fireAt = new Date(Date.now() + CACHE_REFRESH_INTERVAL_MS);
      await this.schedule(fireAt, 'warmCache');
      this.log.info(
        { nextRefresh: fireAt.toISOString() },
        'warmCache: next refresh scheduled',
      );
    } else {
      this.log.info('warmCache: session window elapsed, not rescheduling');
    }
  }

  /**
   * Entry point for background entity sync, called from the auth hook on
   * sign-in via the `@callable()` RPC interface.
   *
   * Skips free-tier, non-admin users — background sync is a paid feature.
   * Records the session window so `warmCache` can self-reschedule for up to
   * 8 hours after login.  Must be invoked fire-and-forget from the auth hook
   * so it does not delay the login response.
   */
  @callable()
  async backgroundEntitySync(): Promise<void> {
    const isAdmin = await this.#isAdmin();
    const tier = await this.#getSubscriptionTier();

    if (!isAdmin && tier === 'free') {
      this.log.info(
        { tier },
        'backgroundEntitySync: skipping for free-tier non-admin user',
      );
      return;
    }

    this.log.info({ tier, isAdmin }, 'backgroundEntitySync: starting sync');

    // Mark the session window so warmCache knows when to stop rescheduling.
    const activeUntil = Date.now() + SESSION_DURATION_MS;
    await this.setPreference(PREF_CACHE_REFRESH_UNTIL, String(activeUntil));

    await this.warmCache();
  }

  // ── Scheduling ─────────────────────────────────────────────────────────

  /**
   * Persist a generic tool-call task to D1 for future execution.
   * Called from the AI `scheduleTask` tool so the tool layer does not need
   * direct access to `env` or the user ID.
   */
  async scheduleToolCallTask(
    toolName: string,
    toolInput: Record<string, unknown>,
    scheduledAt: Date,
    title: string,
  ): Promise<ScheduledTaskSummary> {
    const payload: ToolCallPayload = { toolName, toolInput };
    return createScheduledTask(this.env, this.name, {
      taskType: 'tool_call',
      title,
      scheduledAt,
      payload,
    });
  }

  /** List the user's scheduled tasks, optionally filtered by status. */
  async listUserScheduledTasks(filters?: {
    status?: ScheduledTaskStatus;
  }): Promise<ScheduledTaskSummary[]> {
    return listScheduledTasks(this.env, this.name, filters);
  }

  /** Cancel a pending scheduled task owned by this user. */
  async cancelUserScheduledTask(id: string): Promise<ScheduledTaskSummary> {
    return cancelScheduledTask(this.env, this.name, id);
  }

  /** Permanently delete a scheduled task owned by this user. */
  async deleteUserScheduledTask(id: string): Promise<void> {
    return deleteScheduledTask(this.env, this.name, id);
  }

  // ── Chat handler ───────────────────────────────────────────────────────

  /**
   * Handles an incoming chat message from a connected WebSocket client.
   *
   * Returns an SSE-encoded UI message stream so that `AIChatAgent._reply`
   * takes the `_streamSSEReply` path and receives byte chunks that can be
   * decoded safely.
   *
   * 1. `convertToModelMessages` transforms UIMessage[] (client format) into
   *    the ModelMessage[] format required by `streamText`.
   * 2. `buildGitHubTools` resolves the GitHub access token via `getCurrentAgent`,
   *    which is set up by `agentContext.run` inside `AIChatAgent.onMessage`.
   * 3. `stepCountIs(10)` enables autonomous multi-step tool execution.
   * 4. Usage limit is checked before processing; a structured error is returned
   *    when the user has reached their monthly tool execution limit.
   */
  override async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: OnChatMessageOptions,
  ): Promise<Response | undefined> {
    const requestId = options?.requestId ?? 'unknown';
    this.log.debug(
      { requestId, messageCount: this.messages.length },
      'onChatMessage',
    );

    // NOTE: #sessionToolCount is intentionally NOT reset here.  It accumulates
    // for the lifetime of this DO instance (the user's active WebSocket session)
    // so the "session" metric reflects total tool executions since the user
    // opened the chat, not just within a single message exchange.

    // Enforce monthly usage limit before starting any AI processing.
    const canExecute = await this.checkUsageLimit();
    if (!canExecute) {
      const stats = await this.calculateUsageStats();
      const upgradeUrl = '/dashboard';
      const errorMessage =
        `You have reached your monthly tool execution limit (${stats.monthly}/${stats.limit} on the ${stats.tier} plan). ` +
        `Your usage resets on ${new Date(stats.resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ` +
        `Upgrade your plan at ${upgradeUrl} to continue using AI tools.`;

      this.log.info(
        { tier: stats.tier, monthly: stats.monthly, limit: stats.limit },
        'usage limit reached',
      );

      // Broadcast blocked usage state so client shows the limit warning.
      await this.#broadcastUsageState();

      // Return a plain text error stream that the AI chat client can display.
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: 'text', text: errorMessage });
        },
      });

      return createUIMessageStreamResponse({
        headers: { 'cache-control': 'no-cache' },
        stream,
      });
    }

    const openai = createOpenAI({ apiKey: this.env.OPENAI_API_KEY });

    this.log.debug({ model: GITHUB_AGENT_MODEL }, 'starting streamText');

    const result = streamText({
      abortSignal: options?.abortSignal,
      messages: await convertToModelMessages(this.messages),
      model: openai(GITHUB_AGENT_MODEL),
      onFinish: (...args) => {
        this.log.debug('streamText onFinish — stream complete');
        return onFinish(...args);
      },
      onStepFinish: async (step) => {
        // Use toolResults (not toolCalls) — toolResults only contains tools
        // that actually executed, skipping any that were denied at the
        // approval gate.  Extract the name of each result for per-tool
        // analytics and accurate execution counting.
        const executedNames = (step.toolResults ?? []).map((r) => r.toolName);
        const calledNames = new Set(
          (step.toolCalls ?? []).map((c) => c.toolName),
        );
        this.log.debug(
          {
            toolCalls: calledNames.size,
            toolResults: executedNames.length,
            tools: [...calledNames],
          },
          'onStepFinish',
        );
        if (executedNames.length > 0) {
          this.#sessionToolCount += executedNames.length;
          await this.#recordToolExecutions(executedNames);
        }

        // Track approval metrics: compare toolCalls vs toolResults to find
        // approved and denied tools that required approval.
        const executedSet = new Set(executedNames);
        for (const name of calledNames) {
          if (toolNeedsApproval(name)) {
            const approved = executedSet.has(name);
            this.log.debug({ tool: name, approved }, 'tool approval tracked');
            this.#recordToolApproval(name, approved);
          }
        }
      },
      stopWhen: stepCountIs(10),
      system: this.#isCliClient ? getCliSystemPrompt() : getSystemPrompt(),
      tools: buildGitHubTools(),
    });

    this.log.debug('creating UI message stream');

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        if (this.#isCliClient) {
          this.log.debug('stream execute — CLI mode (no pipeJsonRender)');
          writer.merge(result.toUIMessageStream());
        } else {
          this.log.debug('stream execute — merging pipeJsonRender');
          writer.merge(pipeJsonRender(result.toUIMessageStream()));
        }
      },
    });

    this.log.debug('returning stream response');
    return createUIMessageStreamResponse({
      headers: {
        'cache-control': 'no-cache',
      },
      stream,
    });
  }

  // ── Callable RPC methods ───────────────────────────────────────────────

  /**
   * Returns the current operational status of this agent instance.
   *
   * `@callable()` exposes this method as a client-callable RPC endpoint —
   * clients can invoke it via `agent.getStatus()` using the agents client SDK.
   *
   * `getCurrentAgent<GitHubAgent>()` provides access to the agent instance,
   * active connection, and originating request from any context within the
   * agent's async execution scope — useful in helper functions and tools that
   * don't hold a direct reference to `this`.
   */
  @callable()
  async getStatus(): Promise<{
    /** Active AI chat WebSocket connections owned by this agent instance. */
    connections: number;
    hasToken: boolean;
    status: string;
  }> {
    /**
     * `getCurrentAgent` gives access to the calling WebSocket connection and
     * originating request within this @callable RPC method — useful for
     * auditing who triggered the call or branching on connection state.
     */
    const { connection } = getCurrentAgent<GitHubAgent>();
    const connections = this.ctx.getWebSockets().length;
    const tokens = this.#tokenCache ?? this.#readTokensFromSql();
    const hasToken = tokens != null && Date.now() < tokens.accessTokenExpiresAt;
    return {
      connections,
      hasToken,
      status: connection ? 'connected' : 'active',
    };
  }

  /**
   * Returns the full conversation history stored in this agent's KV storage.
   * Used by the data export procedure to include chat history in the export
   * without exposing it via the WebSocket chat interface.
   */
  @callable()
  getChatHistory(): unknown[] {
    return this.messages as unknown[];
  }
}
