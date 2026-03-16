import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type BlockedUser = {
  login: string;
  id: number;
  avatar_url: string;
};

/**
 * Lists users blocked by an organization.
 */
export async function listBlockedUsers(params: {
  accessToken: string | undefined;
  org: string;
}): Promise<GitHubResult<BlockedUser[]>> {
  const { accessToken, org } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const users = await octokit.paginate('GET /orgs/{org}/blocks', {
      org,
      per_page: 100,
    });

    return ok(
      users.map((user) => ({
        login: user.login,
        id: user.id,
        avatar_url: user.avatar_url,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing blocked users for org ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing blocked users for org ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
