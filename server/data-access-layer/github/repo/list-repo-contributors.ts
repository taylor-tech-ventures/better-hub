import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type ContributorEntry = {
  login: string;
  contributions: number;
  html_url: string;
};

/**
 * Lists contributors for a repository.
 */
export async function listRepoContributors(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
}): Promise<GitHubResult<ContributorEntry[]>> {
  const { accessToken, owner, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const contributors = await octokit.paginate(
      'GET /repos/{owner}/{repo}/contributors',
      { owner, repo, per_page: 100 },
    );

    return ok(
      contributors.map((c) => ({
        login: c.login ?? 'unknown',
        contributions: c.contributions,
        html_url: c.html_url ?? `https://github.com/${c.login}`,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing contributors for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing contributors for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
