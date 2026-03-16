import nock from 'nock';
import { describe, expect, it } from 'vitest';
import {
  githubExistsRequest,
  githubOrgAccessCheck,
} from '../../../../server/data-access-layer/github/utils';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';

describe('githubExistsRequest', () => {
  describe('repo', () => {
    it('returns true when repo exists', async () => {
      nock(GITHUB_API)
        .get('/repos/my-org/my-repo')
        .reply(200, { id: 1, name: 'my-repo' });

      const result = await githubExistsRequest(
        'repo',
        { owner: 'my-org', repo: 'my-repo' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('returns false when repo does not exist (404)', async () => {
      nock(GITHUB_API).get('/repos/my-org/missing-repo').reply(404, {
        message: 'Not Found',
      });

      const result = await githubExistsRequest(
        'repo',
        { owner: 'my-org', repo: 'missing-repo' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });

    it('returns false on API error', async () => {
      nock(GITHUB_API).get('/repos/my-org/broken-repo').reply(422, {
        message: 'Unprocessable Entity',
      });

      const result = await githubExistsRequest(
        'repo',
        { owner: 'my-org', repo: 'broken-repo' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });
  });

  describe('team', () => {
    it('returns true when team exists', async () => {
      nock(GITHUB_API)
        .get('/orgs/my-org/teams/my-team')
        .reply(200, { id: 1, slug: 'my-team' });

      const result = await githubExistsRequest(
        'team',
        { org: 'my-org', team_slug: 'my-team' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('returns false when team does not exist (404)', async () => {
      nock(GITHUB_API)
        .get('/orgs/my-org/teams/missing-team')
        .reply(404, { message: 'Not Found' });

      const result = await githubExistsRequest(
        'team',
        { org: 'my-org', team_slug: 'missing-team' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });
  });

  describe('user', () => {
    it('returns true when user exists', async () => {
      nock(GITHUB_API)
        .get('/users/octocat')
        .reply(200, { id: 1, login: 'octocat' });

      const result = await githubExistsRequest(
        'user',
        { username: 'octocat' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('returns false when user does not exist', async () => {
      nock(GITHUB_API)
        .get('/users/ghost-user-xyz')
        .reply(404, { message: 'Not Found' });

      const result = await githubExistsRequest(
        'user',
        { username: 'ghost-user-xyz' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });
  });

  describe('branch', () => {
    it('returns true when branch exists', async () => {
      nock(GITHUB_API)
        .get('/repos/my-org/my-repo/branches/main')
        .reply(200, { name: 'main' });

      const result = await githubExistsRequest(
        'branch',
        { owner: 'my-org', repo: 'my-repo', branch: 'main' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('returns false when branch does not exist', async () => {
      nock(GITHUB_API)
        .get('/repos/my-org/my-repo/branches/nonexistent')
        .reply(404, { message: 'Branch not found' });

      const result = await githubExistsRequest(
        'branch',
        { owner: 'my-org', repo: 'my-repo', branch: 'nonexistent' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });
  });

  describe('team-repo-access', () => {
    it('returns true when team has access to repo', async () => {
      nock(GITHUB_API)
        .get('/orgs/my-org/teams/my-team/repos/my-org/my-repo')
        .reply(200, { id: 1, name: 'my-repo' });

      const result = await githubExistsRequest(
        'team-repo-access',
        {
          org: 'my-org',
          team_slug: 'my-team',
          owner: 'my-org',
          repo: 'my-repo',
        },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('returns false when team does not have access', async () => {
      nock(GITHUB_API)
        .get('/orgs/my-org/teams/my-team/repos/my-org/my-repo')
        .reply(404, { message: 'Not Found' });

      const result = await githubExistsRequest(
        'team-repo-access',
        {
          org: 'my-org',
          team_slug: 'my-team',
          owner: 'my-org',
          repo: 'my-repo',
        },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });
  });

  describe('org', () => {
    it('returns true when user belongs to org', async () => {
      nock(GITHUB_API)
        .get('/user/orgs')
        .query(true)
        .reply(200, [{ login: 'my-org', id: 1 }]);

      const result = await githubExistsRequest(
        'org',
        { org: 'my-org' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('is case-insensitive when matching org name', async () => {
      nock(GITHUB_API)
        .get('/user/orgs')
        .query(true)
        .reply(200, [{ login: 'My-Org', id: 1 }]);

      const result = await githubExistsRequest(
        'org',
        { org: 'my-org' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(true);
    });

    it('returns false when user does not belong to org', async () => {
      nock(GITHUB_API)
        .get('/user/orgs')
        .query(true)
        .reply(200, [{ login: 'other-org', id: 2 }]);

      const result = await githubExistsRequest(
        'org',
        { org: 'my-org' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });

    it('returns false when orgs list is empty', async () => {
      nock(GITHUB_API).get('/user/orgs').query(true).reply(200, []);

      const result = await githubExistsRequest(
        'org',
        { org: 'my-org' },
        ACCESS_TOKEN,
      );
      expect(result).toBe(false);
    });
  });
});

describe('githubOrgAccessCheck', () => {
  it('returns true when org is in user org list', async () => {
    nock(GITHUB_API)
      .get('/user/orgs')
      .query(true)
      .reply(200, [
        { login: 'org-a', id: 1 },
        { login: 'org-b', id: 2 },
      ]);

    const result = await githubOrgAccessCheck('org-b', ACCESS_TOKEN);
    expect(result).toBe(true);
  });

  it('returns false when org is not in user org list', async () => {
    nock(GITHUB_API)
      .get('/user/orgs')
      .query(true)
      .reply(200, [{ login: 'org-a', id: 1 }]);

    const result = await githubOrgAccessCheck('org-b', ACCESS_TOKEN);
    expect(result).toBe(false);
  });

  it('returns false when the user orgs fetch fails', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(401, {
      message: 'Bad credentials',
    });

    const result = await githubOrgAccessCheck('my-org', ACCESS_TOKEN);
    expect(result).toBe(false);
  });
});
