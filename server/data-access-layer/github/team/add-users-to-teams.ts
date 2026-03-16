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

export type AddUsersToTeamsParameters = {
  org: string;
  teams: string[];
  users: {
    username: string;
    role?: 'member' | 'maintainer';
  }[];
};

/**
 * Adds a user to a GitHub team with the specified role.
 * @param params - The team slug, user (username and optional role), organization, and access token.
 * @returns A GitHubResult wrapping the team slug and username on success.
 */
async function addUserToTeam({
  teamSlug,
  user,
  org,
  accessToken,
}: {
  teamSlug: string;
  user: { username: string; role?: 'member' | 'maintainer' };
  org: string;
  accessToken: string;
}): Promise<GitHubResult<{ team: string; username: string }>> {
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request(
      'PUT /orgs/{org}/teams/{team_slug}/memberships/{username}',
      {
        org,
        team_slug: teamSlug,
        username: user.username,
        role: user.role ?? 'member',
      },
    );
    return ok({ team: teamSlug, username: user.username });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error adding user ${user.username} to team ${teamSlug}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error adding user ${user.username} to team ${teamSlug}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Adds one or more users to one or more GitHub teams within an organization.
 * Validates that each team and user exist before adding. Invalid entries are reported as errors
 * while valid combinations are processed.
 * @param parameters - The organization name, list of team slugs, list of users with optional roles, and access token.
 * @returns A GitHubResult wrapping arrays of successfully added user/team pairs and error messages.
 */
export async function addGitHubUsersToTeams(
  parameters: AddUsersToTeamsParameters & { accessToken: string | undefined },
): Promise<
  GitHubResult<{
    addedUsers: { team: string; username: string }[];
    errors: string[];
  }>
> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  const addUsersResponse: {
    addedUsers: { team: string; username: string }[];
    errors: string[];
  } = {
    addedUsers: [],
    errors: [],
  };

  const validTeams: string[] = [];
  for (const teamSlug of params.teams) {
    const teamExists = await githubExistsRequest(
      'team',
      { org: params.org, team_slug: teamSlug },
      accessToken,
    );

    if (!teamExists) {
      addUsersResponse.errors.push(
        `Error: team ${teamSlug} does not exist in organization ${params.org}`,
      );
    } else {
      validTeams.push(teamSlug);
    }
  }

  const validUsers: { username: string; role?: 'member' | 'maintainer' }[] = [];
  for (const user of params.users) {
    const userExists = await githubExistsRequest(
      'user',
      { username: user.username },
      accessToken,
    );

    if (!userExists) {
      addUsersResponse.errors.push(
        `Error: user ${user.username} does not exist`,
      );
    } else {
      validUsers.push(user);
    }
  }

  const additionPromises = validTeams.flatMap((teamSlug) =>
    validUsers.map((user) =>
      addUserToTeam({
        teamSlug,
        user,
        org: params.org,
        accessToken,
      }),
    ),
  );

  const results = await Promise.allSettled(additionPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const inner = result.value;
      if (inner.success) {
        addUsersResponse.addedUsers.push(inner.data);
      } else {
        addUsersResponse.errors.push(inner.error.message);
      }
    } else {
      addUsersResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(addUsersResponse);
}
