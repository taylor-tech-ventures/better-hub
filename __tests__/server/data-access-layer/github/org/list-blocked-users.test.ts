import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listBlockedUsers } from '../../../../../server/data-access-layer/github/org/list-blocked-users';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';

const BLOCKED_USER_FIXTURES = [
  {
    login: 'blocked-user-1',
    id: 101,
    avatar_url: 'https://avatars.githubusercontent.com/u/101',
  },
  {
    login: 'blocked-user-2',
    id: 102,
    avatar_url: 'https://avatars.githubusercontent.com/u/102',
  },
];

describe('listBlockedUsers', () => {
  it('returns blocked users for an organization', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/blocks`)
      .query(true)
      .reply(200, BLOCKED_USER_FIXTURES);

    const result = await listBlockedUsers({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toEqual({
      success: true,
      data: BLOCKED_USER_FIXTURES,
    });
  });

  it('returns empty array when no users are blocked', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/blocks`)
      .query(true)
      .reply(200, []);

    const result = await listBlockedUsers({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listBlockedUsers({
      accessToken: undefined,
      org: ORG,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 403', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/blocks`)
      .query(true)
      .reply(403, { message: 'Forbidden' });

    const result = await listBlockedUsers({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.FORBIDDEN,
        message: expect.stringContaining(ORG),
      },
    });
  });
});
