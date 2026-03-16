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
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'branch-dal' });

export type GetDefaultBranchesForReposParameters = {
  owner: string;
  repos: string[];
};

/**
 * Fetches the default branch name for each of the specified repositories in a GitHub organization.
 * Skips repositories that do not exist and logs a warning for any failures.
 * @param parameters - The owner, list of repository names, and access token.
 * @returns A GitHubResult wrapping a map of repository name to default branch name.
 */
export async function getGitHubDefaultBranchesForRepos(
  parameters: GetDefaultBranchesForReposParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<{ [repo: string]: string }>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required to fetch default branches. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: { [repo: string]: string } = {};
    const errors: string[] = [];

    for (const repo of params.repos) {
      try {
        const repoExists = await githubExistsRequest(
          'repo',
          { owner: params.owner, repo },
          accessToken,
        );

        if (!repoExists) {
          errors.push(`Repository ${params.owner}/${repo} does not exist`);
          continue;
        }

        const response = await octokit.request('GET /repos/{owner}/{repo}', {
          owner: params.owner,
          repo,
        });

        results[repo] = response.data.default_branch;
      } catch (error) {
        if (error instanceof OctokitError) {
          errors.push(
            `Error fetching default branch for ${repo}: ${error.message} (status: ${error.status})`,
          );
        } else if (error instanceof Error) {
          errors.push(
            `Error fetching default branch for ${repo}: ${error.message}`,
          );
        } else {
          errors.push(
            `Unknown error fetching default branch for ${repo}: ${JSON.stringify(error)}`,
          );
        }
      }
    }

    if (Object.keys(results).length === 0 && errors.length > 0) {
      return fail(
        GitHubErrorCode.INTERNAL_ERROR,
        `Failed to fetch default branches for all repositories: ${errors.join(', ')}`,
      );
    }

    if (errors.length > 0) {
      logger.warn(
        { errors },
        'Some repositories failed when fetching default branches',
      );
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      return fail(
        code,
        `Error fetching default branches: ${error.message} (status: ${error.status})`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching default branches: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
