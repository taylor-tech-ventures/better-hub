import { ORPCError, os } from '@orpc/server';
import { createAuth } from '@/server/auth/index';

export const base = os.$context<{ headers: Headers; env: Cloudflare.Env }>();

export const authorized = base.middleware(async ({ context, next }) => {
  const sessionData = await createAuth(context.env).api.getSession({
    headers: context.headers,
  });

  if (!sessionData?.session || !sessionData?.user) {
    throw new ORPCError('UNAUTHORIZED');
  }

  return next({
    context: {
      session: sessionData.session,
      user: sessionData.user,
      env: context.env,
    },
  });
});
