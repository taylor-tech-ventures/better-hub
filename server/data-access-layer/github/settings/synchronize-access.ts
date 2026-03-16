import { RequestError } from '@octokit/request-error';
import { addGitHubTeamsToRepos } from '@/server/data-access-layer/github/team/add-teams-to-repos';
import { getGitHubRepoTeams } from '@/server/data-access-layer/github/team/get-repo-teams';
import { removeGitHubTeamsFromRepos } from '@/server/data-access-layer/github/team/remove-teams-from-repos';
import { addUserToRepo } from '@/server/data-access-layer/github/user/add-users-to-repos';
import { getGitHubRepoUsers } from '@/server/data-access-layer/github/user/get-repo-users';
import { removeGitHubUsersFromRepos } from '@/server/data-access-layer/github/user/remove-users-from-repos';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';
import { copyGitHubDirectory } from './copy-github-directory';

export type SynchronizeGitHubRepoAccessParameters = {
  owner: string;
  sourceRepo: string;
  targetRepos: string[];
  shouldSyncTeamAccess: boolean;
  shouldSyncUserAccess: boolean;
  shouldCopyGitHubDirectory?: boolean;
};

interface SyncResult {
  repo: string;
  entity: string;
  entityType: 'team' | 'user';
  action: 'added' | 'removed' | 'updated' | 'unchanged';
  permission: string;
  success: boolean;
  error?: string;
}

/**
 * Synchronizes team access from a source repository to a single target repository.
 * Adds teams present in the source but missing from the target, removes teams not in the source,
 * and updates teams with differing permission levels.
 * @param params - The source repo, target repo, organization owner, and access token.
 * @returns An array of sync results per team.
 */
async function synchronizeTeamAccess({
  sourceRepo,
  targetRepo,
  owner,
  accessToken,
}: {
  sourceRepo: string;
  targetRepo: string;
  owner: string;
  accessToken: string;
}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

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

    const targetTeamsResult = await getGitHubRepoTeams({
      owner,
      repo: targetRepo,
      accessToken,
    });

    if (!targetTeamsResult.success) {
      throw new Error(
        `Error fetching teams for target repository ${targetRepo}: ${targetTeamsResult.error.message}`,
      );
    }

    const targetTeams = targetTeamsResult.data;

    const sourceTeamMap = new Map(
      sourceTeams.map((team) => [team.name, team.permission]),
    );
    const targetTeamMap = new Map(
      targetTeams.map((team) => [team.name, team.permission]),
    );

    const teamsToAddOrUpdate = sourceTeams.filter(
      (sourceTeam) =>
        !targetTeamMap.has(sourceTeam.name) ||
        targetTeamMap.get(sourceTeam.name) !== sourceTeam.permission,
    );

    if (teamsToAddOrUpdate.length > 0) {
      const addTeamsResult = await addGitHubTeamsToRepos({
        owner,
        repos: [targetRepo],
        teams: teamsToAddOrUpdate,
        accessToken,
      });

      if (addTeamsResult.success) {
        const addTeamsResponse = addTeamsResult.data;
        teamsToAddOrUpdate.forEach((team) => {
          const action = targetTeamMap.has(team.name) ? 'updated' : 'added';
          results.push({
            repo: targetRepo,
            entity: team.name,
            entityType: 'team',
            action,
            permission: team.permission,
            success: !addTeamsResponse.errors.some((error) =>
              error.includes(team.name),
            ),
            error:
              addTeamsResponse.errors.find((error) =>
                error.includes(team.name),
              ) || undefined,
          });
        });
      } else {
        teamsToAddOrUpdate.forEach((team) => {
          results.push({
            repo: targetRepo,
            entity: team.name,
            entityType: 'team',
            action: targetTeamMap.has(team.name) ? 'updated' : 'added',
            permission: team.permission,
            success: false,
            error: addTeamsResult.error.message,
          });
        });
      }
    }

    const teamsToRemove = targetTeams.filter(
      (targetTeam) => !sourceTeamMap.has(targetTeam.name),
    );

    if (teamsToRemove.length > 0) {
      const removeTeamsResult = await removeGitHubTeamsFromRepos({
        owner,
        repos: [targetRepo],
        teams: teamsToRemove.map((team) => ({ name: team.name })),
        accessToken,
      });

      if (removeTeamsResult.success) {
        const removeTeamsResponse = removeTeamsResult.data;
        teamsToRemove.forEach((team) => {
          results.push({
            repo: targetRepo,
            entity: team.name,
            entityType: 'team',
            action: 'removed',
            permission: team.permission,
            success: removeTeamsResponse.removedTeams.some(
              (removed) =>
                removed.team === team.name && removed.repo === targetRepo,
            ),
            error:
              removeTeamsResponse.errors.find((error) =>
                error.includes(team.name),
              ) || undefined,
          });
        });
      } else {
        teamsToRemove.forEach((team) => {
          results.push({
            repo: targetRepo,
            entity: team.name,
            entityType: 'team',
            action: 'removed',
            permission: team.permission,
            success: false,
            error: removeTeamsResult.error.message,
          });
        });
      }
    }

    sourceTeams
      .filter(
        (sourceTeam) =>
          targetTeamMap.has(sourceTeam.name) &&
          targetTeamMap.get(sourceTeam.name) === sourceTeam.permission,
      )
      .forEach((team) => {
        results.push({
          repo: targetRepo,
          entity: team.name,
          entityType: 'team',
          action: 'unchanged',
          permission: team.permission,
          success: true,
        });
      });
  } catch (error) {
    results.push({
      repo: targetRepo,
      entity: 'Unknown',
      entityType: 'team',
      action: 'added',
      permission: 'Unknown',
      success: false,
      error:
        error instanceof RequestError
          ? `Request failed with status ${error.status}: ${error.message}`
          : String(error),
    });
  }

  return results;
}

