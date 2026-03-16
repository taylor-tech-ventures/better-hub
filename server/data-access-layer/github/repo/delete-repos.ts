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

export type DeleteRepoResponse =
  GitHubApiEndpoints['DELETE /repos/{owner}/{repo}']['response']['data'];
export type DeleteRepoParameter =
  GitHubApiEndpoints['DELETE /repos/{owner}/{repo}']['parameters'];

export type DeleteReposParameters = {
  owner: string;
  repos: string[];
};

/**
 * Deletes a single GitHub repository.
 * @param params - An object containing the owner/name of the repo to delete and the access token.
 * @returns A GitHubResult wrapping the deleted repository's owner and name.
 */
export async function deleteSingleRepo({
  repoToDelete,
  accessToken,
}: {
  repoToDelete: { owner: string; name: string };
  accessToken: string;
}): Promise<GitHubResult<{ owner: string; name: string }>> {
  const { owner, name } = repoToDelete;
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request('DELETE /repos/{owner}/{repo}', {
      owner,
      repo: name,
    });
    return ok({ owner, name });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error deleting the repo ${owner}/${name}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error deleting the repo ${owner}/${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

type DeleteReposResult = {
  deletedRepos: { owner: string; name: string }[];
  errors: string[];
};

/**
 * Deletes one or more repositories in a GitHub organization.
 * Processes all deletions in parallel and collects both successes and errors.
 * @param parameters - The owner, list of repository names to delete, and access token.
 * @returns A GitHubResult wrapping an object with arrays of successfully deleted repos and error messages.
 */
export async function deleteGitHubRepos(
  parameters: DeleteReposParameters & { accessToken: string | undefined },
): Promise<GitHubResult<DeleteReposResult>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'Error deleting GitHub repositories. Please re-authenticate.',
    );
  }

  const deleteReposResponse: DeleteReposResult = {
    deletedRepos: [],
    errors: [],
  };

  const deletionPromises = params.repos.map((repo) =>
    deleteSingleRepo({
      repoToDelete: { owner: params.owner, name: repo },
      accessToken,
    }),
  );

  const results = await Promise.allSettled(deletionPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const dalResult = result.value;
      if (dalResult.success) {
        deleteReposResponse.deletedRepos.push(dalResult.data);
      } else {
        deleteReposResponse.errors.push(dalResult.error.message);
      }
    } else {
      deleteReposResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(deleteReposResponse);
}
