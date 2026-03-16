import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubRepoSettings } from '../../../../../server/data-access-layer/github/repo/get-settings';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';

const REPO_RESPONSE = {
  id: 1,
  name: REPO,
  full_name: `${OWNER}/${REPO}`,
  private: true,
  description: 'A test repository',
  homepage: 'https://example.com',
  has_issues: true,
  has_projects: true,
  has_wiki: true,
  is_template: false,
  default_branch: 'main',
  allow_squash_merge: true,
  allow_merge_commit: true,
  allow_rebase_merge: true,
  allow_auto_merge: false,
  delete_branch_on_merge: true,
  allow_update_branch: false,
  use_squash_pr_title_as_default: false,
  squash_merge_commit_title: 'COMMIT_OR_PR_TITLE',
  squash_merge_commit_message: 'COMMIT_MESSAGES',
  merge_commit_title: 'MERGE_MESSAGE',
  merge_commit_message: 'PR_TITLE',
  archived: false,
  allow_forking: false,
  web_commit_signoff_required: false,
};

describe('getGitHubRepoSettings', () => {
  it('returns repo settings stripped of metadata fields', async () => {
    nock(GITHUB_API).get(`/repos/${OWNER}/${REPO}`).reply(200, REPO_RESPONSE);

    const result = await getGitHubRepoSettings({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        name: REPO,
        description: 'A test repository',
        private: true,
        has_issues: true,
        default_branch: 'main',
        allow_squash_merge: true,
        delete_branch_on_merge: true,
      });
      // Metadata fields should not be present
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('full_name');
    }
  });

  it('returns error when access token is missing', async () => {
    const result = await getGitHubRepoSettings({
      owner: OWNER,
      repo: REPO,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.TOKEN_EXPIRED);
      expect(result.error.message).toContain('re-authenticate');
    }
  });

  it('returns error when repo does not exist (404)', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}`)
      .reply(404, { message: 'Not Found' });

    const result = await getGitHubRepoSettings({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.NOT_FOUND);
      expect(result.error.message).toContain('Error fetching repository settings');
    }
  });

  it('fills in sensible defaults for nullable API fields', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}`)
      .reply(200, {
        ...REPO_RESPONSE,
        description: null,
        homepage: null,
        allow_squash_merge: null,
        allow_merge_commit: null,
        allow_rebase_merge: null,
        allow_auto_merge: null,
        delete_branch_on_merge: null,
        allow_update_branch: null,
        is_template: null,
        has_wiki: null,
        use_squash_pr_title_as_default: null,
      });

    const result = await getGitHubRepoSettings({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        allow_squash_merge: true,
        allow_merge_commit: true,
        allow_rebase_merge: true,
        allow_auto_merge: false,
        delete_branch_on_merge: false,
        is_template: false,
      });
    }
  });

  it('returns error response on GitHub API error', async () => {
    nock(GITHUB_API).get(`/repos/${OWNER}/${REPO}`).reply(422, {
      message: 'Unprocessable Entity',
    });

    const result = await getGitHubRepoSettings({
      owner: OWNER,
      repo: REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.VALIDATION_ERROR);
      expect(result.error.message).toContain('Error fetching repository settings');
    }
  });
});
