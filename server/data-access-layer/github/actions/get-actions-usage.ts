import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type ActionsUsage = {
  total_minutes_used: number;
  total_paid_minutes_used: number;
  included_minutes: number;
  minutes_used_breakdown: Record<string, number>;
};

/**
 * Gets GitHub Actions billing and usage information for an organization.
 */
export async function getActionsUsage(params: {
  accessToken: string | undefined;
  org: string;
}): Promise<GitHubResult<ActionsUsage>> {
  const { accessToken, org } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'GET /orgs/{org}/settings/billing/actions',
      { org },
    );

    return ok({
      total_minutes_used: data.total_minutes_used,
      total_paid_minutes_used: data.total_paid_minutes_used,
      included_minutes: data.included_minutes,
      minutes_used_breakdown: data.minutes_used_breakdown as Record<
        string,
        number
      >,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error getting Actions usage for ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error getting Actions usage for ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
