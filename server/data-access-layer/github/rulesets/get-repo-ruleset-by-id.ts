import { RequestError } from '@octokit/request-error';
import type { Endpoints as GitHubApiEndpoints } from '@octokit/types';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type GetRepoRulesetByIdResponse =
  GitHubApiEndpoints['GET /repos/{owner}/{repo}/rulesets/{ruleset_id}']['response']['data'];

export type GetRepoRulesetByIdParameters = {
  owner: string;
  repo: string;
  rulesetId: string;
};

/**
 * Fetches the full details of a specific ruleset in a GitHub repository by its numeric ID.
 * Validates that the repository exists before querying.
 * @param parameters - The owner, repo, ruleset ID string, and access token.
 * @returns A GitHubResult wrapping the full ruleset object.
 */
export async function getGitHubRepoRulesetById(
  parameters: GetRepoRulesetByIdParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<GetRepoRulesetByIdResponse>> {
  const { accessToken, owner, repo, rulesetId } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error fetching ruleset ${rulesetId} for the repository ${owner}/${repo}. Please re-authenticate.`,
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
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/rulesets/{ruleset_id}',
      {
        owner,
        repo,
        ruleset_id: Number(rulesetId),
      },
    );
    return ok(response.data);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching repository ruleset: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching repository ruleset: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
