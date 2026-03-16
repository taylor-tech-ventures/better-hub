import { z } from 'zod';
import {
  getPreference,
  getPreferences,
  setPreference,
} from '@/server/data-access-layer/preferences';
import { authorized, base } from '@/server/orpc/middleware';

export const preferences = {
  get: base
    .use(authorized)
    .input(z.object({ key: z.string() }))
    .handler(async ({ input, context }) =>
      getPreference(context.env, context.session.userId, input.key),
    ),

  set: base
    .use(authorized)
    .input(z.object({ key: z.string().max(256), value: z.string().max(65536) }))
    .handler(async ({ input, context }) => {
      await setPreference(
        context.env,
        context.session.userId,
        input.key,
        input.value,
      );
    }),

  getAll: base
    .use(authorized)
    .handler(async ({ context }) =>
      getPreferences(context.env, context.session.userId),
    ),
};
