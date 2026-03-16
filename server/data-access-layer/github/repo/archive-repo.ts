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
 * Archives or unarchives a GitHub repository.
 * @param params - The owner, repo name, archive flag (defaults to true), and access token.
 * @returns A GitHubResult wrapping the archive status and full name.
 */
export async function archiveRepo(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  archive?: boolean;
}): Promise<GitHubResult<{ archived: boolean; full_name: string }>> {
  const { accessToken, owner, repo, archive = true } = params;

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
      archived: archive,
    });

    return ok({
      archived: data.archived,
      full_name: data.full_name,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error ${archive ? 'archiving' : 'unarchiving'} ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error ${archive ? 'archiving' : 'unarchiving'} ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
