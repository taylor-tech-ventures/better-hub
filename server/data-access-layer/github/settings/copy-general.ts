import type { RepoSettings } from '@/server/data-access-layer/github/repo/get-settings';
import { getGitHubRepoSettings } from '@/server/data-access-layer/github/repo/get-settings';
import { updateGitHubRepoSettings } from '@/server/data-access-layer/github/repo/update-settings';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'copy-general' });

export type CopyGitHubGeneralSettingsParameters = {
  owner: string;
  sourceRepo: string;
  targetRepos: string[];
  /**
   * The specific settings keys to copy. When omitted, all settings (except `name`) are copied.
   */
  settings?: (keyof Omit<RepoSettings, 'name'>)[];
};

type CopySettingsResult = {
  repo: string;
  success: boolean;
  error?: string;
  updated_fields?: string[];
};

/**
 * Copies general repository settings (such as the default branch, merge strategies,
 * and "automatically delete head branches") from a source repository to one or more
 * target repositories in the same GitHub organization.
 *
 * By default all settings except `name` are copied. Pass a `settings` array to restrict
 * which fields are applied to the target repositories.
 * @param params - The owner, source repo, target repos, optional settings filter, and access token.
 * @returns An array of copy results per target repository.
 */
export async function copyGitHubGeneralSettings({
  owner,
  sourceRepo,
  targetRepos,
  settings,
  accessToken,
}: CopyGitHubGeneralSettingsParameters & {
  accessToken: string;
}): Promise<CopySettingsResult[]> {
  const results: CopySettingsResult[] = [];

  try {
    const sourceExists = await githubExistsRequest(
      'repo',
      { owner, repo: sourceRepo },
      accessToken,
    );

    if (!sourceExists) {
      results.push({
        repo: sourceRepo,
        success: false,
        error: `Error: source repository ${owner}/${sourceRepo} does not exist`,
      });
      return results;
    }

    const validTargetRepos: string[] = [];
    for (const targetRepo of targetRepos) {
      const targetExists = await githubExistsRequest(
        'repo',
        { owner, repo: targetRepo },
        accessToken,
      );

      if (!targetExists) {
        results.push({
          repo: targetRepo,
          success: false,
          error: `Error: target repository ${owner}/${targetRepo} does not exist`,
        });
      } else {
        validTargetRepos.push(targetRepo);
      }
    }

    if (validTargetRepos.length === 0) {
      return results;
    }

    const sourceSettingsResult = await getGitHubRepoSettings({
      owner,
      repo: sourceRepo,
      accessToken,
    });

    if (!sourceSettingsResult.success) {
      throw new Error(sourceSettingsResult.error.message);
    }

    const { name: _name, ...copyableSettings } = sourceSettingsResult.data;

    const settingsToCopy: Partial<Omit<RepoSettings, 'name'>> =
      settings && settings.length > 0
        ? (Object.fromEntries(
            settings.map((key) => [key, copyableSettings[key]]),
          ) as Partial<Omit<RepoSettings, 'name'>>)
        : copyableSettings;

    for (const targetRepo of validTargetRepos) {
      try {
        logger.info(
          {
            source: `${owner}/${sourceRepo}`,
            target: `${owner}/${targetRepo}`,
          },
          'copying general settings',
        );

        const updateResults = await updateGitHubRepoSettings({
          owner,
          repos: [targetRepo],
          settings: settingsToCopy,
          accessToken,
        });

        if (!updateResults.success) {
          results.push({
            repo: targetRepo,
            success: false,
            error: updateResults.error.message,
          });
          continue;
        }

        const repoResult = updateResults.data[0];
        if (repoResult) {
          results.push({
            repo: targetRepo,
            success: repoResult.success,
            error: repoResult.error,
            updated_fields: repoResult.updated_fields,
          });
        }
      } catch (err) {
        logger.error(
          { err, owner, repo: targetRepo },
          'error copying general settings',
        );
        const error = err;
        results.push({
          repo: targetRepo,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (err) {
    logger.error(
      { err, owner, repo: sourceRepo },
      'error copying general settings from source',
    );
    const error = err;
    results.push({
      repo: sourceRepo,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}
