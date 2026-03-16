import { RequestError } from '@octokit/request-error';
import { addGitHubTeamsToRepos } from '@/server/data-access-layer/github/team/add-teams-to-repos';
import { getGitHubRepoTeams } from '@/server/data-access-layer/github/team/get-repo-teams';
import { addUserToRepo } from '@/server/data-access-layer/github/user/add-users-to-repos';
import { getGitHubRepoUsers } from '@/server/data-access-layer/github/user/get-repo-users';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';
import { copyGitHubDirectory } from './copy-github-directory';

export type CopyGitHubRepoAccessParameters = {
  owner: string;
  sourceRepo: string;
  targetRepos: string[];
  shouldCopyTeamAccess: boolean;
  shouldCopyUserAccess: boolean;
  shouldCopyGitHubDirectory?: boolean;
};

/**
 * Copies team access from a source repository to a single target repository.
 * @param params - The source repo, target repo, organization owner, and access token.
 * @returns An array of copy results per team.
 */
async function copyTeamAccess({
  sourceRepo,
  targetRepo,
  owner,
  accessToken,
}: {
  sourceRepo: string;
  targetRepo: string;
  owner: string;
  accessToken: string;
}): Promise<
  {
    repo: string;
    entity: string;
    entityType: 'team';
    permission: string;
    success: boolean;
    error?: string;
  }[]
> {
  try {
    const sourceTeamsResult = await getGitHubRepoTeams({
      owner,
      repo: sourceRepo,
      accessToken,
    });

    if (!sourceTeamsResult.success) {
      throw new Error(
        `Error fetching teams for source repository ${sourceRepo}: ${sourceTeamsResult.error.message}`,
      );
    }

    const sourceTeams = sourceTeamsResult.data;

    const addTeamsResult = await addGitHubTeamsToRepos({
      owner,
      repos: [targetRepo],
      teams: sourceTeams,
      accessToken,
    });

    if (!addTeamsResult.success) {
      throw new Error(
        `Error adding teams to target repository ${targetRepo}: ${addTeamsResult.error.message}`,
      );
    }

    const addTeamsResponse = addTeamsResult.data;

    return sourceTeams.map((team) => ({
      repo: targetRepo,
      entity: team.name,
      entityType: 'team',
      permission: team.permission,
      success: !addTeamsResponse.errors.some((error) =>
        error.includes(team.name),
      ),
      error:
        addTeamsResponse.errors.find((error) => error.includes(team.name)) ||
        undefined,
    }));
  } catch (error) {
    return [
      {
        repo: targetRepo,
        entity: 'Unknown',
        entityType: 'team',
        permission: 'Unknown',
        success: false,
        error:
          error instanceof RequestError
            ? `Request failed with status ${error.status}: ${error.message}`
            : String(error),
      },
    ];
  }
}

/**
 * Copies user collaborator access from a source repository to a single target repository.
 * @param params - The source repo, target repo, organization owner, and access token.
 * @returns An array of copy results per user.
 */
async function copyUserAccess({
  sourceRepo,
  targetRepo,
  owner,
  accessToken,
}: {
  sourceRepo: string;
  targetRepo: string;
  owner: string;
  accessToken: string;
}): Promise<
  {
    repo: string;
    entity: string;
    entityType: 'user';
    permission: string;
    success: boolean;
    error?: string;
  }[]
