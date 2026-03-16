import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listReleases } from '../../../../../server/data-access-layer/github/release/list-releases';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';

const RELEASE_FIXTURES = [
  {
    id: 1,
    tag_name: 'v1.0.0',
    name: 'Release 1.0.0',
    draft: false,
    prerelease: false,
    created_at: '2024-01-01T00:00:00Z',
    published_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/test-org/test-repo/releases/tag/v1.0.0',
    author: { login: 'octocat' },
  },
  {
    id: 2,
    tag_name: 'v2.0.0-beta',
    name: 'Release 2.0.0 Beta',
    draft: false,
    prerelease: true,
    created_at: '2024-06-01T00:00:00Z',
    published_at: '2024-06-01T00:00:00Z',
    html_url: 'https://github.com/test-org/test-repo/releases/tag/v2.0.0-beta',
    author: { login: 'octocat' },
  },
];

describe('listReleases', () => {
  it('returns releases for a repository', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/releases`)
      .query(true)
      .reply(200, RELEASE_FIXTURES);

    const result = await listReleases({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({
      success: true,
      data: RELEASE_FIXTURES,
    });
  });

  it('returns empty array when no releases exist', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/releases`)
      .query(true)
      .reply(200, []);

    const result = await listReleases({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listReleases({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 404', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/releases`)
      .query(true)
      .reply(404, { message: 'Not Found' });

    const result = await listReleases({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`${OWNER}/${REPO}`),
      },
    });
  });
});
