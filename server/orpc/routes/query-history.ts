import { z } from 'zod';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import { authorized, base } from '@/server/orpc/middleware';

export const queryHistory = {
  list: base.use(authorized).handler(async ({ context }) => {
    const stub = await getGitHubAgentStub(context.env, context.session.userId);
    return stub.listQueryHistory();
  }),

  save: base
    .use(authorized)
    .input(z.object({ query: z.string().min(1).max(500) }))
    .handler(async ({ input, context }) => {
      const stub = await getGitHubAgentStub(
        context.env,
        context.session.userId,
      );
      await stub.saveQuery(input.query);
    }),

  toggleFavorite: base
    .use(authorized)
    .input(z.object({ id: z.number() }))
    .handler(async ({ input, context }) => {
      const stub = await getGitHubAgentStub(
        context.env,
        context.session.userId,
      );
      return stub.toggleQueryFavorite(input.id);
    }),

  delete: base
    .use(authorized)
    .input(z.object({ id: z.number() }))
    .handler(async ({ input, context }) => {
      const stub = await getGitHubAgentStub(
        context.env,
        context.session.userId,
      );
      await stub.deleteQuery(input.id);
    }),
};
