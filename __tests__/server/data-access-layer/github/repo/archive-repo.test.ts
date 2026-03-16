import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { archiveRepo } from '../../../../../server/data-access-layer/github/repo/archive-repo';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';

describe('archiveRepo', () => {
  it('archives a repository successfully', async () => {
    nock(GITHUB_API)
      .patch(`/repos/${OWNER}/${REPO}`)
      .reply(200, {
        archived: true,
        full_name: `${OWNER}/${REPO}`,
      });

    const result = await archiveRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      archive: true,
    });

    expect(result).toEqual({
      success: true,
      data: { archived: true, full_name: `${OWNER}/${REPO}` },
    });
  });

  it('unarchives a repository successfully', async () => {
    nock(GITHUB_API)
      .patch(`/repos/${OWNER}/${REPO}`)
      .reply(200, {
        archived: false,
        full_name: `${OWNER}/${REPO}`,
      });

    const result = await archiveRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      archive: false,
    });

    expect(result).toEqual({
      success: true,
      data: { archived: false, full_name: `${OWNER}/${REPO}` },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await archiveRepo({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
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

    const result = await archiveRepo({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining('archiving'),
      },
    });
  });
});
