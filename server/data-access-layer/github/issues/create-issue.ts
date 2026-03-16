import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type CreatedIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
};

/**
 * Creates a new issue in a repository.
 */
export async function createIssue(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}): Promise<GitHubResult<CreatedIssue>> {
  const { accessToken, owner, repo, title, body, labels, assignees } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues',
      {
        owner,
        repo,
        title,
        ...(body ? { body } : {}),
        ...(labels ? { labels } : {}),
        ...(assignees ? { assignees } : {}),
      },
    );

    return ok({
      number: data.number,
      title: data.title,
      html_url: data.html_url,
      state: data.state,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating issue in ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating issue in ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
