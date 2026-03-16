import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type CommitComparison = {
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: Array<{
    sha: string;
    message: string;
    author: { login: string } | null;
  }>;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
};

/**
 * Compares two commits in a repository.
 */
export async function compareCommits(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  base: string;
  head: string;
}): Promise<GitHubResult<CommitComparison>> {
  const { accessToken, owner, repo, base, head } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/compare/{basehead}',
      {
        owner,
        repo,
        basehead: `${base}...${head}`,
      },
    );

    const data = response.data;
    return ok({
      status: data.status,
      ahead_by: data.ahead_by,
      behind_by: data.behind_by,
      total_commits: data.total_commits,
      commits: data.commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author ? { login: commit.author.login } : null,
      })),
      files: (data.files ?? []).map((file) => ({
        filename: file.filename,
        status: file.status ?? 'unknown',
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      })),
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error comparing ${base}...${head} in ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error comparing ${base}...${head} in ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
