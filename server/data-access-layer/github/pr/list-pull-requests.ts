import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type PullRequestEntry = {
  number: number;
  title: string;
  state: string;
  user_login: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
};

/**
 * Lists pull requests for a repository with optional filters.
 */
export async function listPullRequests(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  state?: string;
  head?: string;
  base?: string;
}): Promise<GitHubResult<PullRequestEntry[]>> {
  const { accessToken, owner, repo, state = 'open', head, base } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const prs = await octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      state: state as 'open' | 'closed' | 'all',
      ...(head ? { head } : {}),
      ...(base ? { base } : {}),
      per_page: 100,
    });

    return ok(
      prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        user_login: pr.user?.login ?? 'unknown',
        html_url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        draft: (pr as { draft?: boolean }).draft ?? false,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing pull requests for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing pull requests for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
