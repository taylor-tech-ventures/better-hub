import type { PlanCount } from '@/server/functions/admin-analytics';

type UserProfileRow = {
  id: string;
  name: string;
  email: string;
  login: string;
  image: string | null;
  plan: string;
};

export type UserProfile = UserProfileRow;

/** Plan distribution across all registered users. */
export async function getPlanDistribution(
  db: D1Database,
): Promise<PlanCount[]> {
  const result = await db
    .prepare(
      `SELECT
         COALESCE(s.plan, 'free') AS plan,
         COUNT(DISTINCT u.id) AS user_count
       FROM users u
       LEFT JOIN subscriptions s
         ON s.reference_id = u.id
         AND (s.status = 'active' OR s.status = 'trialing')
       GROUP BY plan
       ORDER BY user_count DESC`,
    )
    .all<{ plan: string; user_count: number }>();

  return result.results.map((r) => ({
    plan: r.plan,
    userCount: r.user_count,
  }));
}

/** Fetch user profiles with subscription plan for a list of user IDs. */
export async function getUserProfiles(
  db: D1Database,
  userIds: string[],
): Promise<Map<string, UserProfile>> {
  if (userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.login,
         u.image,
         COALESCE(s.plan, 'free') AS plan
       FROM users u
       LEFT JOIN subscriptions s
         ON s.reference_id = u.id
         AND (s.status = 'active' OR s.status = 'trialing')
       WHERE u.id IN (${placeholders})`,
    )
    .bind(...userIds)
    .all<UserProfileRow>();

  return new Map(result.results.map((r) => [r.id, r]));
}
