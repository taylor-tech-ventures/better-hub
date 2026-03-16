import { DurableIteratorObject } from '@orpc/experimental-durable-iterator/durable-object';

export type GitHubAgentEvent = Record<string, unknown>;

export class GitHubAgentEvents extends DurableIteratorObject<
  GitHubAgentEvent,
  Cloudflare.Env
> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    if (!env.AUTH_SECRET) {
      throw new Error(
        'AUTH_SECRET environment variable is required for GitHubAgentEvents token signing',
      );
    }

    super(ctx, env, { signingKey: env.AUTH_SECRET });
  }
}
