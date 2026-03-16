import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type LabelEntry = {
  name: string;
  color: string;
  description: string | null;
};

/**
 * Adds labels to an issue or pull request.
 */
export async function addLabelsToIssue(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  issue_number: number;
  labels: string[];
}): Promise<GitHubResult<LabelEntry[]>> {
  const { accessToken, owner, repo, issue_number, labels } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number,
        labels,
      },
    );

    return ok(
      data.map((label) => ({
        name: label.name ?? '',
        color: label.color ?? '',
        description: label.description ?? null,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error adding labels to issue #${issue_number} in ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error adding labels to issue #${issue_number} in ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
