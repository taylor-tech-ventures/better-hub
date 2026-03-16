import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import {
  getPlanDistribution,
  getUserProfiles,
} from '@/server/data-access-layer/admin-analytics';
import { getSession } from '@/server/functions/auth';
import { aeDataset, queryAnalyticsEngine } from '@/server/lib/analytics-engine';
import { currentYearMonth } from '@/shared/lib/date';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'admin-analytics' });

// ── Types ──────────────────────────────────────────────────────────────────

export type TopTool = {
  toolName: string;
  total: number;
};

export type PowerUser = {
  userId: string;
  name: string;
  email: string;
  login: string;
  image: string | null;
  plan: string;
  totalExecutions: number;
};

export type PlanCount = {
  plan: string;
  userCount: number;
};

export type MonthlyTrend = {
  month: string;
  total: number;
};

export type AdminAnalytics = {
  topTools: TopTool[];
  powerUsers: PowerUser[];
  planCounts: PlanCount[];
  monthlyTrends: MonthlyTrend[];
  yearMonth: string;
};

// ── AE query cache (5-minute TTL, keyed by yearMonth) ─────────────────────

const AE_CACHE_TTL_MS = 5 * 60 * 1_000;

type AeCacheEntry = {
  toolResult: { data: Record<string, unknown>[] };
  userResult: { data: Record<string, unknown>[] };
  trendResult: { data: Record<string, unknown>[] };
  planCounts: PlanCount[];
  cachedAt: number;
};

const aeCache = new Map<string, AeCacheEntry>();

// ── Server function ────────────────────────────────────────────────────────

/**
 * Fetches analytics data for the admin dashboard.
 *
 * Top tools and power users are sourced from the Cloudflare Analytics Engine
 * (one data point written per tool execution by GitHubAgent). Plan distribution
 * is sourced from D1 (subscription data lives there and is not high-volume).
 *
 * AE query results are cached in-memory with a 5-minute TTL, keyed by
 * `yearMonth` parameter, to avoid redundant API calls on page reloads.
 *
 * Only users with `role = 'admin'` may call this — non-admins receive a thrown error.
 */
export const getAdminAnalytics = createServerFn({ method: 'GET' }).handler(
  async ({ data }: { data: unknown }): Promise<AdminAnalytics> => {
    const yearMonth =
      typeof data === 'string' && /^\d{4}-\d{2}$/.test(data)
        ? data
        : currentYearMonth();
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    if (session.user.role !== 'admin')
      throw new Error('Forbidden: admin role required');

    const db = env.GH_ADMIN_D1_PRIMARY;
    const dataset = aeDataset();

    // Calendar month boundaries as Unix timestamps for AE filtering.
    const [y, m] = yearMonth.split('-').map(Number) as [number, number];
    const periodStart = new Date(Date.UTC(y, m - 1, 1))
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    const periodEnd = new Date(Date.UTC(y, m, 1))
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    // 12-month trend window
    const trendStart = new Date(Date.UTC(y, m - 13, 1))
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    // ── AE queries with 5-minute in-memory cache ──

    const cached = aeCache.get(yearMonth);
    const cacheValid = cached && Date.now() - cached.cachedAt < AE_CACHE_TTL_MS;

    let toolResult: { data: Record<string, unknown>[] };
    let userResult: { data: Record<string, unknown>[] };
    let trendResult: { data: Record<string, unknown>[] };
    let planCounts: PlanCount[];

    if (cacheValid) {
      logger.debug({ yearMonth }, 'AE cache hit');
      ({ toolResult, userResult, trendResult, planCounts } = cached);
    } else {
      logger.debug({ yearMonth }, 'AE cache miss, querying');
      [toolResult, userResult, planCounts, trendResult] = await Promise.all([
        // Top 10 tools by execution count in the period
        queryAnalyticsEngine(
          `SELECT blob2 AS tool_name, SUM(_sample_interval) AS total
           FROM ${dataset}
           WHERE timestamp >= toDateTime('${periodStart}')
             AND timestamp < toDateTime('${periodEnd}')
             AND blob2 NOT IN ('autoApproved', 'confirmationRequired')
             AND blob2 NOT LIKE 'toolApproval:%'
           GROUP BY tool_name
           ORDER BY total DESC
           LIMIT 10`,
        ),

        // Top 20 users by execution count in the period
        queryAnalyticsEngine(
          `SELECT blob1 AS user_id, SUM(_sample_interval) AS total
           FROM ${dataset}
           WHERE timestamp >= toDateTime('${periodStart}')
             AND timestamp < toDateTime('${periodEnd}')
             AND blob2 NOT LIKE 'toolApproval:%'
           GROUP BY user_id
           ORDER BY total DESC
           LIMIT 20`,
        ),

        // Plan distribution across all registered users (D1)
        getPlanDistribution(db),

        // Monthly execution totals for the last 12 months (all users)
        queryAnalyticsEngine(
          `SELECT formatDateTime(timestamp, '%Y-%m') AS month, SUM(_sample_interval) AS total
           FROM ${dataset}
           WHERE timestamp >= toDateTime('${trendStart}')
             AND timestamp < toDateTime('${periodEnd}')
           GROUP BY month
           ORDER BY month`,
        ),
      ]);

      aeCache.set(yearMonth, {
        toolResult,
        userResult,
        trendResult,
        planCounts,
        cachedAt: Date.now(),
      });
    }

    // ── Top tools ──────────────────────────────────────────────────────────

    const topTools: TopTool[] = (
      toolResult.data as { tool_name: string; total: number }[]
    ).map((r) => ({ toolName: r.tool_name, total: Number(r.total) }));

    // ── Power users: enrich AE user IDs with profile data from D1 ──────────

    const aeUserRows = userResult.data as { user_id: string; total: number }[];
    const userIds = aeUserRows.map((r) => r.user_id);
    const profileMap = await getUserProfiles(db, userIds);

    const powerUsers: PowerUser[] = [];
    for (const aeRow of aeUserRows) {
      const profile = profileMap.get(aeRow.user_id);
      if (!profile) continue;
      powerUsers.push({
        userId: aeRow.user_id,
        name: profile.name,
        email: profile.email,
        login: profile.login,
        image: profile.image,
        plan: profile.plan,
        totalExecutions: Number(aeRow.total),
      });
    }

    // ── Monthly trends ────────────────────────────────────────────────────
    const monthlyTrends: MonthlyTrend[] = (
      trendResult.data as { month: string; total: number }[]
    ).map((r) => ({ month: r.month, total: Number(r.total) }));

    return { topTools, powerUsers, planCounts, monthlyTrends, yearMonth };
  },
);
