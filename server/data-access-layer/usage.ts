import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import type { UsageStats } from '@/shared/types/github-agent-state';

/**
 * Retrieves the current usage statistics for the given user by calling
 * `calculateUsageStats()` on their GitHubAgent Durable Object.
 */
export async function getUserUsageStats(
  env: Cloudflare.Env,
  userId: string,
): Promise<UsageStats> {
  const stub = await getGitHubAgentStub(env, userId);
  return stub.calculateUsageStats();
}
