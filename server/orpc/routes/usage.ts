import { getUserUsageStats } from '@/server/data-access-layer/usage';
import { authorized, base } from '@/server/orpc/middleware';

export const usage = {
  /** Returns the current month's usage stats for the authenticated user. */
  get: base
    .use(authorized)
    .handler(async ({ context }) =>
      getUserUsageStats(context.env, context.session.userId),
    ),
};
