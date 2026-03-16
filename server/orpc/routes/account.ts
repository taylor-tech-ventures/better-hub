import { ORPCError } from '@orpc/server';
import { getSubscription } from '@/server/data-access-layer/billing';
import { getPreferences } from '@/server/data-access-layer/preferences';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import { authorized, base } from '@/server/orpc/middleware';

export const account = {
  /**
   * Permanently deletes the authenticated user's account.
   *
   * Refuses deletion if the user has an active or trialing subscription —
   * they must cancel via the billing portal first.  On success, wipes all
   * Durable Object data and removes the user record from D1 (which cascades
   * to sessions, accounts, and subscriptions).
   */
  delete: base.use(authorized).handler(async ({ context }) => {
    const { env, user } = context;

    const subscription = await getSubscription(env, user.id);
    if (subscription && ['active', 'trialing'].includes(subscription.status)) {
      throw new ORPCError('BAD_REQUEST', {
        message:
          'Please cancel your subscription before deleting your account. Visit the billing page to manage your subscription.',
      });
    }

    const stub = await getGitHubAgentStub(env, user.id);
    await stub.deleteAllData();

    await env.GH_ADMIN_D1_PRIMARY.prepare('DELETE FROM users WHERE id = ?')
      .bind(user.id)
      .run();
  }),

  /**
   * Exports the authenticated user's data as a sanitized JSON object.
   *
   * Includes: profile fields, all DO preferences, and subscription status.
   * Explicitly excludes: OAuth tokens, session tokens, Stripe customer IDs,
   * and internal IDs.
   */
  exportData: base.use(authorized).handler(async ({ context }) => {
    const { env, user } = context;

    const stub = await getGitHubAgentStub(env, user.id);
    const [preferences, subscription, chatHistory] = await Promise.all([
      getPreferences(env, user.id),
      getSubscription(env, user.id),
      stub.getChatHistory().catch(() => []),
    ]);

    // Strip internal / cache keys from the exported preferences.
    const internalPrefPrefixes = [
      'dash_orgs_cache',
      'dash_orgs_cached_at',
      'dash_org_repos_',
      'dash_orgs_access_',
      'subscription_tier',
      'subscription_tier_expires_at',
      'is_admin',
      'is_admin_expires_at',
      'inactivity_cleanup_at',
    ];
    const exportablePrefs = Object.fromEntries(
      Object.entries(preferences).filter(
        ([key]) =>
          !internalPrefPrefixes.some((prefix) => key.startsWith(prefix)),
      ),
    );

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        email: user.email,
        login: user.login,
        image: user.image ?? null,
        createdAt: user.createdAt,
      },
      preferences: exportablePrefs,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            periodEnd: subscription.periodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      chatHistory,
    };
  }),
};
