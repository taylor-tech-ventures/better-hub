import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type ChildTeam = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  privacy: string;
};

/**
 * Lists child teams of a team in a GitHub organization.
 * @param params - The organization, parent team slug, and access token.
 * @returns A GitHubResult wrapping the list of child teams.
 */
export async function listChildTeams(params: {
  accessToken: string | undefined;
  org: string;
  team_slug: string;
}): Promise<GitHubResult<ChildTeam[]>> {
  const { accessToken, org, team_slug } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.paginate(
      'GET /orgs/{org}/teams/{team_slug}/teams',
      {
        org,
        team_slug,
      },
    );

    const children: ChildTeam[] = response.map((team) => ({
      id: team.id,
      slug: team.slug,
      name: team.name,
      description: team.description ?? null,
      privacy: team.privacy ?? 'closed',
    }));

    return ok(children);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing child teams of "${team_slug}" in ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing child teams of "${team_slug}" in ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
