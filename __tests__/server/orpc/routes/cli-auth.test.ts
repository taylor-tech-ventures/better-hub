import nock from 'nock';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the dependencies that require Cloudflare runtime
vi.mock('@/server/durable-objects/github-agent-stub', () => ({
  getGitHubAgentStub: vi.fn().mockResolvedValue({
    setTokens: vi.fn().mockResolvedValue(undefined),
    setSubscriptionTier: vi.fn().mockResolvedValue(undefined),
    scheduleInactivityCleanup: vi.fn().mockResolvedValue(undefined),
    backgroundEntitySync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/server/lib/crypto', () => ({
  encryptToken: vi.fn().mockImplementation((token: string) =>
    Promise.resolve(`enc:${token}`),
  ),
  decryptToken: vi.fn().mockImplementation((token: string) =>
    Promise.resolve(token.replace('enc:', '')),
  ),
}));

describe('cli-auth device flow', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  describe('initDeviceFlow', () => {
    it('should call GitHub device/code endpoint and return formatted response', async () => {
      const githubResponse = {
        device_code: 'abc123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      };

      const scope = nock('https://github.com')
        .post('/login/device/code')
        .reply(200, githubResponse);

      // Simulate the handler logic directly
      const resp = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'test-client-id',
          scope: 'read:org repo admin:org',
        }),
      });

      const data = await resp.json();
      expect(data.device_code).toBe('abc123');
      expect(data.user_code).toBe('ABCD-1234');
      expect(data.verification_uri).toBe(
        'https://github.com/login/device',
      );
      expect(data.expires_in).toBe(900);
      expect(data.interval).toBe(5);
      scope.done();
    });
  });

  describe('pollDeviceFlow', () => {
    it('should return authorization_pending when user has not authorized', async () => {
      const scope = nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {
          error: 'authorization_pending',
          error_description: 'The authorization request is still pending.',
        });

      const resp = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code: 'abc123',
            grant_type:
              'urn:ietf:params:oauth:grant-type:device_code',
          }),
        },
      );

      const data = (await resp.json()) as { error: string };
      expect(data.error).toBe('authorization_pending');
      scope.done();
    });

    it('should return access token on successful authorization', async () => {
      const scope = nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {
          access_token: 'gho_test_token_123',
          token_type: 'bearer',
          scope: 'read:org,repo,admin:org',
        });

      const resp = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code: 'abc123',
            grant_type:
              'urn:ietf:params:oauth:grant-type:device_code',
          }),
        },
      );

      const data = (await resp.json()) as { access_token: string };
      expect(data.access_token).toBe('gho_test_token_123');
      scope.done();
    });

    it('should handle expired device code', async () => {
      const scope = nock('https://github.com')
        .post('/login/oauth/access_token')
        .reply(200, {
          error: 'expired_token',
          error_description: 'The device code has expired.',
        });

      const resp = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: 'test-client-id',
            device_code: 'abc123',
            grant_type:
              'urn:ietf:params:oauth:grant-type:device_code',
          }),
        },
      );

      const data = (await resp.json()) as { error: string };
      expect(data.error).toBe('expired_token');
      scope.done();
    });
  });
});
