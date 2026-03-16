import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type PullRequest = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  headSha: string;
  headRef: string;
  baseRef: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type GetPullRequestsParams = {
  org: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  accessToken: string | undefined;
};

/**
 * Fetches all pull requests for a repository, following pagination.
 * Defaults to open pull requests.
 */
export async function getRepoPullRequests(
  params: GetPullRequestsParams,
): Promise<GitHubResult<PullRequest[]>> {
  const { accessToken, org, repo, state = 'open' } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is unavailable. Please sign in again.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    const prs = await octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
      owner: org,
      repo,
      state,
      per_page: 100,
    });

    return ok(
      prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: (pr as { draft?: boolean }).draft ?? false,
        headSha: pr.head.sha,
        headRef: pr.head.ref,
        baseRef: pr.base.ref,
        author: pr.user?.login ?? 'unknown',
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching pull requests for ${org}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching pull requests for ${org}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
