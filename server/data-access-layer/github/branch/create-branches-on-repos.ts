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
import { getGitHubBranchShaForRepos } from './get-branch-sha-for-repos';
import { getGitHubDefaultBranchesForRepos } from './get-default-branches-for-repos';

export type CreateBranchesOnReposParameters = {
  owner: string;
  operations: {
    repo: string;
    newBranch: string;
    sourceBranch?: string;
  }[];
};

type BranchCreationResult = {
  repo: string;
  newBranch: string;
  sourceBranch: string;
  success: boolean;
  error?: string;
  sha?: string;
};

/**
 * Creates new branches across one or more repositories in a GitHub organization.
 * For each operation, uses the specified source branch (or the repo's default branch)
 * as the base commit SHA. Validates that the target repository exists and the new
 * branch name is not already taken.
 * @param parameters - The owner, list of branch creation operations, and access token.
 * @returns A GitHubResult wrapping an array of results per branch-creation operation.
 */
export async function createGitHubBranchesOnRepos(
  parameters: CreateBranchesOnReposParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<BranchCreationResult[]>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required to create branches. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: BranchCreationResult[] = [];

    const repoOperations = new Map<string, typeof params.operations>();
    for (const operation of params.operations) {
      if (!repoOperations.has(operation.repo)) {
        repoOperations.set(operation.repo, []);
      }
      repoOperations.get(operation.repo)?.push(operation);
    }

    const reposNeedingDefaults = Array.from(repoOperations.keys()).filter(
      (repo) => repoOperations.get(repo)?.some((op) => !op.sourceBranch),
    );

    let defaultBranches: { [repo: string]: string } = {};
    if (reposNeedingDefaults.length > 0) {
      const defaultBranchesResult = await getGitHubDefaultBranchesForRepos({
        owner: params.owner,
        repos: reposNeedingDefaults,
        accessToken,
      });

      if (!defaultBranchesResult.success) {
        return fail(
          defaultBranchesResult.error.code,
          `Error fetching default branches: ${defaultBranchesResult.error.message}`,
        );
      }

      defaultBranches = defaultBranchesResult.data;
    }

    const reposBranches: { repo: string; branch: string }[] = [];
    const operationToReposBranches = new Map<
      (typeof params.operations)[0],
      { repo: string; branch: string }
    >();

    for (const operation of params.operations) {
      const sourceBranch =
        operation.sourceBranch || defaultBranches[operation.repo];
      if (!sourceBranch) {
        results.push({
          repo: operation.repo,
          newBranch: operation.newBranch,
          sourceBranch: operation.sourceBranch || 'default',
          success: false,
          error: `Could not determine source branch for ${operation.repo}`,
        });
        continue;
      }

      const repoBranch = { repo: operation.repo, branch: sourceBranch };
      reposBranches.push(repoBranch);
      operationToReposBranches.set(operation, repoBranch);
    }

    let branchShas: { [repoKey: string]: { sha: string; url: string } } = {};
    if (reposBranches.length > 0) {
      const branchShasResult = await getGitHubBranchShaForRepos({
        owner: params.owner,
        reposBranches,
        accessToken,
      });

      if (!branchShasResult.success) {
        return fail(
          branchShasResult.error.code,
          `Error fetching branch SHAs: ${branchShasResult.error.message}`,
        );
      }

      branchShas = branchShasResult.data;
    }

    for (const operation of params.operations) {
      try {
        const repoExists = await githubExistsRequest(
          'repo',
          { owner: params.owner, repo: operation.repo },
          accessToken,
        );

        if (!repoExists) {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch: operation.sourceBranch || 'default',
            success: false,
            error: `Repository ${params.owner}/${operation.repo} does not exist`,
          });
          continue;
        }

        const newBranchExists = await githubExistsRequest(
          'branch',
          {
            owner: params.owner,
            repo: operation.repo,
            branch: operation.newBranch,
          },
          accessToken,
        );

        if (newBranchExists) {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch:
              operation.sourceBranch ||
              defaultBranches[operation.repo] ||
              'default',
            success: false,
            error: `Branch '${operation.newBranch}' already exists in repository ${params.owner}/${operation.repo}`,
          });
          continue;
        }

        const repoBranch = operationToReposBranches.get(operation);
        if (!repoBranch) {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch: operation.sourceBranch || 'default',
            success: false,
            error: 'Could not determine source branch mapping',
          });
          continue;
        }

        const repoKey = `${repoBranch.repo}/${repoBranch.branch}`;
        const sourceSha = branchShas[repoKey];

        if (!sourceSha) {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch: repoBranch.branch,
            success: false,
            error: `Could not get SHA for source branch '${repoBranch.branch}'`,
          });
          continue;
        }

        const response = await octokit.rest.git.createRef({
          owner: params.owner,
          repo: operation.repo,
          ref: `refs/heads/${operation.newBranch}`,
          sha: sourceSha.sha,
        });

        results.push({
          repo: operation.repo,
          newBranch: operation.newBranch,
          sourceBranch: repoBranch.branch,
          success: true,
          sha: response.data.object.sha,
        });
      } catch (error) {
        if (error instanceof OctokitError) {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch:
              operation.sourceBranch ||
              defaultBranches[operation.repo] ||
              'unknown',
            success: false,
            error: `Error creating branch: ${error.message} (status: ${error.status})`,
          });
        } else if (error instanceof Error) {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch:
              operation.sourceBranch ||
              defaultBranches[operation.repo] ||
              'unknown',
            success: false,
            error: `Error creating branch: ${error.message}`,
          });
        } else {
          results.push({
            repo: operation.repo,
            newBranch: operation.newBranch,
            sourceBranch:
              operation.sourceBranch ||
              defaultBranches[operation.repo] ||
              'unknown',
            success: false,
            error: `Unknown error creating branch: ${JSON.stringify(error)}`,
          });
        }
      }
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      return fail(
        code,
        `Error creating branches: ${error.message} (status: ${error.status})`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating branches: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
