import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { setRepoPermission } from '../../../../../server/data-access-layer/github/user/set-repo-permission';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';
const USERNAME = 'some-user';

describe('setRepoPermission', () => {
  it('sets permission for a collaborator successfully', async () => {
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/${REPO}/collaborators/${USERNAME}`)
      .reply(204);

    const result = await setRepoPermission({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      username: USERNAME,
      permission: 'push',
    });

    expect(result).toEqual({
      success: true,
      data: {
        username: USERNAME,
        permission: 'push',
        repository: `${OWNER}/${REPO}`,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await setRepoPermission({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      username: USERNAME,
      permission: 'push',
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when repo or user does not exist', async () => {
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/${REPO}/collaborators/${USERNAME}`)
      .reply(404, { message: 'Not Found' });

    const result = await setRepoPermission({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      username: USERNAME,
      permission: 'admin',
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`setting permission for ${USERNAME}`),
      },
    });
  });
});
