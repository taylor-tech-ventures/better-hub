import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { setRepoTopics } from '../../../../../server/data-access-layer/github/repo/set-repo-topics';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';

describe('setRepoTopics', () => {
  it('sets topics on a repository successfully', async () => {
    const topics = ['javascript', 'typescript', 'react'];

    nock(GITHUB_API)
      .put(`/repos/${OWNER}/${REPO}/topics`)
      .reply(200, { names: topics });

    const result = await setRepoTopics({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      topics,
    });

    expect(result).toEqual({
      success: true,
      data: { topics },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await setRepoTopics({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      topics: ['test'],
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when repo does not exist', async () => {
    nock(GITHUB_API)
      .put(`/repos/${OWNER}/${REPO}/topics`)
      .reply(404, { message: 'Not Found' });

    const result = await setRepoTopics({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      topics: ['test'],
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`setting topics on ${OWNER}/${REPO}`),
      },
    });
  });
});
