import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubUserOrgs } from '../../../../../server/data-access-layer/github/org/get-user-orgs';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';

const ORG_FIXTURES = [
  { id: 1, login: 'org-one', url: 'https://api.github.com/orgs/org-one' },
  { id: 2, login: 'org-two', url: 'https://api.github.com/orgs/org-two' },
];

describe('getGitHubUserOrgs', () => {
  it('returns organizations for an authenticated user', async () => {
    nock(GITHUB_API)
      .get('/user/orgs')
      .query(true)
      .reply(200, ORG_FIXTURES);

    const result = await getGitHubUserOrgs({ accessToken: ACCESS_TOKEN });
    expect(result).toEqual({ success: true, data: ORG_FIXTURES });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await getGitHubUserOrgs({ accessToken: undefined });
    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns empty array when user has no orgs', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, []);

    const result = await getGitHubUserOrgs({ accessToken: ACCESS_TOKEN });
    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when GitHub returns 401 Unauthorized', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(401, {
      message: 'Bad credentials',
    });

    const result = await getGitHubUserOrgs({ accessToken: ACCESS_TOKEN });
    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.TOKEN_EXPIRED,
        message: expect.stringContaining('listing organizations'),
      },
    });
  });

  it('returns VALIDATION_ERROR when GitHub returns 422', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(422, {
      message: 'Unprocessable Entity',
    });

    const result = await getGitHubUserOrgs({ accessToken: ACCESS_TOKEN });
    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.VALIDATION_ERROR },
    });
  });

  it('handles paginated results across multiple pages', async () => {
    const page1 = [{ id: 1, login: 'org-one' }];
    const page2 = [{ id: 2, login: 'org-two' }];

    nock(GITHUB_API)
      .get('/user/orgs')
      .query(true)
      .reply(200, page1, {
        Link: '<https://api.github.com/user/orgs?page=2>; rel="next"',
      });

    nock(GITHUB_API)
      .get('/user/orgs')
      .query(true)
      .reply(200, page2);

    const result = await getGitHubUserOrgs({ accessToken: ACCESS_TOKEN });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(2);
    }
  });
});
