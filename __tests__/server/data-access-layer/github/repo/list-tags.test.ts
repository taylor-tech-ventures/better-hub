import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listTags } from '../../../../../server/data-access-layer/github/repo/list-tags';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';

const TAG_FIXTURES = [
  {
    name: 'v1.0.0',
    commit: { sha: 'abc123', url: 'https://api.github.com/repos/test-org/test-repo/commits/abc123' },
    zipball_url: 'https://api.github.com/repos/test-org/test-repo/zipball/v1.0.0',
    tarball_url: 'https://api.github.com/repos/test-org/test-repo/tarball/v1.0.0',
  },
  {
    name: 'v0.9.0',
    commit: { sha: 'def456', url: 'https://api.github.com/repos/test-org/test-repo/commits/def456' },
    zipball_url: 'https://api.github.com/repos/test-org/test-repo/zipball/v0.9.0',
    tarball_url: 'https://api.github.com/repos/test-org/test-repo/tarball/v0.9.0',
  },
];

describe('listTags', () => {
  it('returns tags for a repository', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/tags`)
      .query(true)
      .reply(200, TAG_FIXTURES);

    const result = await listTags({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({
      success: true,
      data: TAG_FIXTURES,
    });
  });

  it('returns empty array when no tags exist', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/tags`)
      .query(true)
      .reply(200, []);

    const result = await listTags({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listTags({
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
      .get(`/repos/${OWNER}/${REPO}/tags`)
      .query(true)
      .reply(404, { message: 'Not Found' });

    const result = await listTags({
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
