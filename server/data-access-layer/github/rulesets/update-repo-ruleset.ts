import { RequestError } from '@octokit/request-error';
import type { Endpoints as GitHubApiEndpoints } from '@octokit/types';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';
import type {
  RulesetBypassActor,
  RulesetConditions,
  RulesetRule,
} from './create-repo-ruleset';

export type UpdateRepoRulesetParameters = {
  owner: string;
  repo: string;
  rulesetId: string;
  ruleset: {
    name?: string;
    enforcement?: 'active' | 'disabled' | 'evaluate';
    target?: 'branch' | 'tag' | 'push';
    bypass_actors?: RulesetBypassActor[];
    conditions?: RulesetConditions;
    rules?: RulesetRule[];
  };
};

export type UpdateRepoRulesetResponse =
  GitHubApiEndpoints['PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}']['response']['data'];

/**
 * Updates an existing ruleset in a GitHub repository.
 * Validates that the repository exists before updating.
 * @param parameters - The owner, repo, ruleset ID string, partial ruleset configuration to update, and access token.
 * @returns A GitHubResult wrapping the updated ruleset data.
 */
export async function updateGitHubRepoRuleset(
  parameters: UpdateRepoRulesetParameters & { accessToken: string | undefined },
): Promise<GitHubResult<UpdateRepoRulesetResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error updating ruleset ${params.rulesetId} for the repository ${params.owner}/${params.repo}. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo: params.repo },
      accessToken,
    );

    if (!repoExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Repository ${params.owner}/${params.repo} does not exist.`,
      );
    }

    const octokit = getOctokit(accessToken);
    const response = await octokit.request(
      'PATCH /repos/{owner}/{repo}/rulesets/{ruleset_id}',
      {
        owner: params.owner,
        repo: params.repo,
        ruleset_id: Number(params.rulesetId),
        ...params.ruleset,
        target: params.ruleset.target as 'branch' | 'tag' | 'push' | undefined,
        bypass_actors: params.ruleset.bypass_actors as
          | {
              actor_id?: number | null;
              actor_type:
                | 'Integration'
                | 'OrganizationAdmin'
                | 'RepositoryRole'
                | 'Team'
                | 'DeployKey';
              bypass_mode?: 'pull_request' | 'always';
            }[]
          | undefined,
        conditions: params.ruleset.conditions as
          | {
              ref_name?: {
                include?: string[];
                exclude?: string[];
              };
            }
          | undefined,
        rules: params.ruleset.rules as
          | (
              | { type: 'creation' }
              | {
                  type: 'update';
                  parameters?: {
                    update_allows_fetch_and_merge: boolean;
                  };
                }
              | { type: 'deletion' }
              | { type: 'required_linear_history' }
              | {
                  type: 'merge_queue';
                  parameters?: {
                    check_response_timeout_minutes: number;
                    grouping_strategy: 'ALLGREEN' | 'HEADGREEN';
                    max_entries_to_build: number;
                    max_entries_to_merge: number;
                    merge_method: 'MERGE' | 'SQUASH' | 'REBASE';
                    min_entries_to_merge: number;
                    min_entries_to_merge_wait_minutes: number;
                  };
                }
            )[]
          | undefined,
      },
    );
    return ok(response.data as UpdateRepoRulesetResponse);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error updating ruleset ${params.rulesetId} for ${params.owner}/${params.repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error updating ruleset ${params.rulesetId} for ${params.owner}/${params.repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
