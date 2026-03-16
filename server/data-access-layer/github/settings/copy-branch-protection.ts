import { createGitHubRepoRuleset } from '@/server/data-access-layer/github/rulesets/create-repo-ruleset';
import { getGitHubRepoRulesetById } from '@/server/data-access-layer/github/rulesets/get-repo-ruleset-by-id';
import { getGitHubRepoRulesets } from '@/server/data-access-layer/github/rulesets/get-repo-rulesets';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'copy-branch-protection' });

export type CopyGitHubBranchProtectionParameters = {
  owner: string;
  sourceRepo: string;
  targetRepos: string[];
};

/**
 * Strips GET-only metadata fields (such as `_links`) from a ruleset object
 * so it can be used in a creation request.
 * @param ruleset - The full ruleset object from a GET response.
 * @returns A cleaned ruleset object suitable for use in POST/PATCH requests.
 */
function cleanRulesetForCreation(
  ruleset: Record<string, unknown>,
): Record<string, unknown> {
  const { _links, ...cleanRuleset } = ruleset;

  return cleanRuleset;
}

/**
 * Checks whether any ruleset in `existingRulesets` is functionally identical to `newRulesetData`
 * by comparing rules, conditions, target, and enforcement.
 * @param existingRulesets - The list of rulesets already in the target repository.
 * @param newRulesetData - The cleaned ruleset data that would be created.
 * @param owner - The organization owner.
 * @param repo - The target repository name.
 * @param accessToken - The GitHub OAuth access token.
 * @returns The name of the duplicate ruleset if found, or `null` if no duplicate exists.
 */
async function checkForFunctionalDuplicate(
  existingRulesets: Array<{ id: number; name: string }>,
  newRulesetData: Record<string, unknown>,
  owner: string,
  repo: string,
  accessToken: string,
): Promise<string | null> {
  for (const existingRuleset of existingRulesets) {
    try {
      const fullExistingRuleset = await getGitHubRepoRulesetById({
        owner,
        repo,
        rulesetId: existingRuleset.id.toString(),
        accessToken,
      });

      if (!fullExistingRuleset.success) {
        continue;
      }

      const cleanExistingRuleset = cleanRulesetForCreation(
        fullExistingRuleset.data as Record<string, unknown>,
      );

      if (
        JSON.stringify(cleanExistingRuleset.rules) ===
          JSON.stringify(newRulesetData.rules) &&
        JSON.stringify(cleanExistingRuleset.conditions) ===
          JSON.stringify(newRulesetData.conditions) &&
        cleanExistingRuleset.target === newRulesetData.target &&
        cleanExistingRuleset.enforcement === newRulesetData.enforcement
      ) {
        return existingRuleset.name;
      }
    } catch (err) {
      logger.warn(
        { err, ruleset: existingRuleset.name },
        'error checking existing ruleset',
      );
    }
  }

  return null;
}

/**
 * Copies rulesets (branch protection) from a source repository to one or more target repositories
 * in the same GitHub organization. Skips rulesets that already exist by name or are functionally
 * identical to an existing ruleset in the target repository.
 * @param params - The owner, source repo, target repos, and access token.
 * @returns An array of copy results per ruleset per target repository.
 */
export async function copyGitHubBranchProtection({
  owner,
  sourceRepo,
  targetRepos,
  accessToken,
}: CopyGitHubBranchProtectionParameters & {
  accessToken: string;
}): Promise<
  {
    repo: string;
    ruleset: string;
    success: boolean;
    error?: string;
    warnings?: string[];
  }[]
> {
  const results: {
    repo: string;
    ruleset: string;
    success: boolean;
    error?: string;
    warnings?: string[];
  }[] = [];

  try {
    const sourceExists = await githubExistsRequest(
      'repo',
      { owner, repo: sourceRepo },
      accessToken,
    );

    if (!sourceExists) {
      results.push({
        repo: sourceRepo,
        ruleset: '',
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
          ruleset: '',
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

    const sourceRulesets = await getGitHubRepoRulesets({
      owner,
      repo: sourceRepo,
      accessToken,
    });

    if (!sourceRulesets.success) {
      throw new Error(sourceRulesets.error.message);
    }

    if (!sourceRulesets.data.length) {
      logger.info(
        { owner, repo: sourceRepo },
        'no rulesets found on source repository, skipping',
      );
      return results;
    }

    for (const targetRepo of validTargetRepos) {
      for (const sourceRuleset of sourceRulesets.data) {
        try {
          logger.info(
            {
              ruleset: sourceRuleset.name,
              source: `${owner}/${sourceRepo}`,
              target: `${owner}/${targetRepo}`,
            },
            'copying ruleset',
          );

          const fullSourceRuleset = await getGitHubRepoRulesetById({
            owner,
            repo: sourceRepo,
            rulesetId: sourceRuleset.id.toString(),
            accessToken,
          });

          if (!fullSourceRuleset.success) {
            throw new Error(
              `Failed to fetch ruleset details: ${fullSourceRuleset.error.message}`,
            );
          }

          const targetRulesetParams = cleanRulesetForCreation(
            fullSourceRuleset.data as Record<string, unknown>,
          );

          const existingRulesets = await getGitHubRepoRulesets({
            owner,
            repo: targetRepo,
            accessToken,
          });

          if (!existingRulesets.success) {
            logger.error(
              {
                owner,
                repo: targetRepo,
                error: existingRulesets.error.message,
              },
              'error fetching existing rulesets',
            );
            continue;
          }

          const existingRulesetNames = existingRulesets.data.map((r) => r.name);

          if (
            existingRulesetNames.includes(targetRulesetParams.name as string)
          ) {
            logger.info(
              { ruleset: targetRulesetParams.name, owner, repo: targetRepo },
              'ruleset already exists, skipping',
            );
            results.push({
              repo: targetRepo,
              ruleset: sourceRuleset.name,
              success: false,
              warnings: ['Ruleset already exists with this name'],
            });
            continue;
          }

          const functionalDuplicate = await checkForFunctionalDuplicate(
            existingRulesets.data,
            targetRulesetParams,
            owner,
            targetRepo,
            accessToken,
          );

          if (functionalDuplicate) {
            logger.info(
              { duplicate: functionalDuplicate, owner, repo: targetRepo },
              'functionally identical ruleset already exists, skipping',
            );
            results.push({
              repo: targetRepo,
              ruleset: sourceRuleset.name,
              success: false,
              warnings: [
                `Functionally identical ruleset "${functionalDuplicate}" already exists`,
              ],
            });
            continue;
          }

          logger.info(
            { ruleset: targetRulesetParams.name, owner, repo: targetRepo },
            'creating new ruleset',
          );
          await createGitHubRepoRuleset({
            owner,
            repo: targetRepo,
            ruleset: targetRulesetParams,
            accessToken,
          });

          results.push({
            repo: targetRepo,
            ruleset: sourceRuleset.name,
            success: true,
          });
        } catch (err) {
          logger.error(
            { err, ruleset: sourceRuleset.name, owner, repo: targetRepo },
            'error copying ruleset',
          );
          const error = err;
          results.push({
            repo: targetRepo,
            ruleset: sourceRuleset.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err, owner, repo: sourceRepo }, 'error copying rulesets');
    const error = err;
    results.push({
      repo: sourceRepo,
      ruleset: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}
