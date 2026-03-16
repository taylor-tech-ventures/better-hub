import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubOrgRepos } from '../../../../../server/data-access-layer/github/org/get-org-repos';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';

const REPO_FIXTURE = {
  id: 42,
  name: 'my-repo',
  full_name: 'test-org/my-repo',
  owner: { login: 'test-org', id: 1 },
  private: false,
  description: 'A test repo',
  html_url: 'https://github.com/test-org/my-repo',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-06-01T00:00:00Z',
};

function mockOrgAccess(org = ORG) {
  nock(GITHUB_API)
    .get('/user/orgs')
    .query(true)
    .reply(200, [{ login: org, id: 1 }]);
}

function mockNoOrgAccess() {
  nock(GITHUB_API).get('/user/orgs').query(true).reply(200, []);
}

describe('getGitHubOrgRepos', () => {
  it('returns mapped repos for a valid org', async () => {
    mockOrgAccess();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/repos`)
      .query(true)
      .reply(200, [REPO_FIXTURE]);

    const result = await getGitHubOrgRepos({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 42,
          name: 'my-repo',
          full_name: 'test-org/my-repo',
          owner: 'test-org',
          private: false,
          description: 'A test repo',
          html_url: 'https://github.com/test-org/my-repo',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-06-01T00:00:00Z',
        },
      ],
    });
  });

  it('returns failure when access token is missing', async () => {
    const result = await getGitHubOrgRepos({ org: ORG, accessToken: undefined });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns failure when user does not have access to org', async () => {
    mockNoOrgAccess();

    const result = await getGitHubOrgRepos({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('NOT_FOUND');
  });

  it('returns empty array when org has no repos', async () => {
    mockOrgAccess();
    nock(GITHUB_API).get(`/orgs/${ORG}/repos`).query(true).reply(200, []);

    const result = await getGitHubOrgRepos({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result).toEqual({ success: true, data: [] });
  });

  it('passes sort and direction parameters to GitHub API', async () => {
    mockOrgAccess();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/repos`)
      .query({ sort: 'updated', direction: 'desc', per_page: '100' })
      .reply(200, [REPO_FIXTURE]);

    const result = await getGitHubOrgRepos({
      org: ORG,
      sort: 'updated',
      direction: 'desc',
      accessToken: ACCESS_TOKEN,
    });
    expect(result.success).toBe(true);
  });

  it('returns failure when GitHub API returns an error', async () => {
    mockOrgAccess();
    nock(GITHUB_API).get(`/orgs/${ORG}/repos`).query(true).reply(403, {
      message: 'Forbidden',
    });

    const result = await getGitHubOrgRepos({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).toMatch(
      /Error listing organization repositories/,
    );
  });
});
