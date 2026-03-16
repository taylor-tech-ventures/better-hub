import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import type { User } from '@/server/auth/client';
import type { SubscriptionRow } from '@/server/data-access-layer/billing';
import { getSubscription } from '@/server/data-access-layer/billing';
import { getPreferences } from '@/server/data-access-layer/preferences';
import { getSession } from '@/server/functions/auth';
import type { Theme } from '@/server/functions/preferences';

export type { SubscriptionRow };

export type SettingsData = {
  user: Pick<User, 'name' | 'email' | 'login' | 'image' | 'createdAt'> | null;
  theme: Theme;
  subscription: SubscriptionRow | null;
};

/**
 * Fetches all data needed to render the settings page:
 * user profile, current theme preference, and subscription status.
 */
export const getSettingsData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SettingsData> => {
    const session = await getSession();
    if (!session) {
      return { user: null, theme: 'system', subscription: null };
    }

    const userId = session.user.id;

    const [prefs, subscription] = await Promise.all([
      getPreferences(env, userId).catch(() => ({}) as Record<string, string>),
      getSubscription(env, userId).catch(() => null),
    ]);

    const theme = (prefs.theme as Theme | undefined) ?? 'system';

    return {
      user: {
        name: session.user.name,
        email: session.user.email,
        login: session.user.login,
        image: session.user.image ?? null,
        createdAt: session.user.createdAt,
      },
      theme,
      subscription,
    };
  },
);
