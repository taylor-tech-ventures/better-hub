import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type RepoUpdateFields = {
  name: string;
  description?: string;
  homepage?: string;
  private?: boolean;
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  is_template?: boolean;
  default_branch?: string;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_update_branch?: boolean;
  use_squash_pr_title_as_default?: boolean;
  squash_merge_commit_title?: 'PR_TITLE' | 'COMMIT_OR_PR_TITLE';
  squash_merge_commit_message?: 'PR_BODY' | 'COMMIT_MESSAGES' | 'BLANK';
  merge_commit_title?: 'PR_TITLE' | 'MERGE_MESSAGE';
  merge_commit_message?: 'PR_TITLE' | 'PR_BODY' | 'BLANK';
  archived?: boolean;
};

export type UpdateReposParameters = {
  owner: string;
  repos: RepoUpdateFields[];
};

type UpdateResult = {
  repo: string;
  success: boolean;
  error?: string;
  updated_fields?: string[];
};

/**
 * Updates settings for one or more GitHub repositories.
 * For each repository, validates existence and (if changing the default branch) that the
 * target branch exists before applying the update.
 * @param parameters - The owner, list of repositories with their new settings, and access token.
 * @returns A GitHubResult wrapping an array of update results per repository.
 */
export async function updateGitHubRepos(
  parameters: UpdateReposParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<UpdateResult[]>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'Error updating repositories. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: UpdateResult[] = [];

    for (const repoUpdate of params.repos) {
      const { name, ...updateData } = repoUpdate;

      try {
        const repoExists = await githubExistsRequest(
          'repo',
          { owner: params.owner, repo: name },
          accessToken,
        );

        if (!repoExists) {
          results.push({
            repo: name,
            success: false,
            error: `Repository ${params.owner}/${name} does not exist`,
          });
          continue;
        }

        if (updateData.default_branch) {
          const branchExists = await githubExistsRequest(
            'branch',
            {
              owner: params.owner,
              repo: name,
              branch: updateData.default_branch,
            },
            accessToken,
          );

          if (!branchExists) {
            results.push({
              repo: name,
              success: false,
              error: `Branch '${updateData.default_branch}' does not exist in repository ${params.owner}/${name}`,
            });
            continue;
          }
        }

        const cleanUpdateData = Object.fromEntries(
          Object.entries(updateData).filter(
            ([_, value]) => value !== undefined,
          ),
        );

        if (Object.keys(cleanUpdateData).length === 0) {
          results.push({
            repo: name,
            success: false,
            error: 'No valid update fields provided',
          });
          continue;
        }

        await octokit.rest.repos.update({
          owner: params.owner,
          repo: name,
          ...cleanUpdateData,
        });

        results.push({
          repo: name,
          success: true,
          updated_fields: Object.keys(cleanUpdateData),
        });
      } catch (error) {
        if (error instanceof OctokitError) {
          results.push({
            repo: name,
            success: false,
            error: `Error updating repository: ${error.message} (status: ${error.status})`,
          });
        } else if (error instanceof Error) {
          results.push({
            repo: name,
            success: false,
            error: `Error updating repository: ${error.message}`,
          });
        } else {
          results.push({
            repo: name,
            success: false,
            error: `Unknown error updating repository: ${JSON.stringify(error)}`,
          });
        }
      }
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error updating repositories: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error updating repositories: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
