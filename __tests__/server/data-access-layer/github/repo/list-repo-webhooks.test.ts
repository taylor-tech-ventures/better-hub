import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listRepoWebhooks } from '../../../../../server/data-access-layer/github/repo/list-repo-webhooks';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';

const WEBHOOK_FIXTURES = [
  {
    id: 1,
    name: 'web',
    active: true,
    events: ['push', 'pull_request'],
    config: {
      url: 'https://example.com/webhook',
      content_type: 'json',
      insecure_ssl: '0',
    },
  },
  {
    id: 2,
    name: 'web',
    active: false,
    events: ['push'],
    config: {
      url: 'https://example.com/webhook2',
      content_type: 'form',
      insecure_ssl: '1',
    },
  },
];

describe('listRepoWebhooks', () => {
  it('returns webhooks for a repository', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/hooks`)
      .query(true)
      .reply(200, WEBHOOK_FIXTURES);

    const result = await listRepoWebhooks({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({
      success: true,
      data: WEBHOOK_FIXTURES,
    });
  });

  it('returns empty array when no webhooks exist', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/hooks`)
      .query(true)
      .reply(200, []);

    const result = await listRepoWebhooks({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listRepoWebhooks({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 403', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/hooks`)
      .query(true)
      .reply(403, { message: 'Forbidden' });

    const result = await listRepoWebhooks({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.FORBIDDEN,
        message: expect.stringContaining(`${OWNER}/${REPO}`),
      },
    });
  });
});
