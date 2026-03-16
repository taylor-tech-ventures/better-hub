import type { RepoSettings } from '@/server/data-access-layer/github/repo/get-settings';
import { getGitHubRepoSettings } from '@/server/data-access-layer/github/repo/get-settings';
import { updateGitHubRepoSettings } from '@/server/data-access-layer/github/repo/update-settings';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'synchronize-general' });

export type SynchronizeGitHubGeneralSettingsParameters = {
  owner: string;
  sourceRepo: string;
  targetRepos: string[];
  /**
   * The specific settings keys to synchronize. When omitted, all settings (except `name`) are synchronized.
   */
  settings?: (keyof Omit<RepoSettings, 'name'>)[];
};

type SyncSettingResult = {
  repo: string;
  setting: string;
  action: 'updated' | 'unchanged';
  sourceValue: unknown;
  targetValue: unknown;
  success: boolean;
  error?: string;
};

type SynchronizeSettingsResult = {
  repo: string;
  success: boolean;
  error?: string;
  settings: SyncSettingResult[];
};

/**
 * Compares the general repository settings of a source repository against each target
 * repository and applies only the settings that differ, leaving already-matching settings
 * untouched. Returns a per-setting breakdown of what was updated versus what was already
 * in sync.
 *
 * By default all settings except `name` are synchronized. Pass a `settings` array to
 * restrict which fields are compared and applied.
 * @param params - The owner, source repo, target repos, optional settings filter, and access token.
 * @returns An array of synchronization results per target repository, including per-setting details.
 */
export async function synchronizeGitHubGeneralSettings({
  owner,
  sourceRepo,
  targetRepos,
  settings,
  accessToken,
}: SynchronizeGitHubGeneralSettingsParameters & {
  accessToken: string;
}): Promise<SynchronizeSettingsResult[]> {
  const results: SynchronizeSettingsResult[] = [];

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
        settings: [],
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
          settings: [],
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

    const { name: _name, ...syncableSettings } = sourceSettingsResult.data;

    const keysToSync =
      settings && settings.length > 0
        ? settings
        : (Object.keys(syncableSettings) as (keyof Omit<
            RepoSettings,
            'name'
          >)[]);

    for (const targetRepo of validTargetRepos) {
      const settingResults: SyncSettingResult[] = [];

      try {
        logger.info(
          {
            source: `${owner}/${sourceRepo}`,
            target: `${owner}/${targetRepo}`,
          },
          'synchronizing general settings',
        );

        const targetSettingsResult = await getGitHubRepoSettings({
          owner,
          repo: targetRepo,
          accessToken,
        });

        if (!targetSettingsResult.success) {
          results.push({
            repo: targetRepo,
            success: false,
            error: targetSettingsResult.error.message,
            settings: [],
          });
          continue;
        }

        const { name: _targetName, ...targetSyncableSettings } =
          targetSettingsResult.data;

        const diffSettings: Partial<Omit<RepoSettings, 'name'>> = {};

        for (const key of keysToSync) {
          const sourceValue = syncableSettings[key];
          const targetValue = targetSyncableSettings[key];

          if (sourceValue !== targetValue) {
            diffSettings[key] = sourceValue as never;
            settingResults.push({
              repo: targetRepo,
              setting: key,
              action: 'updated',
              sourceValue,
              targetValue,
              success: false,
            });
          } else {
            settingResults.push({
              repo: targetRepo,
              setting: key,
              action: 'unchanged',
              sourceValue,
              targetValue,
              success: true,
            });
          }
        }

        const settingsToUpdate = Object.keys(diffSettings);

        if (settingsToUpdate.length === 0) {
          logger.info(
            { owner, repo: targetRepo },
            'all settings already in sync, skipping update',
          );
          results.push({
            repo: targetRepo,
            success: true,
            settings: settingResults,
          });
          continue;
        }

        const updateResults = await updateGitHubRepoSettings({
          owner,
          repos: [targetRepo],
          settings: diffSettings,
          accessToken,
        });

        if (!updateResults.success) {
          results.push({
            repo: targetRepo,
            success: false,
            error: updateResults.error.message,
            settings: settingResults.map((s) =>
              s.action === 'updated'
                ? { ...s, success: false, error: updateResults.error.message }
                : s,
            ),
          });
          continue;
        }

        const repoResult = updateResults.data[0];
        const updateSucceeded = repoResult?.success ?? false;
        const updateError = repoResult?.error;

        results.push({
          repo: targetRepo,
          success: updateSucceeded,
          error: updateError,
          settings: settingResults.map((s) =>
            s.action === 'updated'
              ? { ...s, success: updateSucceeded, error: updateError }
              : s,
          ),
        });
      } catch (err) {
        logger.error(
          { err, owner, repo: targetRepo },
          'error synchronizing general settings',
        );
        const error = err;
        results.push({
          repo: targetRepo,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          settings: settingResults,
        });
      }
    }
  } catch (err) {
    logger.error(
      { err, owner, repo: sourceRepo },
      'error synchronizing general settings from source',
    );
    const error = err;
    results.push({
      repo: sourceRepo,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      settings: [],
    });
  }

  return results;
}
