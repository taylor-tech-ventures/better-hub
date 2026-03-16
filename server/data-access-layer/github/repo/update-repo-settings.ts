import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type RepoSettingsUpdate = {
  has_wiki?: boolean;
  has_issues?: boolean;
  has_projects?: boolean;
  has_discussions?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  default_branch?: string;
};

/**
 * Updates settings on a GitHub repository.
 * @param params - The owner, repo name, settings to update, and access token.
 * @returns A GitHubResult wrapping the full name and the settings that were applied.
 */
export async function updateRepoSettings(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  settings: RepoSettingsUpdate;
}): Promise<
  GitHubResult<{
    full_name: string;
    updated_settings: Record<string, boolean | string>;
  }>
> {
  const { accessToken, owner, repo, settings } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request('PATCH /repos/{owner}/{repo}', {
      owner,
      repo,
      ...settings,
    });

    const updatedSettings: Record<string, boolean | string> = {};
    for (const key of Object.keys(settings) as (keyof RepoSettingsUpdate)[]) {
      const value = data[key as keyof typeof data];
      if (value !== undefined) {
        updatedSettings[key] = value as boolean | string;
      }
    }

    return ok({
      full_name: data.full_name,
      updated_settings: updatedSettings,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error updating settings for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error updating settings for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
