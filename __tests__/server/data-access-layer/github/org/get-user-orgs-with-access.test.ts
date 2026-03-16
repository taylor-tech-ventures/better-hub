import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubUserOrgsWithAccess } from '../../../../../server/data-access-layer/github/org/get-user-orgs-with-access';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';

const ORG_FIXTURES = [
  {
    id: 1,
    login: 'authorized-org',
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    url: 'https://api.github.com/orgs/authorized-org',
  },
  {
    id: 2,
    login: 'restricted-org',
    avatar_url: 'https://avatars.githubusercontent.com/u/2',
    url: 'https://api.github.com/orgs/restricted-org',
  },
];

describe('getGitHubUserOrgsWithAccess', () => {
  it('returns failure when access token is missing', async () => {
    const result = await getGitHubUserOrgsWithAccess({ accessToken: undefined });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('marks org as authorized when GET /orgs/{org} returns 200', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, [ORG_FIXTURES[0]]);
    nock(GITHUB_API).get('/orgs/authorized-org').reply(200, {
      login: 'authorized-org',
      id: 1,
    });

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 1,
          login: 'authorized-org',
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
          authorized: true,
        },
      ],
    });
  });

  it('marks org as unauthorized when GET /orgs/{org} returns 403', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, [ORG_FIXTURES[1]]);
    nock(GITHUB_API).get('/orgs/restricted-org').reply(403, {
      message: 'Resource not accessible by integration',
    });

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 2,
          login: 'restricted-org',
          avatar_url: 'https://avatars.githubusercontent.com/u/2',
          authorized: false,
        },
      ],
    });
  });

  it('marks org as unauthorized when GET /orgs/{org} returns 404', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, [ORG_FIXTURES[0]]);
    nock(GITHUB_API).get('/orgs/authorized-org').reply(404, {
      message: 'Not Found',
    });

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        expect.objectContaining({ login: 'authorized-org', authorized: false }),
      ]);
    }
  });

  it('handles mixed authorized and unauthorized orgs', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, ORG_FIXTURES);
    nock(GITHUB_API).get('/orgs/authorized-org').reply(200, { login: 'authorized-org', id: 1 });
    nock(GITHUB_API).get('/orgs/restricted-org').reply(403, {
      message: 'Resource not accessible by integration',
    });

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data.find((o) => o.login === 'authorized-org')).toMatchObject({ authorized: true });
      expect(result.data.find((o) => o.login === 'restricted-org')).toMatchObject({ authorized: false });
    }
  });

  it('returns empty array when user has no orgs', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, []);

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('propagates error when org list fetch fails', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(401, {
      message: 'Bad credentials',
    });

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).toMatch(
      /Error listing organizations/,
    );
  });

  it('treats unexpected error status as unauthorized rather than throwing', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, [ORG_FIXTURES[0]]);
    nock(GITHUB_API).get('/orgs/authorized-org').reply(422, {
      message: 'Unprocessable Entity',
    });

    const result = await getGitHubUserOrgsWithAccess({
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        expect.objectContaining({ login: 'authorized-org', authorized: false }),
      ]);
    }
  });
});
