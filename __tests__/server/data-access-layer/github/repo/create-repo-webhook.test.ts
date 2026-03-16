import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { createRepoWebhook } from '../../../../../server/data-access-layer/github/repo/create-repo-webhook';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'test-repo';

const CREATED_WEBHOOK_RESPONSE = {
  id: 42,
  name: 'web',
  active: true,
  events: ['push'],
  config: {
    url: 'https://example.com/webhook',
    content_type: 'json',
    insecure_ssl: '0',
  },
};

describe('createRepoWebhook', () => {
  it('creates a webhook successfully', async () => {
    nock(GITHUB_API)
      .post(`/repos/${OWNER}/${REPO}/hooks`)
      .reply(201, CREATED_WEBHOOK_RESPONSE);

    const result = await createRepoWebhook({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      config: { url: 'https://example.com/webhook', content_type: 'json' },
      events: ['push'],
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: 42,
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          insecure_ssl: '0',
        },
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await createRepoWebhook({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
      config: { url: 'https://example.com/webhook' },
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 422', async () => {
    nock(GITHUB_API)
      .post(`/repos/${OWNER}/${REPO}/hooks`)
      .reply(422, { message: 'Validation Failed' });

    const result = await createRepoWebhook({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
      config: { url: 'https://example.com/webhook' },
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
