import { describe, expect, it, vi } from 'vitest';
import { getGitHubAgentStub } from '../../../server/durable-objects/github-agent-stub';

describe('getGitHubAgentStub', () => {
  it('uses getByName and calls setName before returning the stub', async () => {
    const setName = vi.fn();
    const stub = {
      setName,
    };
    const getByName = vi.fn(() => stub);
    const env = {
      GitHubAgent: {
        getByName,
      },
    } as unknown as Pick<Cloudflare.Env, 'GitHubAgent'>;

    const result = await getGitHubAgentStub(env, 'user-123');

    expect(getByName).toHaveBeenCalledWith('user-123');
    expect(setName).toHaveBeenCalledWith('user-123');
    expect(result).toBe(stub);
  });
});
