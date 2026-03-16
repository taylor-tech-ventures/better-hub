import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import type { Session } from '@/server/auth/client';
import { createAuth } from '@/server/auth/index';

export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Session | null> => {
    const auth = createAuth(env);
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });
    return session as unknown as Session | null;
  },
);
