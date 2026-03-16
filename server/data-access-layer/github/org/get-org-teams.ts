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

export type ListOrgTeamsResponse =
  GitHubApiEndpoints['GET /orgs/{org}/teams']['response']['data'];
export type PartialListOrgTeamsResponse = Array<
  Pick<
    ListOrgTeamsResponse[number],
    | 'id'
    | 'name'
    | 'slug'
    | 'description'
    | 'privacy'
    | 'permission'
    | 'html_url'
  > & {
    parent_team: string | undefined;
  }
>;
export type ListOrgTeamsParameter =
  GitHubApiEndpoints['GET /orgs/{org}/teams']['parameters'];

export type ListOrgTeamsParameters = {
  org: string;
};

/**
 * Fetches all teams belonging to the specified GitHub organization.
 * Validates that the authenticated user has access to the organization before querying.
 * @param parameters - The organization name and access token.
 * @returns A GitHubResult wrapping the partial list of team objects.
 */
export async function getGitHubOrgTeams(
  parameters: ListOrgTeamsParameters & { accessToken: string | undefined },
): Promise<GitHubResult<PartialListOrgTeamsResponse>> {
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
    const teams = await octokit.paginate('GET /orgs/{org}/teams', {
      ...params,
      per_page: 100,
    });

    return ok(
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        privacy: team.privacy,
        permission: team.permission,
        html_url: team.html_url,
        parent_team: team.parent?.name,
      })),
    );
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing organization teams: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing organization teams: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
