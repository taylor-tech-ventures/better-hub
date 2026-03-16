import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { updateOrgSettings } from '../../../../../server/data-access-layer/github/org/update-org-settings';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';

describe('updateOrgSettings', () => {
  it('updates organization settings successfully', async () => {
    const settings = {
      description: 'Updated description',
      default_repository_permission: 'read' as const,
      members_can_create_repositories: false,
    };

    nock(GITHUB_API)
      .patch(`/orgs/${ORG}`)
      .reply(200, { login: ORG });

    const result = await updateOrgSettings({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      settings,
    });

    expect(result).toEqual({
      success: true,
      data: {
        login: ORG,
        updated_settings: settings,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await updateOrgSettings({
      accessToken: undefined,
      org: ORG,
      settings: { description: 'test' },
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when GitHub API returns 403', async () => {
    nock(GITHUB_API)
      .patch(`/orgs/${ORG}`)
      .reply(403, { message: 'Forbidden' });

    const result = await updateOrgSettings({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      settings: { description: 'test' },
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
