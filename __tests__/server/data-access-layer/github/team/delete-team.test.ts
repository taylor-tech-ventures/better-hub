import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { deleteTeam } from '../../../../../server/data-access-layer/github/team/delete-team';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const TEAM_SLUG = 'my-team';

describe('deleteTeam', () => {
  it('deletes a team successfully', async () => {
    nock(GITHUB_API)
      .delete(`/orgs/${ORG}/teams/${TEAM_SLUG}`)
      .reply(204);

    const result = await deleteTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toEqual({ success: true, data: { deleted: true } });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await deleteTeam({
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
      .delete(`/orgs/${ORG}/teams/${TEAM_SLUG}`)
      .reply(404, { message: 'Not Found' });

    const result = await deleteTeam({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`deleting team "${TEAM_SLUG}"`),
      },
    });
  });
});
