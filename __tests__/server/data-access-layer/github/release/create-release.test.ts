import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { createRelease } from '../../../../../server/data-access-layer/github/release/create-release-v2';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';
const TAG_NAME = 'v1.0.0';

const CREATED_RELEASE_RESPONSE = {
  id: 100,
  tag_name: TAG_NAME,
  name: TAG_NAME,
  draft: false,
  prerelease: false,
  created_at: '2024-01-01T00:00:00Z',
  published_at: '2024-01-01T00:00:00Z',
  html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/${TAG_NAME}`,
  author: { login: 'octocat' },
};

describe('createRelease', () => {
  it('creates a release successfully', async () => {
    nock(GITHUB_API)
      .post(`/repos/${OWNER}/${REPO}/releases`)
      .reply(201, CREATED_RELEASE_RESPONSE);

    const result = await createRelease({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      tag_name: TAG_NAME,
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: 100,
        tag_name: TAG_NAME,
        name: TAG_NAME,
        draft: false,
        prerelease: false,
        created_at: '2024-01-01T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/${TAG_NAME}`,
        author_login: 'octocat',
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await createRelease({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      tag_name: TAG_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 422', async () => {
    nock(GITHUB_API)
      .post(`/repos/${OWNER}/${REPO}/releases`)
      .reply(422, { message: 'Validation Failed' });

    const result = await createRelease({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      tag_name: TAG_NAME,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining(`${OWNER}/${REPO}`),
      },
    });
  });
});
