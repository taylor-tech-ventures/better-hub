import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getGitHubTeamRepos } from '../../../../../server/data-access-layer/github/team/get-team-repos';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const TEAM_SLUG = 'engineers';

const REPO_FIXTURE = {
  id: 42,
  name: 'backend',
  full_name: `${ORG}/backend`,
  private: true,
  role_name: 'push',
  permissions: {
    admin: false,
    maintain: false,
    push: true,
    triage: true,
    pull: true,
  },
};

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

describe('getGitHubTeamRepos', () => {
  it('returns repos accessible to the team', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/repos`)
      .query(true)
      .reply(200, [REPO_FIXTURE]);

    const result = await getGitHubTeamRepos({
      org: ORG,
      teamSlug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 42,
          name: 'backend',
          full_name: `${ORG}/backend`,
          private: true,
          role_name: 'push',
          permissions: {
            admin: false,
            maintain: false,
            push: true,
            triage: true,
            pull: true,
          },
        },
      ],
    });
  });

  it('returns failure when access token is missing', async () => {
    const result = await getGitHubTeamRepos({
      org: ORG,
      teamSlug: TEAM_SLUG,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns failure when team does not exist', async () => {
    mockTeamMissing();

    const result = await getGitHubTeamRepos({
      org: ORG,
      teamSlug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('NOT_FOUND');
  });

  it('returns empty array when team has no repos', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/repos`)
      .query(true)
      .reply(200, []);

    const result = await getGitHubTeamRepos({
      org: ORG,
      teamSlug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('defaults missing permissions fields to false', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/repos`)
      .query(true)
      .reply(200, [{ ...REPO_FIXTURE, permissions: undefined }]);

    const result = await getGitHubTeamRepos({
      org: ORG,
      teamSlug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].permissions).toEqual({
        admin: false,
        maintain: false,
        push: false,
        triage: false,
        pull: false,
      });
    }
  });

  it('returns failure when GitHub API returns an error', async () => {
    mockTeamExists();
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/repos`)
      .query(true)
      .reply(422, { message: 'Unprocessable Entity' });

    const result = await getGitHubTeamRepos({
      org: ORG,
      teamSlug: TEAM_SLUG,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('VALIDATION_ERROR');
    expect(result.success === false && result.error.message).toMatch(
      /Error getting team repositories/,
    );
  });
});
