import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import { getPreference } from '@/server/data-access-layer/preferences';
import { getSession } from '@/server/functions/auth';

export type Theme = 'light' | 'dark' | 'system';
export type ConsentValue = 'accepted' | 'declined';

export const getThemePreference = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Theme> => {
    const session = await getSession();
    if (!session) return 'system';
    try {
      const value = await getPreference(env, session.user.id, 'theme');
      return (value as Theme | null) ?? 'system';
    } catch {
      return 'system';
    }
  },
);

export const getCookieConsentPreference = createServerFn({
  method: 'GET',
}).handler(async (): Promise<ConsentValue | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    const value = await getPreference(env, session.user.id, 'cookie-consent');
    if (value === 'accepted' || value === 'declined') return value;
    return null;
  } catch {
    return null;
  }
});
