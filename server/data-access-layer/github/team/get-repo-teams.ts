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

export type GetRepoTeamsResponse = Array<
  Pick<
    GitHubApiEndpoints['GET /repos/{owner}/{repo}/teams']['response']['data'][number],
    'name' | 'permission' | 'html_url'
  >
>;

export type GetRepoTeamsParameters = {
  owner: string;
  repo: string;
};

/**
 * Fetches all teams that have access to a specified GitHub repository.
 * Validates that the repository exists before querying.
 * @param parameters - The owner, repo, and access token.
 * @returns A GitHubResult wrapping the list of team objects with name, permission, and HTML URL.
 */
export async function getGitHubRepoTeams(
  parameters: GetRepoTeamsParameters & { accessToken: string | undefined },
): Promise<GitHubResult<GetRepoTeamsResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
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
    const response = await octokit.paginate('GET /repos/{owner}/{repo}/teams', {
      ...params,
    });

    const teams = response.map((team) => ({
      name: team.name,
      permission: team.permission,
      html_url: team.html_url,
    }));

    return ok(teams);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching repository teams: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching repository teams: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
