import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

/**
 * Deletes a team from a GitHub organization.
 * @param params - The organization, team slug, and access token.
 * @returns A GitHubResult wrapping a deletion confirmation.
 */
export async function deleteTeam(params: {
  accessToken: string | undefined;
  org: string;
  team_slug: string;
}): Promise<GitHubResult<{ deleted: boolean }>> {
  const { accessToken, org, team_slug } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    await octokit.request('DELETE /orgs/{org}/teams/{team_slug}', {
      org,
      team_slug,
    });

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error deleting team "${team_slug}" in ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error deleting team "${team_slug}" in ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
