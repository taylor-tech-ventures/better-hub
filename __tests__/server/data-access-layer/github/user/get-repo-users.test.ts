import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubRepoUsers } from '../../../../../server/data-access-layer/github/user/get-repo-users';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';

const COLLABORATOR_FIXTURES = [
  {
    login: 'alice',
    html_url: 'https://github.com/alice',
    permissions: { admin: true, push: true, pull: true },
  },
  {
    login: 'bob',
    html_url: 'https://github.com/bob',
    permissions: { admin: false, push: true, pull: true },
  },
];

function mockRepoExists() {
  nock(GITHUB_API).get(`/repos/${OWNER}/${REPO}`).reply(200, { id: 1, name: REPO });
}

function mockRepoMissing() {
  nock(GITHUB_API)
    .get(`/repos/${OWNER}/${REPO}`)
    .reply(404, { message: 'Not Found' });
}

describe('getGitHubRepoUsers', () => {
  it('returns collaborators for an existing repo', async () => {
    mockRepoExists();
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/collaborators`)
      .query(true)
      .reply(200, COLLABORATOR_FIXTURES);

    const result = await getGitHubRepoUsers({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          login: 'alice',
          html_url: 'https://github.com/alice',
          permissions: { admin: true, push: true, pull: true },
        },
        {
          login: 'bob',
          html_url: 'https://github.com/bob',
          permissions: { admin: false, push: true, pull: true },
        },
      ],
    });
  });

  it('returns failure when access token is missing', async () => {
    const result = await getGitHubRepoUsers({
      owner: OWNER,
      repo: REPO,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns failure when repo does not exist', async () => {
    mockRepoMissing();

    const result = await getGitHubRepoUsers({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('NOT_FOUND');
  });

  it('returns empty array when repo has no collaborators', async () => {
    mockRepoExists();
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/collaborators`)
      .query(true)
      .reply(200, []);

    const result = await getGitHubRepoUsers({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns failure when GitHub API returns an error', async () => {
    mockRepoExists();
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/collaborators`)
      .query(true)
      .reply(403, { message: 'Forbidden' });

    const result = await getGitHubRepoUsers({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('FORBIDDEN');
    expect(result.success === false && result.error.message).toMatch(
      /Error fetching repository users/,
    );
  });
});
