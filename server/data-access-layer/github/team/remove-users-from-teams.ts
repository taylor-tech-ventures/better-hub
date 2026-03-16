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

export type RemoveUsersFromTeamsParameters = {
  org: string;
  teams: string[];
  users: {
    username: string;
  }[];
};

/**
 * Removes a user from a single GitHub team.
 * @param params - The team slug, user (username), organization, and access token.
 * @returns A GitHubResult wrapping the team slug and username on success.
 */
async function removeUserFromTeam({
  teamSlug,
  user,
  org,
  accessToken,
}: {
  teamSlug: string;
  user: { username: string };
  org: string;
  accessToken: string;
}): Promise<GitHubResult<{ team: string; username: string }>> {
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request(
      'DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}',
      {
        org,
        team_slug: teamSlug,
        username: user.username,
      },
    );
    return ok({ team: teamSlug, username: user.username });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error removing user ${user.username} from team ${teamSlug}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error removing user ${user.username} from team ${teamSlug}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Removes one or more users from one or more GitHub teams within an organization.
 * Validates that each team and user exist before removing. Invalid entries are reported as errors
 * while valid combinations are processed.
 * @param parameters - The organization name, list of team slugs, list of users, and access token.
 * @returns A GitHubResult wrapping arrays of successfully removed user/team pairs and error messages.
 */
export async function removeGitHubUsersFromTeams(
  parameters: RemoveUsersFromTeamsParameters & {
    accessToken: string | undefined;
  },
): Promise<
  GitHubResult<{
    removedUsers: { team: string; username: string }[];
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

  const removeUsersResponse: {
    removedUsers: { team: string; username: string }[];
    errors: string[];
  } = {
    removedUsers: [],
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
      removeUsersResponse.errors.push(
        `Error: team ${teamSlug} does not exist in organization ${params.org}`,
      );
    } else {
      validTeams.push(teamSlug);
    }
  }

  const validUsers: { username: string }[] = [];
  for (const user of params.users) {
    const userExists = await githubExistsRequest(
      'user',
      { username: user.username },
      accessToken,
    );

    if (!userExists) {
      removeUsersResponse.errors.push(
        `Error: user ${user.username} does not exist`,
      );
    } else {
      validUsers.push(user);
    }
  }

  const removalPromises = validTeams.flatMap((teamSlug) =>
    validUsers.map((user) =>
      removeUserFromTeam({
        teamSlug,
        user,
        org: params.org,
        accessToken,
      }),
    ),
  );

  const results = await Promise.allSettled(removalPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const inner = result.value;
      if (inner.success) {
        removeUsersResponse.removedUsers.push(inner.data);
      } else {
        removeUsersResponse.errors.push(inner.error.message);
      }
    } else {
      removeUsersResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(removeUsersResponse);
}
