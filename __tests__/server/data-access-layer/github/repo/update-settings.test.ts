import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { updateGitHubRepoSettings } from '../../../../../server/data-access-layer/github/repo/update-settings';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';

function mockRepoExists(repo: string) {
  nock(GITHUB_API).get(`/repos/${OWNER}/${repo}`).reply(200, { id: 1, name: repo });
}

function mockRepoMissing(repo: string) {
  nock(GITHUB_API)
    .get(`/repos/${OWNER}/${repo}`)
    .reply(404, { message: 'Not Found' });
}

describe('updateGitHubRepoSettings', () => {
  it('updates a single repo and returns success result', async () => {
    mockRepoExists('repo-a');
    nock(GITHUB_API).patch(`/repos/${OWNER}/repo-a`).reply(200, {
      id: 1,
      name: 'repo-a',
    });

    const result = await updateGitHubRepoSettings({
      owner: OWNER,
      repos: ['repo-a'],
      settings: { has_issues: false, delete_branch_on_merge: true },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        {
          repo: 'repo-a',
          success: true,
          updated_fields: expect.arrayContaining(['has_issues', 'delete_branch_on_merge']),
        },
      ]);
    }
  });

  it('returns error when access token is missing', async () => {
    const result = await updateGitHubRepoSettings({
      owner: OWNER,
      repos: ['repo-a'],
      settings: { has_issues: false },
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.TOKEN_EXPIRED);
      expect(result.error.message).toContain('re-authenticate');
    }
  });

  it('returns per-repo error when repo does not exist', async () => {
    mockRepoMissing('missing-repo');

    const result = await updateGitHubRepoSettings({
      owner: OWNER,
      repos: ['missing-repo'],
      settings: { has_issues: false },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        {
          repo: 'missing-repo',
          success: false,
          error: `Repository ${OWNER}/missing-repo does not exist`,
        },
      ]);
    }
  });

  it('returns per-repo error when no valid settings are provided', async () => {
    mockRepoExists('repo-a');

    const result = await updateGitHubRepoSettings({
      owner: OWNER,
      repos: ['repo-a'],
      settings: {},
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        {
          repo: 'repo-a',
          success: false,
          error: 'No valid settings provided',
        },
      ]);
    }
  });

  it('processes multiple repos independently', async () => {
    mockRepoExists('repo-a');
    nock(GITHUB_API).patch(`/repos/${OWNER}/repo-a`).reply(200, { id: 1 });
    mockRepoMissing('repo-missing');

    const result = await updateGitHubRepoSettings({
      owner: OWNER,
      repos: ['repo-a', 'repo-missing'],
      settings: { has_issues: false },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data.find((r) => r.repo === 'repo-a')?.success).toBe(true);
      expect(result.data.find((r) => r.repo === 'repo-missing')?.success).toBe(false);
    }
  });

  it('records error per repo when GitHub API returns an error', async () => {
    mockRepoExists('repo-a');
    nock(GITHUB_API)
      .patch(`/repos/${OWNER}/repo-a`)
      .reply(422, { message: 'Validation Failed' });

    const result = await updateGitHubRepoSettings({
      owner: OWNER,
      repos: ['repo-a'],
      settings: { has_issues: false },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].success).toBe(false);
      expect(result.data[0].error).toContain('Error updating repository settings');
    }
  });
});
