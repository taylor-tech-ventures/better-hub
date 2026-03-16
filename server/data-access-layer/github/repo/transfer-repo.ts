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
 * Transfers a GitHub repository to a new owner.
 * @param params - The current owner, repo name, new owner, optional team IDs, and access token.
 * @returns A GitHubResult wrapping the new full name and URL.
 */
export async function transferRepo(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  newOwner: string;
  teamIds?: number[];
}): Promise<GitHubResult<{ full_name: string; html_url: string }>> {
  const { accessToken, owner, repo, newOwner, teamIds } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/transfer',
      {
        owner,
        repo,
        new_owner: newOwner,
        ...(teamIds !== undefined ? { team_ids: teamIds } : {}),
      },
    );

    return ok({
      full_name: data.full_name,
      html_url: data.html_url,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error transferring ${owner}/${repo} to "${newOwner}": ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error transferring ${owner}/${repo} to "${newOwner}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
