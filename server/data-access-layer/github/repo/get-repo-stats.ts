import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type RepoStats = {
  forks_count: number;
  stargazers_count: number;
  watchers_count: number;
  open_issues_count: number;
  last_push_at: string | null;
  language: string | null;
  license: string | null;
  size_kb: number;
};

/**
 * Gets repository statistics including forks, stars, watchers, etc.
 */
export async function getRepoStats(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
}): Promise<GitHubResult<RepoStats>> {
  const { accessToken, owner, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner,
      repo,
    });

    return ok({
      forks_count: data.forks_count,
      stargazers_count: data.stargazers_count,
      watchers_count: data.watchers_count,
      open_issues_count: data.open_issues_count,
      last_push_at: data.pushed_at ?? null,
      language: data.language ?? null,
      license: data.license?.spdx_id ?? null,
      size_kb: data.size,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error getting stats for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error getting stats for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
