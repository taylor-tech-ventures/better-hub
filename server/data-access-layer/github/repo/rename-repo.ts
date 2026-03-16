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
 * Renames a GitHub repository.
 * @param params - The owner, current repo name, new name, and access token.
 * @returns A GitHubResult wrapping the new full name and URL.
 */
export async function renameRepo(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  newName: string;
}): Promise<GitHubResult<{ full_name: string; html_url: string }>> {
  const { accessToken, owner, repo, newName } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request('PATCH /repos/{owner}/{repo}', {
      owner,
      repo,
      name: newName,
    });

    return ok({
      full_name: data.full_name,
      html_url: data.html_url,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error renaming ${owner}/${repo} to "${newName}": ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error renaming ${owner}/${repo} to "${newName}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
