import { createServerFn } from '@tanstack/react-start';
import { getSession } from '@/server/functions/auth';
import { aeDataset, queryAnalyticsEngine } from '@/server/lib/analytics-engine';
import { currentYearMonth } from '@/shared/lib/date';

// ── Types ──────────────────────────────────────────────────────────────────

export type UserTopTool = {
  toolName: string;
  total: number;
};

export type UserMonthlyTotal = {
  /** Calendar month in 'YYYY-MM' format. */
  month: string;
  total: number;
};

export type UserAnalytics = {
  topTools: UserTopTool[];
  monthlyTotals: UserMonthlyTotal[];
  totalExecutions: number;
  yearMonth: string;
};

// ── Server function ────────────────────────────────────────────────────────

/**
 * Fetches tool usage analytics for the currently authenticated user.
 *
 * Top tools for the selected month and a 12-month usage trend are sourced
 * from the Cloudflare Analytics Engine. Returns null when unauthenticated.
 */
export const getUserAnalytics = createServerFn({ method: 'GET' }).handler(
  async ({ data }: { data: unknown }): Promise<UserAnalytics | null> => {
    const yearMonth =
      typeof data === 'string' && /^\d{4}-\d{2}$/.test(data)
        ? data
        : currentYearMonth();

    const session = await getSession();
    if (!session) return null;

    const userId = session.user.id;

    // Validate userId is safe to interpolate into AE SQL
    // (Better Auth generates opaque IDs from alphanumeric chars + hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error('Invalid user ID format');
    }

    const dataset = aeDataset();

    const [y, m] = yearMonth.split('-').map(Number) as [number, number];
    const periodStart = new Date(Date.UTC(y, m - 1, 1))
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    const periodEnd = new Date(Date.UTC(y, m, 1))
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    // Start of the 12-month trend window (one month before 12 months back)
    const trendStart = new Date(Date.UTC(y, m - 13, 1))
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    const [toolResult, trendResult] = await Promise.all([
      // Top 10 tools used by this user in the selected month
      queryAnalyticsEngine(
        `SELECT blob2 AS tool_name, SUM(_sample_interval) AS total
         FROM ${dataset}
         WHERE blob1 = '${userId}'
           AND timestamp >= toDateTime('${periodStart}')
           AND timestamp < toDateTime('${periodEnd}')
         GROUP BY tool_name
         ORDER BY total DESC
         LIMIT 10`,
      ),

      // Monthly execution totals for the last 12 months
      queryAnalyticsEngine(
        `SELECT substring(toString(timestamp), 1, 7) AS month, SUM(_sample_interval) AS total
         FROM ${dataset}
         WHERE blob1 = '${userId}'
           AND timestamp >= toDateTime('${trendStart}')
           AND timestamp < toDateTime('${periodEnd}')
         GROUP BY month
         ORDER BY month`,
      ),
    ]);

    const topTools: UserTopTool[] = (
      toolResult.data as { tool_name: string; total: number }[]
    ).map((r) => ({ toolName: r.tool_name, total: Number(r.total) }));

    const monthlyTotals: UserMonthlyTotal[] = (
      trendResult.data as { month: string; total: number }[]
    ).map((r) => ({ month: r.month, total: Number(r.total) }));

    const totalExecutions = topTools.reduce((s, t) => s + t.total, 0);

    return { topTools, monthlyTotals, totalExecutions, yearMonth };
  },
);
