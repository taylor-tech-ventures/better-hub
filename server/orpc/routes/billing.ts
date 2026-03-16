import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { createBillingPortalSession } from '@/server/data-access-layer/billing';
import { authorized, base } from '@/server/orpc/middleware';

export const billing = {
  createPortalSession: base
    .use(authorized)
    .input(z.object({ returnUrl: z.string().url() }))
    .handler(async ({ input, context }) => {
      const requestOrigin = new URL(
        context.headers.get('origin') ?? context.headers.get('referer') ?? '',
      ).origin;
      const returnOrigin = new URL(input.returnUrl).origin;
      if (returnOrigin !== requestOrigin) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'returnUrl must match the application origin',
        });
      }
      return createBillingPortalSession(
        context.env,
        context.user.id,
        input.returnUrl,
      );
    }),
};
