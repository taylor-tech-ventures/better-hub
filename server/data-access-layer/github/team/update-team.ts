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
 * Updates a team in a GitHub organization.
 * @param params - The organization, team slug, optional fields to update, and access token.
 * @returns A GitHubResult wrapping the updated team info.
 */
export async function updateTeam(params: {
  accessToken: string | undefined;
  org: string;
  team_slug: string;
  name?: string;
  description?: string;
  privacy?: 'closed' | 'secret';
  notification_setting?: 'notifications_enabled' | 'notifications_disabled';
}): Promise<GitHubResult<TeamInfo>> {
  const {
    accessToken,
    org,
    team_slug,
    name,
    description,
    privacy,
    notification_setting,
  } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'PATCH /orgs/{org}/teams/{team_slug}',
      {
        org,
        team_slug,
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(privacy !== undefined ? { privacy } : {}),
        ...(notification_setting !== undefined ? { notification_setting } : {}),
      },
    );

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
        `Error updating team "${team_slug}" in ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error updating team "${team_slug}" in ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
