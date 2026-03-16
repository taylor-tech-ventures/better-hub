import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { renameRepo } from '../../../../../server/data-access-layer/github/repo/rename-repo';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'old-name';
const NEW_NAME = 'new-name';

describe('renameRepo', () => {
  it('renames a repository successfully', async () => {
    nock(GITHUB_API)
      .patch(`/repos/${OWNER}/${REPO}`)
      .reply(200, {
        full_name: `${OWNER}/${NEW_NAME}`,
        html_url: `https://github.com/${OWNER}/${NEW_NAME}`,
      });

    const result = await renameRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      newName: NEW_NAME,
    });

    expect(result).toEqual({
      success: true,
      data: {
        full_name: `${OWNER}/${NEW_NAME}`,
        html_url: `https://github.com/${OWNER}/${NEW_NAME}`,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await renameRepo({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      newName: NEW_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when repo does not exist', async () => {
    nock(GITHUB_API)
      .patch(`/repos/${OWNER}/${REPO}`)
      .reply(404, { message: 'Not Found' });

    const result = await renameRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      newName: NEW_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`renaming ${OWNER}/${REPO}`),
      },
    });
  });
});
