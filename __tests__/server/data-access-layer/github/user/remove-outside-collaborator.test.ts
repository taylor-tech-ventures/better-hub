import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { removeOutsideCollaborator } from '../../../../../server/data-access-layer/github/user/remove-outside-collaborator';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const USERNAME = 'outside-user';

describe('removeOutsideCollaborator', () => {
  it('removes an outside collaborator successfully', async () => {
    nock(GITHUB_API)
      .delete(`/orgs/${ORG}/outside_collaborators/${USERNAME}`)
      .reply(204);

    const result = await removeOutsideCollaborator({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      username: USERNAME,
    });

    expect(result).toEqual({ success: true, data: { removed: true } });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await removeOutsideCollaborator({
      accessToken: undefined,
      org: ORG,
      username: USERNAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when user is not an outside collaborator', async () => {
    nock(GITHUB_API)
      .delete(`/orgs/${ORG}/outside_collaborators/${USERNAME}`)
      .reply(404, { message: 'Not Found' });

    const result = await removeOutsideCollaborator({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      username: USERNAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`removing outside collaborator ${USERNAME}`),
      },
    });
  });
});
