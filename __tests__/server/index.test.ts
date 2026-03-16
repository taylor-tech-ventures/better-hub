import { beforeEach, describe, expect, it, vi } from 'vitest';

const upgradeDurableIteratorRequest = vi.fn();

vi.mock('@orpc/experimental-durable-iterator/durable-object', () => ({
  upgradeDurableIteratorRequest,
}));

describe('server/orpc/durable-iterator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    upgradeDurableIteratorRequest.mockResolvedValue(new Response('iterator'));
  });

  it('uses the dedicated durable iterator path', async () => {
    const mod = await import('../../server/orpc/durable-iterator');

    expect(
      mod.isDurableIteratorRequest(
        new URL('https://example.com/api/orpc/durable-iterator'),
      ),
    ).toBe(true);
    expect(
      mod.isDurableIteratorRequest(new URL('https://example.com/dashboard/chat')),
    ).toBe(false);
  });

  it('routes durable iterator upgrades to the dedicated durable object namespace', async () => {
    const mod = await import('../../server/orpc/durable-iterator');
    const env = {
      AUTH_SECRET: 'secret',
      GitHubAgentEvents: { name: 'events' },
    } as unknown as Cloudflare.Env;

    const response = await mod.upgradeGitHubAgentEventsRequest(
      new Request('https://example.com/api/orpc/durable-iterator', {
        headers: { upgrade: 'websocket' },
      }),
      env,
    );

    await expect(response.text()).resolves.toBe('iterator');
    expect(upgradeDurableIteratorRequest).toHaveBeenCalledWith(
      expect.any(Request),
      {
        namespace: env.GitHubAgentEvents,
        signingKey: env.AUTH_SECRET,
      },
    );
  });
});
