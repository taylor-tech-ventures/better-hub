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

export type GetBranchShaForReposParameters = {
  owner: string;
  reposBranches: {
    repo: string;
    branch: string;
  }[];
};

/**
 * Retrieves the HEAD commit SHA for specified branches across one or more repositories.
 * Validates that each repository and branch exists before fetching the SHA.
 * @param parameters - The owner, list of repo/branch pairs, and access token.
 * @returns A GitHubResult wrapping a map of `"repo/branch"` keys to their SHA and URL.
 */
export async function getGitHubBranchShaForRepos(
  parameters: GetBranchShaForReposParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<{ [repoKey: string]: { sha: string; url: string } }>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required to fetch branch SHAs. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: { [repoKey: string]: { sha: string; url: string } } = {};
    const errors: string[] = [];

    for (const { repo, branch } of params.reposBranches) {
      const repoKey = `${repo}/${branch}`;

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

        const branchExists = await githubExistsRequest(
          'branch',
          { owner: params.owner, repo, branch },
          accessToken,
        );

        if (!branchExists) {
          errors.push(
            `Branch ${branch} does not exist in repository ${params.owner}/${repo}`,
          );
          continue;
        }

        const response = await octokit.request(
          'GET /repos/{owner}/{repo}/git/ref/{ref}',
          {
            owner: params.owner,
            repo,
            ref: `heads/${branch}`,
          },
        );

        results[repoKey] = {
          sha: response.data.object.sha,
          url: response.data.url,
        };
      } catch (error) {
        if (error instanceof OctokitError) {
          errors.push(
            `Error fetching SHA for ${repoKey}: ${error.message} (status: ${error.status})`,
          );
        } else if (error instanceof Error) {
          errors.push(`Error fetching SHA for ${repoKey}: ${error.message}`);
        } else {
          errors.push(
            `Unknown error fetching SHA for ${repoKey}: ${JSON.stringify(error)}`,
          );
        }
      }
    }

    if (Object.keys(results).length === 0 && errors.length > 0) {
      return fail(
        GitHubErrorCode.INTERNAL_ERROR,
        `Failed to fetch branch SHAs for all repositories: ${errors.join(', ')}`,
      );
    }

    if (errors.length > 0) {
      logger.warn({ errors }, 'Some branch SHAs failed to fetch');
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      return fail(
        code,
        `Error fetching branch SHAs: ${error.message} (status: ${error.status})`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching branch SHAs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
