import type { GitHubAgent } from '@/server/durable-objects/github-agent';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';

async function getStub(
  env: Cloudflare.Env,
  userId: string,
): Promise<DurableObjectStub<GitHubAgent>> {
  return getGitHubAgentStub(env, userId);
}

export async function getPreference(
  env: Cloudflare.Env,
  userId: string,
  key: string,
): Promise<string | null> {
  const stub = await getStub(env, userId);
  return stub.getPreference(key);
}

export async function setPreference(
  env: Cloudflare.Env,
  userId: string,
  key: string,
  value: string,
): Promise<void> {
  const stub = await getStub(env, userId);
  return stub.setPreference(key, value);
}

export async function getPreferences(
  env: Cloudflare.Env,
  userId: string,
): Promise<Record<string, string>> {
  const stub = await getStub(env, userId);
  return stub.getPreferences();
}
