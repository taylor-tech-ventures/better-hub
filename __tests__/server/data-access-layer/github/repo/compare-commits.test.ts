import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { compareCommits } from '../../../../../server/data-access-layer/github/repo/compare-commits';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';
const BASE = 'main';
const HEAD = 'feature-branch';

const COMPARISON_RESPONSE = {
  status: 'ahead',
  ahead_by: 2,
  behind_by: 0,
  total_commits: 2,
  commits: [
    {
      sha: 'abc123',
      commit: { message: 'feat: add feature' },
      author: { login: 'octocat' },
    },
    {
      sha: 'def456',
      commit: { message: 'fix: bug fix' },
      author: { login: 'octocat' },
    },
  ],
  files: [
    {
      filename: 'src/index.ts',
      status: 'modified',
      additions: 10,
      deletions: 2,
      changes: 12,
    },
  ],
};

describe('compareCommits', () => {
  it('returns comparison between two commits', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/compare/${BASE}...${HEAD}`)
      .reply(200, COMPARISON_RESPONSE);

    const result = await compareCommits({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      base: BASE,
      head: HEAD,
    });

    expect(result).toEqual({
      success: true,
      data: {
        status: 'ahead',
        ahead_by: 2,
        behind_by: 0,
        total_commits: 2,
        commits: [
          { sha: 'abc123', message: 'feat: add feature', author: { login: 'octocat' } },
          { sha: 'def456', message: 'fix: bug fix', author: { login: 'octocat' } },
        ],
        files: [
          { filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 2, changes: 12 },
        ],
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await compareCommits({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      base: BASE,
      head: HEAD,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 404', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/compare/${BASE}...${HEAD}`)
      .reply(404, { message: 'Not Found' });

    const result = await compareCommits({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      base: BASE,
      head: HEAD,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`${BASE}...${HEAD}`),
      },
    });
  });
});