> {
  try {
    const sourceUsersResult = await getGitHubRepoUsers({
      owner,
      repo: sourceRepo,
      accessToken,
    });

    if (!sourceUsersResult.success) {
      throw new Error(
        `Error fetching users for source repository ${sourceRepo}: ${sourceUsersResult.error.message}`,
      );
    }

    const sourceUsers = sourceUsersResult.data;

    const additionPromises = sourceUsers.map((user) =>
      addUserToRepo({
        repo: targetRepo,
        user: {
          username: user.login,
          permission:
            (user.permissions &&
              Object.keys(user.permissions).find(
                (key) =>
                  user.permissions?.[key as keyof typeof user.permissions],
              )) ??
            'pull',
        },
        owner,
        accessToken,
      }),
    );

    const results = await Promise.all(additionPromises);

    return sourceUsers.map((user, index) => ({
      repo: targetRepo,
      entity: user.login,
      entityType: 'user',
      permission:
        (user.permissions &&
          Object.keys(user.permissions).find(
            (key) => user.permissions?.[key as keyof typeof user.permissions],
          )) ??
        'pull',
      success: results[index].success,
      error: results[index].success ? undefined : results[index].error.message,
    }));
  } catch (error) {
    return [
      {
        repo: targetRepo,
        entity: 'Unknown',
        permission: 'Unknown',
        entityType: 'user',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

/**
 * Copies user and/or team access from a source repository to one or more target repositories
 * in the same GitHub organization. Optionally copies the `.github` directory as well.
 * Validates the source and each target repository before copying.
 * @param parameters - The owner, source repo, target repos, flags for team/user/directory copy, and access token.
 * @returns An array of copy results per entity per target repository.
 */
export async function copyGitHubRepoAccess(
  parameters: CopyGitHubRepoAccessParameters & {
    accessToken: string | undefined;
  },
): Promise<
  {
    repo: string;
    entity: string;
    permission: string;
    success: boolean;
    error?: string;
  }[]
> {
  const {
    accessToken,
    shouldCopyTeamAccess,
    shouldCopyUserAccess,
    shouldCopyGitHubDirectory,
    ...params
  } = parameters;
  if (!accessToken) {
    return [
      {
        repo: 'Unknown',
        entity: 'Unknown',
        permission: 'Unknown',
        success: false,
        error: 'Error copying GitHub access. Are you logged in?',
      },
    ];
  }

  if (!shouldCopyTeamAccess && !shouldCopyUserAccess) {
    return [
      {
        repo: 'Unknown',
        entity: 'Unknown',
        permission: 'Unknown',
        success: false,
        error:
          'No access to copy. Please enable at least one type of access to copy (users or teams).',
      },
    ];
  }

  const copyAccessResponse: {
    repo: string;
    entity: string;
    permission: string;
    success: boolean;
    error?: string;
  }[] = [];

  const sourceExists = await githubExistsRequest(
    'repo',
    { owner: params.owner, repo: params.sourceRepo },
    accessToken,
  );

  if (!sourceExists) {
    return [
      {
        repo: params.sourceRepo,
        entity: 'Source Repository',
        permission: 'Unknown',
        success: false,
        error: `Error: source repository ${params.owner}/${params.sourceRepo} does not exist`,
      },
    ];
  }

  const validTargetRepos: string[] = [];
  for (const targetRepo of params.targetRepos) {
    const targetExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo: targetRepo },
      accessToken,
    );

    if (!targetExists) {
      copyAccessResponse.push({
        repo: targetRepo,
        entity: 'Target Repository',
        permission: 'Unknown',
        success: false,
        error: `Error: target repository ${params.owner}/${targetRepo} does not exist`,
      });
    } else {
      validTargetRepos.push(targetRepo);
    }
  }

  if (validTargetRepos.length === 0) {
    return copyAccessResponse;
  }

  if (shouldCopyTeamAccess) {
    const copyPromises = validTargetRepos.map((targetRepo) =>
      copyTeamAccess({
        sourceRepo: params.sourceRepo,
        targetRepo,
        owner: params.owner,
        accessToken,
      }),
    );

    const results = await Promise.all(copyPromises);
    for (const result of results) {
      copyAccessResponse.push(...result);
    }
  }

  if (shouldCopyUserAccess) {
    const copyPromises = validTargetRepos.map((targetRepo) =>
      copyUserAccess({
        sourceRepo: params.sourceRepo,
        targetRepo,
        owner: params.owner,
        accessToken,
      }),
    );

    const results = await Promise.all(copyPromises);
    for (const result of results) {
      copyAccessResponse.push(...result);
    }
  }

  if (shouldCopyGitHubDirectory) {
    const githubDirectoryResults = await copyGitHubDirectory({
      owner: params.owner,
      sourceRepo: params.sourceRepo,
      targetRepos: validTargetRepos,
      accessToken,
    });

    githubDirectoryResults.forEach((result) => {
      copyAccessResponse.push({
        repo: result.repo,
        entity: result.filePath,
        permission: '.github file',
        success: result.success,
        error: result.error,
      });
    });
  }

  return copyAccessResponse;
}
