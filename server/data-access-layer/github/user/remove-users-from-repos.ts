import { RequestError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type RemoveUsersFromReposParameters = {
  owner: string;
  repos: string[];
  users: {
    username: string;
  }[];
};

/**
 * Removes a user as a collaborator from a single GitHub repository.
 * @param params - The repo, user (username), organization owner, and access token.
 * @returns A GitHubResult wrapping the repo and username on success.
 */
export async function removeUserFromRepo({
  repo,
  user,
  owner,
  accessToken,
}: {
  repo: string;
  user: { username: string };
  owner: string;
  accessToken: string;
}): Promise<GitHubResult<{ repo: string; username: string }>> {
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request(
      'DELETE /repos/{owner}/{repo}/collaborators/{username}',
      {
        owner,
        repo,
        username: user.username,
      },
    );
    return ok({ repo, username: user.username });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error removing user ${user.username} from repo ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error removing user ${user.username} from repo ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Removes one or more users as collaborators from one or more GitHub repositories.
 * Validates that each repository and user exist before removing. Invalid entries are reported as errors
 * while valid combinations are processed.
 * @param parameters - The owner, list of repos, list of users, and access token.
 * @returns A GitHubResult wrapping arrays of successfully removed user/repo pairs and error messages.
 */
export async function removeGitHubUsersFromRepos(
  parameters: RemoveUsersFromReposParameters & {
    accessToken: string | undefined;
  },
): Promise<
  GitHubResult<{
    removedUsers: { repo: string; username: string }[];
    errors: string[];
  }>
> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  const removeUsersResponse: {
    removedUsers: { repo: string; username: string }[];
    errors: string[];
  } = {
    removedUsers: [],
    errors: [],
  };

  const validRepos: string[] = [];
  for (const repo of params.repos) {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo },
      accessToken,
    );

    if (!repoExists) {
      removeUsersResponse.errors.push(
        `Error: repository ${params.owner}/${repo} does not exist`,
      );
    } else {
      validRepos.push(repo);
    }
  }

  const validUsers: { username: string }[] = [];
  for (const user of params.users) {
    const userExists = await githubExistsRequest(
      'user',
      { username: user.username },
      accessToken,
    );

    if (!userExists) {
      removeUsersResponse.errors.push(
        `Error: user ${user.username} does not exist`,
      );
    } else {
      validUsers.push(user);
    }
  }

  const removalPromises = validRepos.flatMap((repo) =>
    validUsers.map((user) =>
      removeUserFromRepo({
        repo,
        user,
        owner: params.owner,
        accessToken,
      }),
    ),
  );

  const results = await Promise.allSettled(removalPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const inner = result.value;
      if (inner.success) {
        removeUsersResponse.removedUsers.push(inner.data);
      } else {
        removeUsersResponse.errors.push(inner.error.message);
      }
    } else {
      removeUsersResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(removeUsersResponse);
}
