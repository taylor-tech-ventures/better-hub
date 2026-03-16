import { RequestError as OctokitError } from '@octokit/request-error';
import type { Endpoints } from '@octokit/types';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

/**
 * The repository settings that are valid parameters for PATCH /repos/{owner}/{repo},
 * derived directly from the Octokit endpoint type. Path parameters (`owner` and `repo`)
 * are excluded so this type can be passed directly to the update endpoint body without modification.
 */
export type RepoSettings = Omit<
  Endpoints['PATCH /repos/{owner}/{repo}']['parameters'],
  'owner' | 'repo'
>;

export type GetGitHubRepoSettingsParameters = {
  owner: string;
  repo: string;
};

/**
 * Fetches the settings for a GitHub repository and returns only the fields that
 * are valid for use in a PATCH /repos/{owner}/{repo} request, stripping metadata
 * fields such as API URLs, counts, and identifiers.
 * @param parameters - The repository owner, repo name, and access token.
 * @returns A GitHubResult wrapping the repository settings compatible with the PATCH endpoint.
 */
export async function getGitHubRepoSettings(
  parameters: GetGitHubRepoSettingsParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<RepoSettings>> {
  const { accessToken, ...params } = parameters;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'Error fetching repository settings. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.rest.repos.get({
      owner: params.owner,
      repo: params.repo,
    });

    return ok({
      name: data.name,
      description: data.description ?? undefined,
      homepage: data.homepage ?? undefined,
      private: data.private,
      has_issues: data.has_issues,
      has_projects: data.has_projects,
      has_wiki: data.has_wiki ?? false,
      is_template: data.is_template ?? false,
      default_branch: data.default_branch,
      allow_squash_merge: data.allow_squash_merge ?? true,
      allow_merge_commit: data.allow_merge_commit ?? true,
      allow_rebase_merge: data.allow_rebase_merge ?? true,
      allow_auto_merge: data.allow_auto_merge ?? false,
      delete_branch_on_merge: data.delete_branch_on_merge ?? false,
      allow_update_branch: data.allow_update_branch ?? false,
      use_squash_pr_title_as_default:
        data.use_squash_pr_title_as_default ?? false,
      squash_merge_commit_title:
        (data.squash_merge_commit_title as RepoSettings['squash_merge_commit_title']) ??
        'COMMIT_OR_PR_TITLE',
      squash_merge_commit_message:
        (data.squash_merge_commit_message as RepoSettings['squash_merge_commit_message']) ??
        'COMMIT_MESSAGES',
      merge_commit_title:
        (data.merge_commit_title as RepoSettings['merge_commit_title']) ??
        'MERGE_MESSAGE',
      merge_commit_message:
        (data.merge_commit_message as RepoSettings['merge_commit_message']) ??
        'PR_TITLE',
      archived: data.archived,
      allow_forking: data.allow_forking ?? false,
      web_commit_signoff_required: data.web_commit_signoff_required ?? false,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching repository settings: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching repository settings: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
