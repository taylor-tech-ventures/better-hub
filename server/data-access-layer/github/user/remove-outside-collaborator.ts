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
 * Removes an outside collaborator from an organization.
 */
export async function removeOutsideCollaborator(params: {
  accessToken: string | undefined;
  org: string;
  username: string;
}): Promise<GitHubResult<{ removed: boolean }>> {
  const { accessToken, org, username } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    await octokit.request(
      'DELETE /orgs/{org}/outside_collaborators/{username}',
      { org, username },
    );

    return ok({ removed: true });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error removing outside collaborator ${username} from ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error removing outside collaborator ${username} from ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
