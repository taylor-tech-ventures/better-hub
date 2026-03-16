import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { createTeam } from '../../../../../server/data-access-layer/github/team/create-team';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const TEAM_NAME = 'new-team';

const CREATED_TEAM_RESPONSE = {
  id: 42,
  slug: 'new-team',
  name: TEAM_NAME,
  description: 'A new team',
  privacy: 'closed',
  html_url: `https://github.com/orgs/${ORG}/teams/new-team`,
};

describe('createTeam', () => {
  it('creates a new team successfully', async () => {
    nock(GITHUB_API)
      .post(`/orgs/${ORG}/teams`)
      .reply(201, CREATED_TEAM_RESPONSE);

    const result = await createTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      name: TEAM_NAME,
      description: 'A new team',
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: 42,
        slug: 'new-team',
        name: TEAM_NAME,
        description: 'A new team',
        privacy: 'closed',
        html_url: `https://github.com/orgs/${ORG}/teams/new-team`,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await createTeam({
      accessToken: undefined,
      org: ORG,
      name: TEAM_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when org does not exist', async () => {
    nock(GITHUB_API)
      .post(`/orgs/${ORG}/teams`)
      .reply(404, { message: 'Not Found' });

    const result = await createTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      name: TEAM_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`creating team "${TEAM_NAME}"`),
      },
    });
  });

  it('returns VALIDATION_ERROR when GitHub returns 422', async () => {
    nock(GITHUB_API)
      .post(`/orgs/${ORG}/teams`)
      .reply(422, { message: 'Validation Failed' });

    const result = await createTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      name: TEAM_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.VALIDATION_ERROR },
    });
  });
});
