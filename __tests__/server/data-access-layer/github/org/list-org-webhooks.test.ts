import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listOrgWebhooks } from '../../../../../server/data-access-layer/github/org/list-org-webhooks';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';

const WEBHOOK_FIXTURES = [
  {
    id: 10,
    name: 'web',
    active: true,
    events: ['push'],
    config: {
      url: 'https://example.com/org-hook',
      content_type: 'json',
      insecure_ssl: '0',
    },
  },
];

describe('listOrgWebhooks', () => {
  it('returns webhooks for an organization', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/hooks`)
      .query(true)
      .reply(200, WEBHOOK_FIXTURES);

    const result = await listOrgWebhooks({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toEqual({
      success: true,
      data: WEBHOOK_FIXTURES,
    });
  });

  it('returns empty array when no webhooks exist', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/hooks`)
      .query(true)
      .reply(200, []);

    const result = await listOrgWebhooks({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listOrgWebhooks({
      accessToken: undefined,
      org: ORG,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 403', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/hooks`)
      .query(true)
      .reply(403, { message: 'Forbidden' });

    const result = await listOrgWebhooks({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.FORBIDDEN,
        message: expect.stringContaining(ORG),
      },
    });
  });
});
