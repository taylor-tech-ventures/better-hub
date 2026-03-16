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

export type GetTeamUsersResponse = Array<
  Pick<
    GitHubApiEndpoints['GET /orgs/{org}/teams/{team_slug}/members']['response']['data'][number],
    'login' | 'id' | 'name'
  > & {
    role: string;
  }
>;

export type GetTeamUsersParameters = {
  org: string;
  team_slug: string;
};

/**
 * Fetches all members of a specific team within a GitHub organization, including their roles.
 * Validates that the team exists before querying. Role is fetched via a separate membership
 * request per member; defaults to `"member"` if the role fetch fails.
 * @param parameters - The organization name, team slug, and access token.
 * @returns A GitHubResult wrapping the list of team member objects with login, id, name, and role.
 */
export async function getGitHubTeamUsers(
  parameters: GetTeamUsersParameters & { accessToken: string | undefined },
): Promise<GitHubResult<GetTeamUsersResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }
  try {
    const teamExists = await githubExistsRequest(
      'team',
      { org: params.org, team_slug: params.team_slug },
      accessToken,
    );

    if (!teamExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Team ${params.team_slug} does not exist in organization ${params.org}.`,
      );
    }

    const octokit = getOctokit(accessToken);

    const members = await octokit.paginate(
      'GET /orgs/{org}/teams/{team_slug}/members',
      {
        ...params,
      },
    );

    const usersWithRoles = await Promise.all(
      members.map(async (member) => {
        try {
          const membershipResponse =
            await octokit.rest.teams.getMembershipForUserInOrg({
              org: params.org,
              team_slug: params.team_slug,
              username: member.login,
            });

          return {
            id: member.id,
            login: member.login,
            name: member.name,
            role: membershipResponse.data.role,
          };
        } catch (_error) {
          return {
            id: member.id,
            login: member.login,
            name: member.name,
            role: 'member',
          };
        }
      }),
    );

    return ok(usersWithRoles);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching team users: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching team users: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
