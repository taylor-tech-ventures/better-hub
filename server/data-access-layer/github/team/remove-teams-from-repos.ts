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

export type RemoveTeamsFromReposParameters = {
  owner: string;
  repos: string[];
  teams: {
    name: string;
  }[];
};

/**
 * Removes a team's access from a single GitHub repository.
 * @param params - The repo, team name, organization owner, and access token.
 * @returns A GitHubResult wrapping the repo and team name on success.
 */
async function removeTeamFromRepo({
  repo,
  team,
  owner,
  accessToken,
}: {
  repo: string;
  team: { name: string };
  owner: string;
  accessToken: string;
}): Promise<GitHubResult<{ repo: string; team: string }>> {
  const octokit = getOctokit(accessToken);

  try {
    await octokit.request(
      'DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}',
      {
        org: owner,
        team_slug: team.name,
        owner,
        repo,
      },
    );
    return ok({ repo, team: team.name });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error removing team ${team.name} from repo ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error removing team ${team.name} from repo ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Removes one or more teams' access from one or more GitHub repositories.
 * Validates that each repository and team exist before removing. Invalid entries are reported as errors
 * while valid combinations are processed.
 * @param parameters - The owner, list of repos, list of teams, and access token.
 * @returns A GitHubResult wrapping arrays of successfully removed team/repo pairs and error messages.
 */
export async function removeGitHubTeamsFromRepos(
  parameters: RemoveTeamsFromReposParameters & {
    accessToken: string | undefined;
  },
): Promise<
  GitHubResult<{
    removedTeams: { repo: string; team: string }[];
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

  const removeTeamsResponse: {
    removedTeams: { repo: string; team: string }[];
    errors: string[];
  } = {
    removedTeams: [],
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
      removeTeamsResponse.errors.push(
        `Error: repository ${params.owner}/${repo} does not exist`,
      );
    } else {
      validRepos.push(repo);
    }
  }

  const validTeams: { name: string }[] = [];
  for (const team of params.teams) {
    const teamExists = await githubExistsRequest(
      'team',
      { org: params.owner, team_slug: team.name },
      accessToken,
    );

    if (!teamExists) {
      removeTeamsResponse.errors.push(
        `Error: team ${team.name} does not exist in organization ${params.owner}`,
      );
    } else {
      validTeams.push(team);
    }
  }

  const removalPromises = validRepos.flatMap((repo) =>
    validTeams.map((team) =>
      removeTeamFromRepo({
        repo,
        team,
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
        removeTeamsResponse.removedTeams.push(inner.data);
      } else {
        removeTeamsResponse.errors.push(inner.error.message);
      }
    } else {
      removeTeamsResponse.errors.push(
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      );
    }
  }

  return ok(removeTeamsResponse);
}
