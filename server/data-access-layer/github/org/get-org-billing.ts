import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type OrgBilling = {
  actions: {
    total_minutes_used: number;
    total_paid_minutes_used: number;
    included_minutes: number;
  };
  packages: {
    total_gigabytes_bandwidth_used: number;
    total_paid_gigabytes_bandwidth_used: number;
    included_gigabytes_bandwidth: number;
  };
  shared_storage: {
    days_left_in_billing_cycle: number;
    estimated_paid_storage_for_month: number;
    estimated_storage_for_month: number;
  };
};

/**
 * Retrieves billing information for an organization by combining
 * Actions, Packages, and Shared Storage billing data.
 */
export async function getOrgBilling(params: {
  accessToken: string | undefined;
  org: string;
}): Promise<GitHubResult<OrgBilling>> {
  const { accessToken, org } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    const [actionsResponse, packagesResponse, storageResponse] =
      await Promise.all([
        octokit.request('GET /orgs/{org}/settings/billing/actions', { org }),
        octokit.request('GET /orgs/{org}/settings/billing/packages', { org }),
        octokit.request('GET /orgs/{org}/settings/billing/shared-storage', {
          org,
        }),
      ]);

    return ok({
      actions: {
        total_minutes_used: actionsResponse.data.total_minutes_used,
        total_paid_minutes_used: actionsResponse.data.total_paid_minutes_used,
        included_minutes: actionsResponse.data.included_minutes,
      },
      packages: {
        total_gigabytes_bandwidth_used:
          packagesResponse.data.total_gigabytes_bandwidth_used,
        total_paid_gigabytes_bandwidth_used:
          packagesResponse.data.total_paid_gigabytes_bandwidth_used,
        included_gigabytes_bandwidth:
          packagesResponse.data.included_gigabytes_bandwidth,
      },
      shared_storage: {
        days_left_in_billing_cycle:
          storageResponse.data.days_left_in_billing_cycle,
        estimated_paid_storage_for_month:
          storageResponse.data.estimated_paid_storage_for_month,
        estimated_storage_for_month:
          storageResponse.data.estimated_storage_for_month,
      },
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching billing info for org ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching billing info for org ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
