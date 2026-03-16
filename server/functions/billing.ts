import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import type { SubscriptionRow } from '@/server/data-access-layer/billing';
import { getSubscription } from '@/server/data-access-layer/billing';
import { getUserUsageStats } from '@/server/data-access-layer/usage';
import { getSession } from '@/server/functions/auth';
import { createLogger } from '@/shared/logger';
import type { UsageStats } from '@/shared/types/github-agent-state';

const logger = createLogger({ module: 'billing' });

export type { SubscriptionRow };

export type BillingData = {
  subscription: SubscriptionRow | null;
  usage: UsageStats | null;
};

/**
 * Fetches the current user's subscription and usage data for the billing page.
 * Returns null for `subscription` if the user is on the free tier (no row).
 * Returns null for `usage` if the usage stats cannot be retrieved.
 */
export const getBillingData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BillingData> => {
    const session = await getSession();
    if (!session) {
      return { subscription: null, usage: null };
    }

    const userId = session.user.id;

    const [subscription, usage] = await Promise.all([
      getSubscription(env, userId),
      getUserUsageStats(env, userId).catch((err) => {
        logger.error({ err }, 'failed to fetch usage stats');
        return null;
      }),
    ]);

    return { subscription, usage };
  },
);
