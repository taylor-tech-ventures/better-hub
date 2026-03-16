import { RequestError as OctokitError } from '@octokit/request-error';
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

export type GetRepoBranchesParameters = {
  org: string;
  repo: string;
};

type BranchesResponse =
  GitHubApiEndpoints['GET /repos/{owner}/{repo}/branches']['response']['data'];

/**
 * Fetches the branches for a specified repository in a GitHub organization.
 * Validates that the repository exists before querying.
 * @param parameters - The organization name, repository name, and access token.
 * @returns A GitHubResult wrapping the list of branches.
 */
export async function getGitHubRepoBranches(
  parameters: GetRepoBranchesParameters & { accessToken: string | undefined },
): Promise<GitHubResult<BranchesResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error fetching branches for ${params.org}/${params.repo}. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.org, repo: params.repo },
      accessToken,
    );

    if (!repoExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Repository ${params.org}/${params.repo} does not exist`,
      );
    }

    const octokit = getOctokit(accessToken);
    const branches = await octokit.paginate(
      'GET /repos/{owner}/{repo}/branches',
      {
        owner: params.org,
        repo: params.repo,
      },
    );
    return ok(branches);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching branches: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching branches: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
