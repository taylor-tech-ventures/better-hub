import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { updateTeam } from '../../../../../server/data-access-layer/github/team/update-team';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const TEAM_SLUG = 'my-team';

const UPDATED_TEAM_RESPONSE = {
  id: 42,
  slug: TEAM_SLUG,
  name: 'Updated Team Name',
  description: 'Updated description',
  privacy: 'secret',
  html_url: `https://github.com/orgs/${ORG}/teams/${TEAM_SLUG}`,
};

describe('updateTeam', () => {
  it('updates a team successfully', async () => {
    nock(GITHUB_API)
      .patch(`/orgs/${ORG}/teams/${TEAM_SLUG}`)
      .reply(200, UPDATED_TEAM_RESPONSE);

    const result = await updateTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
      name: 'Updated Team Name',
      description: 'Updated description',
      privacy: 'secret',
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: 42,
        slug: TEAM_SLUG,
        name: 'Updated Team Name',
        description: 'Updated description',
        privacy: 'secret',
        html_url: `https://github.com/orgs/${ORG}/teams/${TEAM_SLUG}`,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await updateTeam({
      accessToken: undefined,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when team does not exist', async () => {
    nock(GITHUB_API)
      .patch(`/orgs/${ORG}/teams/${TEAM_SLUG}`)
      .reply(404, { message: 'Not Found' });

    const result = await updateTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
      name: 'New Name',
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`updating team "${TEAM_SLUG}"`),
      },
    });
  });
});
