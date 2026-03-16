import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import type { RepoSettings } from '@/server/data-access-layer/github/repo/get-settings';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type UpdateGitHubRepoSettingsParameters = {
  owner: string;
  repos: string[];
  settings: Partial<Omit<RepoSettings, 'name'>>;
};

type UpdateSettingsResult = {
  repo: string;
  success: boolean;
  error?: string;
  updated_fields?: string[];
};

/**
 * Updates general settings for one or more GitHub repositories by applying the
 * provided settings object to each repository via PATCH /repos/{owner}/{repo}.
 * @param parameters - The owner, list of repo names, settings to apply, and access token.
 * @returns A GitHubResult wrapping an array of update results per repository.
 */
export async function updateGitHubRepoSettings(
  parameters: UpdateGitHubRepoSettingsParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<UpdateSettingsResult[]>> {
  const { accessToken, ...params } = parameters;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'Error updating repository settings. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: UpdateSettingsResult[] = [];

    for (const repo of params.repos) {
      try {
        const repoExists = await githubExistsRequest(
          'repo',
          { owner: params.owner, repo },
          accessToken,
        );

        if (!repoExists) {
          results.push({
            repo,
            success: false,
            error: `Repository ${params.owner}/${repo} does not exist`,
          });
          continue;
        }

        const cleanSettings = Object.fromEntries(
          Object.entries(params.settings).filter(
            ([_, value]) => value !== undefined,
          ),
        );

        if (Object.keys(cleanSettings).length === 0) {
          results.push({
            repo,
            success: false,
            error: 'No valid settings provided',
          });
          continue;
        }

        await octokit.rest.repos.update({
          owner: params.owner,
          repo,
          ...cleanSettings,
        });

        results.push({
          repo,
          success: true,
          updated_fields: Object.keys(cleanSettings),
        });
      } catch (error) {
        if (error instanceof OctokitError) {
          results.push({
            repo,
            success: false,
            error: `Error updating repository settings: ${error.message} (status: ${error.status})`,
          });
        } else {
          results.push({
            repo,
            success: false,
            error: `Error updating repository settings: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error updating repository settings: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error updating repository settings: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