/**
 * Synchronizes user collaborator access from a source repository to a single target repository.
 * Adds users present in the source but missing from the target, removes users not in the source,
 * and updates users with differing permission levels.
 * @param params - The source repo, target repo, organization owner, and access token.
 * @returns An array of sync results per user.
 */
async function synchronizeUserAccess({
  sourceRepo,
  targetRepo,
  owner,
  accessToken,
}: {
  sourceRepo: string;
  targetRepo: string;
  owner: string;
  accessToken: string;
}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

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

    const targetUsersResult = await getGitHubRepoUsers({
      owner,
      repo: targetRepo,
      accessToken,
    });

    if (!targetUsersResult.success) {
      throw new Error(
        `Error fetching users for target repository ${targetRepo}: ${targetUsersResult.error.message}`,
      );
    }

    const targetUsers = targetUsersResult.data;

    const getUserPermission = (user: {
      permissions?: Record<string, boolean>;
    }): string => {
      if (!user.permissions) return 'pull';
      return (
        Object.keys(user.permissions).find(
          (key) => user.permissions?.[key as keyof typeof user.permissions],
        ) ?? 'pull'
      );
    };

    const sourceUserMap = new Map(
      sourceUsers.map((user) => [user.login, getUserPermission(user)]),
    );
    const targetUserMap = new Map(
      targetUsers.map((user) => [user.login, getUserPermission(user)]),
    );

    const usersToAddOrUpdate = sourceUsers.filter(
      (sourceUser) =>
        !targetUserMap.has(sourceUser.login) ||
        targetUserMap.get(sourceUser.login) !== getUserPermission(sourceUser),
    );

    const additionPromises = usersToAddOrUpdate.map(async (user) => {
      const addResult = await addUserToRepo({
        repo: targetRepo,
        user: {
          username: user.login,
          permission: getUserPermission(user),
        },
        owner,
        accessToken,
      });
      const action: 'updated' | 'added' = targetUserMap.has(user.login)
        ? 'updated'
        : 'added';
      return {
        repo: targetRepo,
        entity: user.login,
        entityType: 'user' as const,
        action,
        permission: getUserPermission(user),
        success: addResult.success,
        error: addResult.success ? undefined : addResult.error.message,
      };
    });

    const addResults = await Promise.all(additionPromises);
    results.push(...addResults);

    const usersToRemove = targetUsers.filter(
      (targetUser) => !sourceUserMap.has(targetUser.login),
    );

    if (usersToRemove.length > 0) {
      const removeUsersResult = await removeGitHubUsersFromRepos({
        owner,
        repos: [targetRepo],
        users: usersToRemove.map((user) => ({ username: user.login })),
        accessToken,
      });

      if (removeUsersResult.success) {
        const removeUsersResponse = removeUsersResult.data;
        usersToRemove.forEach((user) => {
          results.push({
            repo: targetRepo,
            entity: user.login,
            entityType: 'user',
            action: 'removed',
            permission: getUserPermission(user),
            success: removeUsersResponse.removedUsers.some(
              (removed) =>
                removed.username === user.login && removed.repo === targetRepo,
            ),
            error:
              removeUsersResponse.errors.find((error) =>
                error.includes(user.login),
              ) || undefined,
          });
        });
      } else {
        usersToRemove.forEach((user) => {
          results.push({
            repo: targetRepo,
            entity: user.login,
            entityType: 'user',
            action: 'removed',
            permission: getUserPermission(user),
            success: false,
            error: removeUsersResult.error.message,
          });
        });
      }
    }

    sourceUsers
      .filter(
        (sourceUser) =>
          targetUserMap.has(sourceUser.login) &&
          targetUserMap.get(sourceUser.login) === getUserPermission(sourceUser),
      )
      .forEach((user) => {
        results.push({
          repo: targetRepo,
          entity: user.login,
          entityType: 'user',
          action: 'unchanged',
          permission: getUserPermission(user),
          success: true,
        });
      });
  } catch (error) {
    results.push({
      repo: targetRepo,
      entity: 'Unknown',
      entityType: 'user',
      action: 'added',
      permission: 'Unknown',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

/**
 * Synchronizes user and/or team access from a source repository to one or more target repositories
 * in the same GitHub organization. Adds, removes, and updates access to exactly match the source.
 * Optionally copies the `.github` directory as well.
 * Validates the source and each target repository before synchronizing.
 * @param parameters - The owner, source repo, target repos, sync flags, and access token.
 * @returns An array of sync results per entity per target repository.
 */
export async function synchronizeGitHubRepoAccess(
  parameters: SynchronizeGitHubRepoAccessParameters & {
    accessToken: string | undefined;
  },
): Promise<SyncResult[]> {
  const {
    accessToken,
    shouldSyncTeamAccess,
    shouldSyncUserAccess,
    shouldCopyGitHubDirectory,
    ...params
  } = parameters;
  if (!accessToken) {
    return [
      {
        repo: 'Unknown',
        entity: 'Unknown',
        entityType: 'user',
        action: 'added',
        permission: 'Unknown',
        success: false,
        error: 'Error synchronizing GitHub access. Are you logged in?',
      },
    ];
  }

  if (!shouldSyncTeamAccess && !shouldSyncUserAccess) {
    return [
      {
        repo: 'Unknown',
        entity: 'Unknown',
        entityType: 'user',
        action: 'added',
        permission: 'Unknown',
        success: false,
        error:
          'No access to synchronize. Please enable at least one type of access to sync (users or teams).',
      },
    ];
  }

  const syncResults: SyncResult[] = [];

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
        entityType: 'user',
        action: 'added',
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
      syncResults.push({
        repo: targetRepo,
        entity: 'Target Repository',
        entityType: 'user',
        action: 'added',
        permission: 'Unknown',
        success: false,
        error: `Error: target repository ${params.owner}/${targetRepo} does not exist`,
      });
    } else {
      validTargetRepos.push(targetRepo);
    }
  }

  if (validTargetRepos.length === 0) {
    return syncResults;
  }

  if (shouldSyncTeamAccess) {
    const syncPromises = validTargetRepos.map((targetRepo) =>
      synchronizeTeamAccess({
        sourceRepo: params.sourceRepo,
        targetRepo,
        owner: params.owner,
        accessToken,
      }),
    );

    const results = await Promise.all(syncPromises);
    for (const result of results) {
      syncResults.push(...result);
    }
  }

  if (shouldSyncUserAccess) {
    const syncPromises = validTargetRepos.map((targetRepo) =>
      synchronizeUserAccess({
        sourceRepo: params.sourceRepo,
        targetRepo,
        owner: params.owner,
        accessToken,
      }),
    );

    const results = await Promise.all(syncPromises);
    for (const result of results) {
      syncResults.push(...result);
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
      syncResults.push({
        repo: result.repo,
        entity: result.filePath,
        entityType: 'user',
        action: 'added',
        permission: '.github file',
        success: result.success,
        error: result.error,
      });
    });
  }

  return syncResults;
}
