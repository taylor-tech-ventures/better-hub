import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { searchCode } from '../../../../../server/data-access-layer/github/repo/search-code';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';

const SEARCH_RESULT_FIXTURES = {
  total_count: 1,
  incomplete_results: false,
  items: [
    {
      name: 'config.ts',
      path: 'src/config.ts',
      sha: 'abc123',
      html_url: 'https://github.com/test-org/test-repo/blob/main/src/config.ts',
      repository: { full_name: 'test-org/test-repo' },
    },
  ],
};

describe('searchCode', () => {
  it('returns search results with org filter', async () => {
    nock(GITHUB_API)
      .get('/search/code')
      .query((query) => query.q === 'useState org:test-org')
      .reply(200, SEARCH_RESULT_FIXTURES);

    const result = await searchCode({
      accessToken: ACCESS_TOKEN,
      query: 'useState',
      org: 'test-org',
    });

    expect(result).toEqual({
      success: true,
      data: {
        total_count: 1,
        items: [
          {
            name: 'config.ts',
            path: 'src/config.ts',
            sha: 'abc123',
            html_url: 'https://github.com/test-org/test-repo/blob/main/src/config.ts',
            repository: { full_name: 'test-org/test-repo' },
          },
        ],
      },
    });
  });

  it('returns search results without org filter', async () => {
    nock(GITHUB_API)
      .get('/search/code')
      .query((query) => query.q === 'useState')
      .reply(200, SEARCH_RESULT_FIXTURES);

    const result = await searchCode({
      accessToken: ACCESS_TOKEN,
      query: 'useState',
    });

    expect(result).toEqual({
      success: true,
      data: {
        total_count: 1,
        items: [
          {
            name: 'config.ts',
            path: 'src/config.ts',
            sha: 'abc123',
            html_url: 'https://github.com/test-org/test-repo/blob/main/src/config.ts',
            repository: { full_name: 'test-org/test-repo' },
          },
        ],
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await searchCode({
      accessToken: undefined,
      query: 'useState',
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 422', async () => {
    nock(GITHUB_API)
      .get('/search/code')
      .query(true)
      .reply(422, { message: 'Validation Failed' });

    const result = await searchCode({
      accessToken: ACCESS_TOKEN,
      query: 'useState',
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('searching code'),
      },
    });
  });
});
