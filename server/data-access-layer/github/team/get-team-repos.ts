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

export type GetTeamReposResponse = Array<{
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  role_name: string;
}>;

export type GetTeamReposParameters = {
  org: string;
  teamSlug: string;
};

/**
 * Normalizes a repository permissions object from the GitHub API response,
 * ensuring all permission fields are boolean values.
 * @param repoPermissions - The raw permissions object from the GitHub API, possibly undefined.
 * @returns A normalized permissions object with all five standard permission keys as booleans.
 */
function getRepoPermissions(
  repoPermissions: { [key: string]: boolean | undefined } | undefined,
): {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
  [key: string]: boolean;
} {
  if (!repoPermissions) {
    return {
      admin: false,
      maintain: false,
      push: false,
      triage: false,
      pull: false,
    };
  }
  const { admin, maintain, push, triage, pull } = repoPermissions;
  return {
    admin: admin ?? false,
    maintain: maintain ?? false,
    push: push ?? false,
    triage: triage ?? false,
    pull: pull ?? false,
    ...repoPermissions,
  };
}

/**
 * Fetches all repositories accessible to a specific team within a GitHub organization.
 * Validates that the team exists before querying.
 * @param parameters - The organization name, team slug, and access token.
 * @returns A GitHubResult wrapping the list of repository objects with permissions.
 */
export async function getGitHubTeamRepos(
  parameters: GetTeamReposParameters & { accessToken: string | undefined },
): Promise<GitHubResult<GetTeamReposResponse>> {
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
      { org: params.org, team_slug: params.teamSlug },
      accessToken,
    );

    if (!teamExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Team ${params.teamSlug} does not exist in organization ${params.org}.`,
      );
    }

    const octokit = getOctokit(accessToken);
    const response = await octokit.paginate(
      'GET /orgs/{org}/teams/{team_slug}/repos',
      {
        org: params.org,
        team_slug: params.teamSlug,
      },
    );

    const repositories = response.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      permissions: getRepoPermissions(repo.permissions),
      role_name: repo.role_name || 'unknown',
    }));

    return ok(repositories);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error getting team repositories: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error getting team repositories: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
