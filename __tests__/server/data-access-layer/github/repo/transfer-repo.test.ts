import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { transferRepo } from '../../../../../server/data-access-layer/github/repo/transfer-repo';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';
const NEW_OWNER = 'other-org';

describe('transferRepo', () => {
  it('transfers a repository successfully', async () => {
    nock(GITHUB_API)
      .post(`/repos/${OWNER}/${REPO}/transfer`)
      .reply(202, {
        full_name: `${NEW_OWNER}/${REPO}`,
        html_url: `https://github.com/${NEW_OWNER}/${REPO}`,
      });

    const result = await transferRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      newOwner: NEW_OWNER,
    });

    expect(result).toEqual({
      success: true,
      data: {
        full_name: `${NEW_OWNER}/${REPO}`,
        html_url: `https://github.com/${NEW_OWNER}/${REPO}`,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await transferRepo({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      newOwner: NEW_OWNER,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when repo does not exist', async () => {
    nock(GITHUB_API)
      .post(`/repos/${OWNER}/${REPO}/transfer`)
      .reply(404, { message: 'Not Found' });

    const result = await transferRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      newOwner: NEW_OWNER,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`transferring ${OWNER}/${REPO}`),
      },
    });
  });
});
