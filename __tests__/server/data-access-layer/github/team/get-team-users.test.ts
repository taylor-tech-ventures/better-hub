import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubTeamUsers } from '../../../../../server/data-access-layer/github/team/get-team-users';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const TEAM_SLUG = 'engineers';

const MEMBER_FIXTURES = [
  { id: 10, login: 'alice', name: 'Alice' },
  { id: 11, login: 'bob', name: 'Bob' },
];

function mockTeamExists() {
  nock(GITHUB_API)
    .get(`/orgs/${ORG}/teams/${TEAM_SLUG}`)
    .reply(200, { id: 1, slug: TEAM_SLUG });
}

function mockTeamMissing() {
  nock(GITHUB_API)
    .get(`/orgs/${ORG}/teams/${TEAM_SLUG}`)
    .reply(404, { message: 'Not Found' });
}

function mockMembership(username: string, role: string) {
  nock(GITHUB_API)
    .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/memberships/${username}`)
    .reply(200, { role, state: 'active' });
}

describe('getGitHubTeamUsers', () => {
  it('returns team members with their roles', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/members`)
      .query(true)
      .reply(200, MEMBER_FIXTURES);
    mockMembership('alice', 'maintainer');
    mockMembership('bob', 'member');

    const result = await getGitHubTeamUsers({
      org: ORG,
      team_slug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      success: true,
      data: [
        { id: 10, login: 'alice', name: 'Alice', role: 'maintainer' },
        { id: 11, login: 'bob', name: 'Bob', role: 'member' },
      ],
    });
  });

  it('returns failure when access token is missing', async () => {
    const result = await getGitHubTeamUsers({
      org: ORG,
      team_slug: TEAM_SLUG,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns failure when team does not exist', async () => {
    mockTeamMissing();

    const result = await getGitHubTeamUsers({
      org: ORG,
      team_slug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('NOT_FOUND');
  });

  it('returns empty array when team has no members', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/members`)
      .query(true)
      .reply(200, []);

    const result = await getGitHubTeamUsers({
      org: ORG,
      team_slug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('defaults role to "member" when membership fetch fails', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/members`)
      .query(true)
      .reply(200, [{ id: 10, login: 'alice', name: 'Alice' }]);
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/memberships/alice`)
      .reply(404, { message: 'Not Found' });

    const result = await getGitHubTeamUsers({
      org: ORG,
      team_slug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      success: true,
      data: [{ id: 10, login: 'alice', name: 'Alice', role: 'member' }],
    });
  });

  it('returns failure when GitHub API returns an error', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/members`)
      .query(true)
      .reply(422, { message: 'Unprocessable Entity' });

    const result = await getGitHubTeamUsers({
      org: ORG,
      team_slug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).toMatch(
      /Error fetching team users/,
    );
  });
});
