import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { getOrgBilling } from '../../../../../server/data-access-layer/github/org/get-org-billing';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';

const ACTIONS_BILLING = {
  total_minutes_used: 500,
  total_paid_minutes_used: 100,
  included_minutes: 3000,
};

const PACKAGES_BILLING = {
  total_gigabytes_bandwidth_used: 5,
  total_paid_gigabytes_bandwidth_used: 1,
  included_gigabytes_bandwidth: 10,
};

const STORAGE_BILLING = {
  days_left_in_billing_cycle: 15,
  estimated_paid_storage_for_month: 2,
  estimated_storage_for_month: 8,
};

describe('getOrgBilling', () => {
  it('returns combined billing data from three API calls', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/settings/billing/actions`)
      .reply(200, ACTIONS_BILLING);

    nock(GITHUB_API)
      .get(`/orgs/${ORG}/settings/billing/packages`)
      .reply(200, PACKAGES_BILLING);

    nock(GITHUB_API)
      .get(`/orgs/${ORG}/settings/billing/shared-storage`)
      .reply(200, STORAGE_BILLING);

    const result = await getOrgBilling({
      accessToken: ACCESS_TOKEN,
      org: ORG,
    });

    expect(result).toEqual({
      success: true,
      data: {
        actions: ACTIONS_BILLING,
        packages: PACKAGES_BILLING,
        shared_storage: STORAGE_BILLING,
      },
    });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await getOrgBilling({
      accessToken: undefined,
      org: ORG,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns error when one billing endpoint fails', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/settings/billing/actions`)
      .reply(200, ACTIONS_BILLING);

    nock(GITHUB_API)
      .get(`/orgs/${ORG}/settings/billing/packages`)
      .reply(403, { message: 'Forbidden' });

    nock(GITHUB_API)
      .get(`/orgs/${ORG}/settings/billing/shared-storage`)
      .reply(200, STORAGE_BILLING);

    const result = await getOrgBilling({
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
