import type { GitHubAgent } from '@/server/durable-objects/github-agent';

/**
 * Creates a named GitHubAgent DO stub for the given user.
 *
 * Uses `getByName()` for stub creation, then calls `setName()` to initialize
 * the partyserver identity (DOs don't know their own name from within —
 * see https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/).
 *
 * Callers must `await` the returned promise before invoking other RPC methods.
 */
export async function getGitHubAgentStub(
  env: Pick<Cloudflare.Env, 'GitHubAgent'>,
  userId: string,
): Promise<DurableObjectStub<GitHubAgent>> {
  const stub = env.GitHubAgent.getByName(userId);
  await stub.setName(userId);
  return stub;
}
