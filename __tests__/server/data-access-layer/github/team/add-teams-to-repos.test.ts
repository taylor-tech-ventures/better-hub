import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { addGitHubTeamsToRepos } from '../../../../../server/data-access-layer/github/team/add-teams-to-repos';

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

function mockTeamExists(team: string) {
  nock(GITHUB_API)
    .get(`/orgs/${OWNER}/teams/${team}`)
    .reply(200, { id: 1, slug: team });
}

function mockTeamMissing(team: string) {
  nock(GITHUB_API)
    .get(`/orgs/${OWNER}/teams/${team}`)
    .reply(404, { message: 'Not Found' });
}

describe('addGitHubTeamsToRepos', () => {
  it('adds a team to a repo and returns success', async () => {
    mockRepoExists('repo-a');
    mockTeamExists('dev-team');
    nock(GITHUB_API)
      .put(`/orgs/${OWNER}/teams/dev-team/repos/${OWNER}/repo-a`)
      .reply(204);

    const result = await addGitHubTeamsToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      teams: [{ name: 'dev-team', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors).toHaveLength(0);
      expect(result.data.addedTeams).toEqual([{ repo: 'repo-a', team: 'dev-team' }]);
    }
  });

  it('returns failure when access token is missing', async () => {
    const result = await addGitHubTeamsToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      teams: [{ name: 'dev-team', permission: 'push' }],
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('collects error when repo does not exist', async () => {
    mockRepoMissing('missing-repo');
    mockTeamExists('dev-team');

    const result = await addGitHubTeamsToRepos({
      owner: OWNER,
      repos: ['missing-repo'],
      teams: [{ name: 'dev-team', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedTeams).toHaveLength(0);
      expect(result.data.errors).toContain(
        `Error: repository ${OWNER}/missing-repo does not exist`,
      );
    }
  });

  it('collects error when team does not exist', async () => {
    mockRepoExists('repo-a');
    mockTeamMissing('missing-team');

    const result = await addGitHubTeamsToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      teams: [{ name: 'missing-team', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedTeams).toHaveLength(0);
      expect(result.data.errors).toContain(
        `Error: team missing-team does not exist in organization ${OWNER}`,
      );
    }
  });

  it('handles multiple repos and teams, skipping invalid ones', async () => {
    mockRepoExists('repo-a');
    mockRepoMissing('missing-repo');
    mockTeamExists('team-x');
    nock(GITHUB_API)
      .put(`/orgs/${OWNER}/teams/team-x/repos/${OWNER}/repo-a`)
      .reply(204);

    const result = await addGitHubTeamsToRepos({
      owner: OWNER,
      repos: ['repo-a', 'missing-repo'],
      teams: [{ name: 'team-x', permission: 'pull' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedTeams).toEqual([{ repo: 'repo-a', team: 'team-x' }]);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]).toContain('missing-repo');
    }
  });

  it('collects API error when PUT request fails', async () => {
    mockRepoExists('repo-a');
    mockTeamExists('dev-team');
    nock(GITHUB_API)
      .put(`/orgs/${OWNER}/teams/dev-team/repos/${OWNER}/repo-a`)
      .reply(422, { message: 'Validation Failed' });

    const result = await addGitHubTeamsToRepos({
      owner: OWNER,
      repos: ['repo-a'],
      teams: [{ name: 'dev-team', permission: 'push' }],
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addedTeams).toHaveLength(0);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0]).toContain('dev-team');
      expect(result.data.errors[0]).toContain('repo-a');
    }
  });
});
