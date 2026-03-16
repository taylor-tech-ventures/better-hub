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

export type GetRepoRulesetsResponse =
  GitHubApiEndpoints['GET /repos/{owner}/{repo}/rulesets']['response']['data'];

export type GetRepoRulesetsParameters = {
  owner: string;
  repo: string;
};

/**
 * Fetches all rulesets for a GitHub repository.
 * Validates that the repository exists before querying.
 * @param parameters - The owner, repo, and access token.
 * @returns A GitHubResult wrapping the list of rulesets.
 */
export async function getGitHubRepoRulesets(
  parameters: GetRepoRulesetsParameters & { accessToken: string | undefined },
): Promise<GitHubResult<GetRepoRulesetsResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error fetching rulesets for the repository ${params.owner}/${params.repo}. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo: params.repo },
      accessToken,
    );

    if (!repoExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Repository ${params.owner}/${params.repo} does not exist.`,
      );
    }

    const octokit = getOctokit(accessToken);
    const rulesets = await octokit.paginate(
      'GET /repos/{owner}/{repo}/rulesets',
      {
        owner: params.owner,
        repo: params.repo,
      },
    );
    return ok(rulesets as GetRepoRulesetsResponse);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching repository rulesets: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching repository rulesets: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
