import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { updateRepoSettings } from '../../../../../server/data-access-layer/github/repo/update-repo-settings';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';

describe('updateRepoSettings', () => {
  it('updates repository settings successfully', async () => {
    nock(GITHUB_API)
      .patch(`/repos/${OWNER}/${REPO}`)
      .reply(200, {
        full_name: `${OWNER}/${REPO}`,
        has_wiki: false,
        has_issues: true,
        delete_branch_on_merge: true,
      });

    const result = await updateRepoSettings({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      settings: {
        has_wiki: false,
        has_issues: true,
        delete_branch_on_merge: true,
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        full_name: `${OWNER}/${REPO}`,
        updated_settings: {
          has_wiki: false,
          has_issues: true,
          delete_branch_on_merge: true,
        },
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await updateRepoSettings({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      settings: { has_wiki: false },
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

    const result = await updateRepoSettings({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      settings: { has_wiki: false },
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`updating settings for ${OWNER}/${REPO}`),
      },
    });
  });
});
