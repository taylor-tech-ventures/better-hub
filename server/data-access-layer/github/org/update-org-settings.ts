import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type OrgSettingsUpdate = {
  name?: string;
  description?: string;
  company?: string;
  location?: string;
  email?: string;
  blog?: string;
  default_repository_permission?: 'read' | 'write' | 'admin' | 'none';
  members_can_create_repositories?: boolean;
  members_can_create_public_repositories?: boolean;
  members_can_create_private_repositories?: boolean;
  two_factor_requirement_enabled?: boolean;
};

/**
 * Updates organization settings.
 */
export async function updateOrgSettings(params: {
  accessToken: string | undefined;
  org: string;
  settings: OrgSettingsUpdate;
}): Promise<
  GitHubResult<{ login: string; updated_settings: Record<string, unknown> }>
> {
  const { accessToken, org, settings } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    await octokit.request('PATCH /orgs/{org}', {
      org,
      ...settings,
    });

    return ok({
      login: org,
      updated_settings: settings as Record<string, unknown>,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error updating settings for org ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error updating settings for org ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
