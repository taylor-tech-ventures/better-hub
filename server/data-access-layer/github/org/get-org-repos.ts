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

export type ListOrgReposResponse =
  GitHubApiEndpoints['GET /orgs/{org}/repos']['response']['data'];
export type PartialListOrgReposResponse = Array<
  Pick<
    ListOrgReposResponse[number],
    | 'id'
    | 'name'
    | 'full_name'
    | 'private'
    | 'description'
    | 'html_url'
    | 'created_at'
    | 'updated_at'
  > & { owner: string }
>;
export type ListOrgReposParameter =
  GitHubApiEndpoints['GET /orgs/{org}/repos']['parameters'];

export type ListOrgReposParameters = {
  org: string;
  type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
};

/**
 * Fetches all repositories belonging to the specified GitHub organization.
 * Validates that the authenticated user has access to the organization before querying.
 * @param parameters - The organization name, optional filters (type, sort, direction), and access token.
 * @returns A GitHubResult wrapping the partial list of repository objects.
 */
export async function getGitHubOrgRepos(
  parameters: ListOrgReposParameters & { accessToken: string | undefined },
): Promise<GitHubResult<PartialListOrgReposResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }
  try {
    const hasOrgAccess = await githubExistsRequest(
      'org',
      { org: params.org },
      accessToken,
    );

    if (!hasOrgAccess) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `You do not have access to organization ${params.org} or it does not exist.`,
      );
    }

    const octokit = getOctokit(accessToken);
    const repos = await octokit.paginate('GET /orgs/{org}/repos', {
      ...params,
      per_page: 100,
    });

    return ok(
      repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        html_url: repo.html_url,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
      })),
    );
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing organization repositories: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing organization repositories: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
