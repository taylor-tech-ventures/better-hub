import nock from 'nock';
import { describe, expect, it } from 'vitest';
import {
  addGitHubUsersToRepos,
  addUserToRepo,
} from '../../../../../server/data-access-layer/github/user/add-users-to-repos';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';

function mockRepoExists(repo: string) {
  nock(GITHUB_API)
    .get(`/repos/${OWNER}/${repo}`)
    .reply(200, { id: 1, name: repo });
}

function mockRepoMissing(repo: string) {
  nock(GITHUB_API)
    .get(`/repos/${OWNER}/${repo}`)
    .reply(404, { message: 'Not Found' });
}

function mockUserExists(username: string) {
  nock(GITHUB_API)
    .get(`/users/${username}`)
    .reply(200, { id: 1, login: username });
}

function mockUserMissing(username: string) {
  nock(GITHUB_API)
    .get(`/users/${username}`)
    .reply(404, { message: 'Not Found' });
}

describe('addUserToRepo', () => {
  it('adds a collaborator and returns repo and username', async () => {
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/alice`)
      .reply(201, {});

    const result = await addUserToRepo({
      repo: 'repo-a',
      user: { username: 'alice', permission: 'push' },
      owner: OWNER,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ success: true, data: { repo: 'repo-a', username: 'alice' } });
  });

  it('also succeeds when GitHub returns 204 (already a collaborator)', async () => {
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/alice`)
      .reply(204);

    const result = await addUserToRepo({
      repo: 'repo-a',
      user: { username: 'alice', permission: 'push' },
      owner: OWNER,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ success: true, data: { repo: 'repo-a', username: 'alice' } });
  });

  it('returns failure when GitHub returns an error', async () => {
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/alice`)
      .reply(422, { message: 'Validation Failed' });

    const result = await addUserToRepo({
      repo: 'repo-a',
      user: { username: 'alice', permission: 'push' },
      owner: OWNER,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).toMatch(
      /Error adding user alice to repo/,
    );
  });
});

describe('addGitHubUsersToRepos', () => {
  it('adds valid users to valid repos and returns successes', async () => {
    mockRepoExists('repo-a');
    mockUserExists('alice');
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/alice`)
      .reply(201, {});

    const result = await addGitHubUsersToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      users: [{ username: 'alice', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors).toHaveLength(0);
      expect(result.data.addedUsers).toEqual([{ repo: 'repo-a', username: 'alice' }]);
    }
  });

  it('returns failure when access token is missing', async () => {
    const result = await addGitHubUsersToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      users: [{ username: 'alice', permission: 'push' }],
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('collects error when repo does not exist', async () => {
    mockRepoMissing('missing-repo');
    mockUserExists('alice');

    const result = await addGitHubUsersToRepos({
      owner: OWNER,
      repos: ['missing-repo'],
      users: [{ username: 'alice', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedUsers).toHaveLength(0);
      expect(result.data.errors).toContain(
        `Error: repository ${OWNER}/missing-repo does not exist`,
      );
    }
  });

  it('collects error when user does not exist', async () => {
    mockRepoExists('repo-a');
    mockUserMissing('ghost-user');

    const result = await addGitHubUsersToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      users: [{ username: 'ghost-user', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedUsers).toHaveLength(0);
      expect(result.data.errors).toContain('Error: user ghost-user does not exist');
    }
  });

  it('handles multiple repos and users, skipping invalid combinations', async () => {
    mockRepoExists('repo-a');
    mockRepoMissing('repo-missing');
    mockUserExists('alice');
    mockUserExists('bob');
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/alice`)
      .reply(201, {});
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/bob`)
      .reply(201, {});

    const result = await addGitHubUsersToRepos({
      owner: OWNER,
      repos: ['repo-a', 'repo-missing'],
      users: [
        { username: 'alice', permission: 'push' },
        { username: 'bob', permission: 'pull' },
      ],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedUsers).toHaveLength(2);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]).toContain('repo-missing');
    }
  });

  it('collects API error when PUT request fails', async () => {
    mockRepoExists('repo-a');
    mockUserExists('alice');
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/repo-a/collaborators/alice`)
      .reply(403, { message: 'Forbidden' });

    const result = await addGitHubUsersToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      users: [{ username: 'alice', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedUsers).toHaveLength(0);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]).toContain('alice');
      expect(result.data.errors[0]).toContain('repo-a');
    }
  });
});
