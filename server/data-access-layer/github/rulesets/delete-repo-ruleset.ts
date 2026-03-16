import { RequestError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type DeleteRepoRulesetParameters = {
  owner: string;
  repo: string;
  rulesetId: string;
};

/**
 * Deletes a ruleset from a GitHub repository by its numeric ID.
 * Validates that the repository exists before attempting deletion.
 * @param parameters - The owner, repo, ruleset ID string, and access token.
 * @returns A GitHubResult wrapping `{ success: true }` on success.
 */
export async function deleteGitHubRepoRuleset(
  parameters: DeleteRepoRulesetParameters & { accessToken: string | undefined },
): Promise<GitHubResult<{ success: true }>> {
  const { accessToken, owner, repo, rulesetId } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error deleting ruleset ${rulesetId} for the repository ${owner}/${repo}. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner, repo },
      accessToken,
    );

    if (!repoExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Repository ${owner}/${repo} does not exist.`,
      );
    }

    const octokit = getOctokit(accessToken);
    await octokit.request(
      'DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}',
      {
        owner,
        repo,
        ruleset_id: Number(rulesetId),
      },
    );
    return ok({ success: true as const });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error deleting ruleset ${rulesetId} for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error deleting ruleset ${rulesetId} for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
