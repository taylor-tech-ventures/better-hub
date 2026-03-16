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

export type AddUsersToReposParameters = {
  owner: string;
  repos: string[];
  users: {
    username: string;
    permission: string;
  }[];
};

/**
 * Adds a user as a collaborator to a single GitHub repository with the specified permission.
 * @param params - The repo, user (username and permission), organization owner, and access token.
 * @returns A GitHubResult wrapping the repo and username on success.
 */
export async function addUserToRepo({
  repo,
  user,
  owner,
  accessToken,
}: {
  repo: string;
  user: { username: string; permission: string };
  owner: string;
  accessToken: string;
}): Promise<GitHubResult<{ repo: string; username: string }>> {
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request(
      'PUT /repos/{owner}/{repo}/collaborators/{username}',
      {
        owner,
        repo,
        username: user.username,
        permission: user.permission,
      },
    );
    return ok({ repo, username: user.username });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error adding user ${user.username} to repo ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error adding user ${user.username} to repo ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Adds one or more users as collaborators to one or more GitHub repositories.
 * Validates that each repository and user exist before adding. Invalid entries are reported as errors
 * while valid combinations are processed.
 * @param parameters - The owner, list of repos, list of users with permissions, and access token.
 * @returns A GitHubResult wrapping arrays of successfully added user/repo pairs and error messages.
 */
export async function addGitHubUsersToRepos(
  parameters: AddUsersToReposParameters & { accessToken: string | undefined },
): Promise<
  GitHubResult<{
    addedUsers: { repo: string; username: string }[];
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

  const addUsersResponse: {
    addedUsers: { repo: string; username: string }[];
    errors: string[];
  } = {
    addedUsers: [],
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
      addUsersResponse.errors.push(
        `Error: repository ${params.owner}/${repo} does not exist`,
      );
    } else {
      validRepos.push(repo);
    }
  }

  const validUsers: { username: string; permission: string }[] = [];
  for (const user of params.users) {
    const userExists = await githubExistsRequest(
      'user',
      { username: user.username },
      accessToken,
    );

    if (!userExists) {
      addUsersResponse.errors.push(
        `Error: user ${user.username} does not exist`,
      );
    } else {
      validUsers.push(user);
    }
  }

  const additionPromises = validRepos.flatMap((repo) =>
    validUsers.map((user) =>
      addUserToRepo({
        repo,
        user,
        owner: params.owner,
        accessToken,
      }),
    ),
  );

  const results = await Promise.allSettled(additionPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const inner = result.value;
      if (inner.success) {
        addUsersResponse.addedUsers.push(inner.data);
      } else {
        addUsersResponse.errors.push(inner.error.message);
      }
    } else {
      addUsersResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(addUsersResponse);
}
