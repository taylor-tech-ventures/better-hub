import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type TeamInfo = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  privacy: string;
  html_url: string;
};

/**
 * Creates a new team in a GitHub organization.
 * @param params - The organization, team name, optional description/privacy/parent, and access token.
 * @returns A GitHubResult wrapping the created team info.
 */
export async function createTeam(params: {
  accessToken: string | undefined;
  org: string;
  name: string;
  description?: string;
  privacy?: 'closed' | 'secret';
  parentTeamId?: number;
}): Promise<GitHubResult<TeamInfo>> {
  const { accessToken, org, name, description, privacy, parentTeamId } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request('POST /orgs/{org}/teams', {
      org,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(privacy !== undefined ? { privacy } : {}),
      ...(parentTeamId !== undefined ? { parent_team_id: parentTeamId } : {}),
    });

    return ok({
      id: data.id,
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      privacy: data.privacy ?? 'closed',
      html_url: data.html_url,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating team "${name}" in ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating team "${name}" in ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
