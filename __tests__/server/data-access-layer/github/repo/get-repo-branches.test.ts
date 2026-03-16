import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubRepoBranches } from '../../../../../server/data-access-layer/github/repo/get-repo-branches';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const REPO = 'my-repo';

const BRANCH_FIXTURES = [
  { name: 'main', protected: true, commit: { sha: 'abc123', url: '' } },
  { name: 'develop', protected: false, commit: { sha: 'def456', url: '' } },
];

function mockRepoExists() {
  nock(GITHUB_API).get(`/repos/${ORG}/${REPO}`).reply(200, { id: 1, name: REPO });
}

function mockRepoMissing() {
  nock(GITHUB_API)
    .get(`/repos/${ORG}/${REPO}`)
    .reply(404, { message: 'Not Found' });
}

describe('getGitHubRepoBranches', () => {
  it('returns branches for an existing repo', async () => {
    mockRepoExists();
    nock(GITHUB_API)
      .get(`/repos/${ORG}/${REPO}/branches`)
      .query(true)
      .reply(200, BRANCH_FIXTURES);

    const result = await getGitHubRepoBranches({
      org: ORG,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(BRANCH_FIXTURES);
    }
  });

  it('returns error when access token is missing', async () => {
    const result = await getGitHubRepoBranches({
      org: ORG,
      repo: REPO,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.TOKEN_EXPIRED);
      expect(result.error.message).toContain('re-authenticate');
    }
  });

  it('returns error when repo does not exist', async () => {
    mockRepoMissing();

    const result = await getGitHubRepoBranches({
      org: ORG,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.NOT_FOUND);
      expect(result.error.message).toContain('does not exist');
    }
  });

  it('returns empty array when repo has no branches', async () => {
    mockRepoExists();
    nock(GITHUB_API)
      .get(`/repos/${ORG}/${REPO}/branches`)
      .query(true)
      .reply(200, []);

    const result = await getGitHubRepoBranches({
      org: ORG,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('returns error when GitHub API returns an error', async () => {
    mockRepoExists();
    nock(GITHUB_API)
      .get(`/repos/${ORG}/${REPO}/branches`)
      .query(true)
      .reply(403, { message: 'Forbidden' });

    const result = await getGitHubRepoBranches({
      org: ORG,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.FORBIDDEN);
      expect(result.error.message).toContain('Error fetching branches');
    }
  });
});
