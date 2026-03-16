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

export type RulesetBypassActor = {
  actor_id?: number | null;
  actor_type:
    | 'Integration'
    | 'OrganizationAdmin'
    | 'RepositoryRole'
    | 'Team'
    | 'DeployKey';
  bypass_mode?: 'pull_request' | 'always';
};

export type RulesetConditions = {
  ref_name?: {
    include?: string[];
    exclude?: string[];
  };
};

export type RulesetRule = {
  type: string;
  parameters?: Record<string, unknown>;
};

export type CreateRepoRulesetParameters = {
  owner: string;
  repo: string;
  ruleset: {
    name: string;
    enforcement: 'active' | 'disabled' | 'evaluate';
    target: 'branch' | 'tag' | 'push';
    bypass_actors?: RulesetBypassActor[];
    conditions?: RulesetConditions;
    rules?: RulesetRule[];
  };
};

export type CreateRepoRulesetResponse =
  GitHubApiEndpoints['POST /repos/{owner}/{repo}/rulesets']['response']['data'];

/**
 * Creates a new ruleset for a GitHub repository.
 * Validates that the repository exists before creating the ruleset.
 * @param parameters - The owner, repo, ruleset configuration, and access token.
 * @returns A GitHubResult wrapping the created ruleset data.
 */
export async function createGitHubRepoRuleset(
  parameters: CreateRepoRulesetParameters & { accessToken: string | undefined },
): Promise<GitHubResult<CreateRepoRulesetResponse>> {
  const { accessToken, owner, repo, ruleset } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error creating ruleset for the repository ${owner}/${repo}. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner, repo },
      accessToken,
    );

    if (!repoExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Repository ${owner}/${repo} does not exist.`,
      );
    }

    const octokit = getOctokit(accessToken);
    const response = await octokit.request(
      'POST /repos/{owner}/{repo}/rulesets',
      {
        owner,
        repo,
        name: ruleset.name,
        enforcement: ruleset.enforcement as 'active' | 'disabled' | 'evaluate',
        target: ruleset.target as 'branch' | 'tag' | 'push' | undefined,
        bypass_actors: ruleset.bypass_actors as
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
        conditions: ruleset.conditions as
          | {
              ref_name?: {
                include?: string[];
                exclude?: string[];
              };
            }
          | undefined,
        rules: ruleset.rules as
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
    return ok(response.data);
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating ruleset for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating ruleset for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
