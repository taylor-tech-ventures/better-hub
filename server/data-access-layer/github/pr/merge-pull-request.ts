import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type MergePullRequestResult = {
  sha: string;
  merged: boolean;
  message: string;
};

/**
 * Merges a pull request using the specified merge method.
 */
export async function mergePullRequest(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  pull_number: number;
  merge_method?: string;
  commit_title?: string;
  commit_message?: string;
}): Promise<GitHubResult<MergePullRequestResult>> {
  const {
    accessToken,
    owner,
    repo,
    pull_number,
    merge_method = 'merge',
    commit_title,
    commit_message,
  } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
      {
        owner,
        repo,
        pull_number,
        merge_method: merge_method as 'merge' | 'squash' | 'rebase',
        ...(commit_title ? { commit_title } : {}),
        ...(commit_message ? { commit_message } : {}),
      },
    );

    return ok({
      sha: data.sha,
      merged: data.merged,
      message: data.message,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error merging PR #${pull_number} in ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error merging PR #${pull_number} in ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
