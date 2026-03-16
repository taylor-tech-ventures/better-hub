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

export type GetRepoUsersResponse = Array<
  Pick<
    GitHubApiEndpoints['GET /repos/{owner}/{repo}/collaborators']['response']['data'][number],
    'login' | 'permissions' | 'html_url'
  >
>;

export type GetRepoUsersParameters = {
  owner: string;
  repo: string;
};

/**
 * Fetches all collaborators for a specified GitHub repository.
 * Validates that the repository exists before querying.
 * @param parameters - The owner, repo, and access token.
 * @returns A GitHubResult wrapping the list of user objects with login, permissions, and HTML URL.
 */
export async function getGitHubRepoUsers(
  parameters: GetRepoUsersParameters & { accessToken: string | undefined },
): Promise<GitHubResult<GetRepoUsersResponse>> {
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
    const response = await octokit.paginate(
      'GET /repos/{owner}/{repo}/collaborators',
      {
        ...params,
      },
    );

    const users = response.map((user) => ({
      login: user.login,
      permissions: user.permissions,
      html_url: user.html_url,
    }));

    return ok(users);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching repository users: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching repository users: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
