import nock from 'nock';
import { describe, expect, it } from 'vitest';
import {
  deleteGitHubRepos,
  deleteSingleRepo,
} from '../../../../../server/data-access-layer/github/repo/delete-repos';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';

describe('deleteSingleRepo', () => {
  it('deletes a repo and returns owner + name on success', async () => {
    nock(GITHUB_API).delete(`/repos/${OWNER}/my-repo`).reply(204);

    const result = await deleteSingleRepo({
      repoToDelete: { owner: OWNER, name: 'my-repo' },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ owner: OWNER, name: 'my-repo' });
    }
  });

  it('returns error when GitHub returns 403 Forbidden', async () => {
    nock(GITHUB_API)
      .delete(`/repos/${OWNER}/protected-repo`)
      .reply(403, { message: 'Must have admin rights to Repository' });

    const result = await deleteSingleRepo({
      repoToDelete: { owner: OWNER, name: 'protected-repo' },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.FORBIDDEN);
      expect(result.error.message).toContain(`${OWNER}/protected-repo`);
    }
  });

  it('returns error when GitHub returns 404 Not Found', async () => {
    nock(GITHUB_API)
      .delete(`/repos/${OWNER}/missing-repo`)
      .reply(404, { message: 'Not Found' });

    const result = await deleteSingleRepo({
      repoToDelete: { owner: OWNER, name: 'missing-repo' },
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.NOT_FOUND);
      expect(result.error.message).toContain(`${OWNER}/missing-repo`);
    }
  });
});

describe('deleteGitHubRepos', () => {
  it('deletes multiple repos and returns all successes', async () => {
    nock(GITHUB_API).delete(`/repos/${OWNER}/repo-a`).reply(204);
    nock(GITHUB_API).delete(`/repos/${OWNER}/repo-b`).reply(204);

    const result = await deleteGitHubRepos({
      owner: OWNER,
      repos: ['repo-a', 'repo-b'],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors).toHaveLength(0);
      expect(result.data.deletedRepos).toHaveLength(2);
      expect(result.data.deletedRepos).toEqual(
        expect.arrayContaining([
          { owner: OWNER, name: 'repo-a' },
          { owner: OWNER, name: 'repo-b' },
        ]),
      );
    }
  });

  it('returns error when access token is missing', async () => {
    const result = await deleteGitHubRepos({
      owner: OWNER,
      repos: ['repo-a'],
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.TOKEN_EXPIRED);
      expect(result.error.message).toContain('re-authenticate');
    }
  });

  it('collects errors for failed deletions alongside successes', async () => {
    nock(GITHUB_API).delete(`/repos/${OWNER}/repo-ok`).reply(204);
    nock(GITHUB_API)
      .delete(`/repos/${OWNER}/repo-fail`)
      .reply(403, { message: 'Forbidden' });

    const result = await deleteGitHubRepos({
      owner: OWNER,
      repos: ['repo-ok', 'repo-fail'],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deletedRepos).toHaveLength(1);
      expect(result.data.deletedRepos[0]).toEqual({ owner: OWNER, name: 'repo-ok' });
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]).toContain('repo-fail');
    }
  });

  it('returns all errors when every deletion fails', async () => {
    nock(GITHUB_API)
      .delete(`/repos/${OWNER}/repo-a`)
      .reply(403, { message: 'Forbidden' });
    nock(GITHUB_API)
      .delete(`/repos/${OWNER}/repo-b`)
      .reply(404, { message: 'Not Found' });

    const result = await deleteGitHubRepos({
      owner: OWNER,
      repos: ['repo-a', 'repo-b'],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deletedRepos).toHaveLength(0);
      expect(result.data.errors).toHaveLength(2);
    }
  });

  it('returns empty results when repos list is empty', async () => {
    const result = await deleteGitHubRepos({
      owner: OWNER,
      repos: [],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ deletedRepos: [], errors: [] });
    }
  });
});
