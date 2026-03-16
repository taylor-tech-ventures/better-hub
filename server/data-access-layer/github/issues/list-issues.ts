import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type IssueEntry = {
  number: number;
  title: string;
  state: string;
  user_login: string;
  html_url: string;
  labels: string[];
  created_at: string;
};

/**
 * Lists issues for a repository with optional filters.
 * Excludes pull requests (GitHub API returns PRs as issues).
 */
export async function listIssues(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  state?: string;
  labels?: string;
  assignee?: string;
}): Promise<GitHubResult<IssueEntry[]>> {
  const { accessToken, owner, repo, state = 'open', labels, assignee } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const issues = await octokit.paginate('GET /repos/{owner}/{repo}/issues', {
      owner,
      repo,
      state: state as 'open' | 'closed' | 'all',
      ...(labels ? { labels } : {}),
      ...(assignee ? { assignee } : {}),
      per_page: 100,
    });

    return ok(
      issues
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          user_login: issue.user?.login ?? 'unknown',
          html_url: issue.html_url,
          labels: issue.labels.map((l) =>
            typeof l === 'string' ? l : (l.name ?? ''),
          ),
          created_at: issue.created_at,
        })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing issues for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing issues for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
