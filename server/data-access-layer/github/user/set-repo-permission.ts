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
 * Sets the permission level for a collaborator on a repository.
 */
export async function setRepoPermission(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  username: string;
  permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
}): Promise<
  GitHubResult<{ username: string; permission: string; repository: string }>
> {
  const { accessToken, owner, repo, username, permission } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    await octokit.request(
      'PUT /repos/{owner}/{repo}/collaborators/{username}',
      { owner, repo, username, permission },
    );

    return ok({ username, permission, repository: `${owner}/${repo}` });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error setting permission for ${username} on ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error setting permission for ${username} on ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
