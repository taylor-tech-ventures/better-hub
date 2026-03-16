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

export type AddTeamsToReposParameters = {
  owner: string;
  repos: string[];
  teams: {
    name: string;
    permission: string;
  }[];
};

/**
 * Grants a team access to a single repository with the specified permission level.
 * @param params - The repo, team (name and permission), organization owner, and access token.
 * @returns The repo and team name on success.
 */
async function addTeamToRepo({
  repo,
  team,
  owner,
  accessToken,
}: {
  repo: string;
  team: { name: string; permission: string };
  owner: string;
  accessToken: string;
}): Promise<GitHubResult<{ repo: string; team: string }>> {
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request(
      'PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}',
      {
        org: owner,
        team_slug: team.name,
        owner,
        repo,
        permission: team.permission,
      },
    );
    return ok({ repo, team: team.name });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error adding team ${team.name} to repo ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error adding team ${team.name} to repo ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Grants one or more teams access to one or more GitHub repositories with the specified permission levels.
 * Validates that each repository and team exist before adding. Invalid entries are reported as errors
 * while valid combinations are processed.
 * @param parameters - The owner, list of repos, list of teams with permissions, and access token.
 * @returns A GitHubResult wrapping arrays of successfully added team/repo pairs and error messages.
 */
export async function addGitHubTeamsToRepos(
  parameters: AddTeamsToReposParameters & { accessToken: string | undefined },
): Promise<
  GitHubResult<{
    addedTeams: { repo: string; team: string }[];
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

  const addTeamsResponse: {
    addedTeams: { repo: string; team: string }[];
    errors: string[];
  } = {
    addedTeams: [],
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
      addTeamsResponse.errors.push(
        `Error: repository ${params.owner}/${repo} does not exist`,
      );
    } else {
      validRepos.push(repo);
    }
  }

  const validTeams: { name: string; permission: string }[] = [];
  for (const team of params.teams) {
    const teamExists = await githubExistsRequest(
      'team',
      { org: params.owner, team_slug: team.name },
      accessToken,
    );

    if (!teamExists) {
      addTeamsResponse.errors.push(
        `Error: team ${team.name} does not exist in organization ${params.owner}`,
      );
    } else {
      validTeams.push(team);
    }
  }

  const additionPromises = validRepos.flatMap((repo) =>
    validTeams.map((team) =>
      addTeamToRepo({
        repo,
        team,
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
        addTeamsResponse.addedTeams.push(inner.data);
      } else {
        addTeamsResponse.errors.push(inner.error.message);
      }
    } else {
      addTeamsResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(addTeamsResponse);
}
