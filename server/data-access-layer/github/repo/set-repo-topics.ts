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
 * Sets the topics on a GitHub repository, replacing any existing topics.
 * @param params - The owner, repo name, list of topics, and access token.
 * @returns A GitHubResult wrapping the updated topics list.
 */
export async function setRepoTopics(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  topics: string[];
}): Promise<GitHubResult<{ topics: string[] }>> {
  const { accessToken, owner, repo, topics } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request('PUT /repos/{owner}/{repo}/topics', {
      owner,
      repo,
      names: topics,
    });

    return ok({ topics: data.names });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error setting topics on ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error setting topics on ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
