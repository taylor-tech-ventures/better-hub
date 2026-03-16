import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubOrgTeams } from '../../../../../server/data-access-layer/github/org/get-org-teams';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';

const TEAM_FIXTURE = {
  id: 7,
  name: 'Engineering',
  slug: 'engineering',
  description: 'Engineering team',
  privacy: 'closed',
  permission: 'push',
  html_url: 'https://github.com/orgs/test-org/teams/engineering',
  parent: null,
};

const CHILD_TEAM_FIXTURE = {
  id: 8,
  name: 'Frontend',
  slug: 'frontend',
  description: 'Frontend sub-team',
  privacy: 'closed',
  permission: 'push',
  html_url: 'https://github.com/orgs/test-org/teams/frontend',
  parent: { id: 7, name: 'Engineering' },
};

function mockOrgAccess(org = ORG) {
  nock(GITHUB_API)
    .get('/user/orgs')
    .query(true)
    .reply(200, [{ login: org, id: 1 }]);
}

describe('getGitHubOrgTeams', () => {
  it('returns mapped teams for a valid org', async () => {
    mockOrgAccess();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams`)
      .query(true)
      .reply(200, [TEAM_FIXTURE]);

    const result = await getGitHubOrgTeams({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 7,
          name: 'Engineering',
          slug: 'engineering',
          description: 'Engineering team',
          privacy: 'closed',
          permission: 'push',
          html_url: 'https://github.com/orgs/test-org/teams/engineering',
          parent_team: undefined,
        },
      ],
    });
  });

  it('includes parent team name for child teams', async () => {
    mockOrgAccess();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams`)
      .query(true)
      .reply(200, [CHILD_TEAM_FIXTURE]);

    const result = await getGitHubOrgTeams({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].parent_team).toBe('Engineering');
    }
  });

  it('returns failure when access token is missing', async () => {
    const result = await getGitHubOrgTeams({ org: ORG, accessToken: undefined });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns failure when user does not have access to org', async () => {
    nock(GITHUB_API).get('/user/orgs').query(true).reply(200, []);

    const result = await getGitHubOrgTeams({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('NOT_FOUND');
  });

  it('returns empty array when org has no teams', async () => {
    mockOrgAccess();
    nock(GITHUB_API).get(`/orgs/${ORG}/teams`).query(true).reply(200, []);

    const result = await getGitHubOrgTeams({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns failure when GitHub API returns an error', async () => {
    mockOrgAccess();
    nock(GITHUB_API).get(`/orgs/${ORG}/teams`).query(true).reply(403, {
      message: 'Forbidden',
    });

    const result = await getGitHubOrgTeams({ org: ORG, accessToken: ACCESS_TOKEN });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).toMatch(
      /Error listing organization teams/,
    );
  });
});
