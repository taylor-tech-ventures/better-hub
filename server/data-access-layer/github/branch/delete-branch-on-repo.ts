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
import { getGitHubDefaultBranchesForRepos } from './get-default-branches-for-repos';

export type DeleteBranchOnRepoParameters = {
  owner: string;
  repo: string;
  branch: string;
};

type BranchDeletionResult = {
  repo: string;
  branch: string;
  success: boolean;
  error?: string;
};

/**
 * Deletes a branch from a GitHub repository.
 * Validates that the repository exists, the branch exists, and that the branch
 * is not the repository's default branch before deleting.
 * @param parameters - The owner, repo, branch name, and access token.
 * @returns A GitHubResult wrapping a deletion result object.
 */
export async function deleteGitHubBranchOnRepo(
  parameters: DeleteBranchOnRepoParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<BranchDeletionResult>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required to delete a branch. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo: params.repo },
      accessToken,
    );

    if (!repoExists) {
      return ok({
        repo: params.repo,
        branch: params.branch,
        success: false,
        error: `Repository ${params.owner}/${params.repo} does not exist`,
      });
    }

    const branchExists = await githubExistsRequest(
      'branch',
      { owner: params.owner, repo: params.repo, branch: params.branch },
      accessToken,
    );

    if (!branchExists) {
      return ok({
        repo: params.repo,
        branch: params.branch,
        success: false,
        error: `Branch '${params.branch}' does not exist in repository ${params.owner}/${params.repo}`,
      });
    }

    const defaultBranchResult = await getGitHubDefaultBranchesForRepos({
      owner: params.owner,
      repos: [params.repo],
      accessToken,
    });

    if (!defaultBranchResult.success) {
      return ok({
        repo: params.repo,
        branch: params.branch,
        success: false,
        error: `Error getting default branch: ${defaultBranchResult.error.message}`,
      });
    }

    const defaultBranch = defaultBranchResult.data[params.repo];
    if (!defaultBranch) {
      return ok({
        repo: params.repo,
        branch: params.branch,
        success: false,
        error: `Could not determine default branch for repository ${params.owner}/${params.repo}`,
      });
    }

    if (defaultBranch === params.branch) {
      return ok({
        repo: params.repo,
        branch: params.branch,
        success: false,
        error: `Cannot delete '${params.branch}' as it is the default branch of repository ${params.owner}/${params.repo}`,
      });
    }

    await octokit.rest.git.deleteRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${params.branch}`,
    });

    return ok({
      repo: params.repo,
      branch: params.branch,
      success: true,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      return fail(
        code,
        `Error deleting branch: ${error.message} (status: ${error.status})`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error deleting branch: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
