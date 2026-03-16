import { RequestError as OctokitError } from '@octokit/request-error';
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
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'branch-dal' });

export type GetBranchesForReposParameters = {
  owner: string;
  repos: string[];
};

type BranchData =
  GitHubApiEndpoints['GET /repos/{owner}/{repo}/branches']['response']['data'][0];

/**
 * Fetches all branches for each of the specified repositories in a GitHub organization.
 * Skips repositories that do not exist and logs a warning for any failures.
 * @param parameters - The owner, list of repository names, and access token.
 * @returns A GitHubResult wrapping a map of repository name to branch list.
 */
export async function getGitHubBranchesForRepos(
  parameters: GetBranchesForReposParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<{ [repo: string]: BranchData[] }>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required to fetch branches. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: { [repo: string]: BranchData[] } = {};
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

        const branches = await octokit.paginate(
          'GET /repos/{owner}/{repo}/branches',
          {
            owner: params.owner,
            repo,
          },
        );

        results[repo] = branches;
      } catch (error) {
        if (error instanceof OctokitError) {
          errors.push(
            `Error fetching branches for ${repo}: ${error.message} (status: ${error.status})`,
          );
        } else if (error instanceof Error) {
          errors.push(`Error fetching branches for ${repo}: ${error.message}`);
        } else {
          errors.push(
            `Unknown error fetching branches for ${repo}: ${JSON.stringify(error)}`,
          );
        }
      }
    }

    if (Object.keys(results).length === 0 && errors.length > 0) {
      return fail(
        GitHubErrorCode.INTERNAL_ERROR,
        `Failed to fetch branches for all repositories: ${errors.join(', ')}`,
      );
    }

    if (errors.length > 0) {
      logger.warn(
        { errors },
        'Some repositories failed when fetching branches',
      );
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      return fail(
        code,
        `Error fetching branches: ${error.message} (status: ${error.status})`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching branches: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
