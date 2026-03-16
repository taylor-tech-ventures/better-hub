import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getFileContents } from '../../../../../server/data-access-layer/github/repo/get-file-contents';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';
const FILE_PATH = 'README.md';

describe('getFileContents', () => {
  it('returns decoded file contents for base64-encoded content', async () => {
    const rawContent = 'Hello, World!';
    const base64Content = btoa(rawContent);

    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`)
      .query(true)
      .reply(200, {
        name: 'README.md',
        path: FILE_PATH,
        sha: 'abc123',
        size: rawContent.length,
        type: 'file',
        content: base64Content,
        encoding: 'base64',
        html_url: `https://github.com/${OWNER}/${REPO}/blob/main/${FILE_PATH}`,
      });

    const result = await getFileContents({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      path: FILE_PATH,
    });

    expect(result).toEqual({
      success: true,
      data: {
        name: 'README.md',
        path: FILE_PATH,
        sha: 'abc123',
        size: rawContent.length,
        type: 'file',
        content: rawContent,
        encoding: 'base64',
        html_url: `https://github.com/${OWNER}/${REPO}/blob/main/${FILE_PATH}`,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await getFileContents({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      path: FILE_PATH,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when file does not exist', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`)
      .query(true)
      .reply(404, { message: 'Not Found' });

    const result = await getFileContents({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      path: FILE_PATH,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`${OWNER}/${REPO}/${FILE_PATH}`),
      },
    });
  });
});
