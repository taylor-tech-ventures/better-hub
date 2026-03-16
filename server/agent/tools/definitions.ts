import { getActionsUsage } from '@/server/data-access-layer/github/actions/get-actions-usage';
import { listEnvironments } from '@/server/data-access-layer/github/actions/list-environments';
import { listRepoSecrets } from '@/server/data-access-layer/github/actions/list-repo-secrets';
import { listWorkflowRuns } from '@/server/data-access-layer/github/actions/list-workflow-runs';
import { triggerWorkflowDispatch } from '@/server/data-access-layer/github/actions/trigger-workflow';
import { createGitHubBranchesOnRepos } from '@/server/data-access-layer/github/branch/create-branches-on-repos';
import { deleteGitHubBranchOnRepo } from '@/server/data-access-layer/github/branch/delete-branch-on-repo';
import { getGitHubBranchShaForRepos } from '@/server/data-access-layer/github/branch/get-branch-sha-for-repos';
import { getGitHubBranchesForRepos } from '@/server/data-access-layer/github/branch/get-branches-for-repos';
import { getGitHubDefaultBranchesForRepos } from '@/server/data-access-layer/github/branch/get-default-branches-for-repos';
import { addLabelsToIssue } from '@/server/data-access-layer/github/issues/add-labels';
import { createIssue } from '@/server/data-access-layer/github/issues/create-issue';
import { listIssues } from '@/server/data-access-layer/github/issues/list-issues';
import { findStaleRepos } from '@/server/data-access-layer/github/org/find-stale-repos';
import { getOrgBilling } from '@/server/data-access-layer/github/org/get-org-billing';
import { getOrgMembersList } from '@/server/data-access-layer/github/org/get-org-members';
import { getGitHubOrgRepos } from '@/server/data-access-layer/github/org/get-org-repos';
import { getGitHubOrgTeams } from '@/server/data-access-layer/github/org/get-org-teams';
import { getGitHubUserOrgs } from '@/server/data-access-layer/github/org/get-user-orgs';
import { listBlockedUsers } from '@/server/data-access-layer/github/org/list-blocked-users';
import { listOrgWebhooks } from '@/server/data-access-layer/github/org/list-org-webhooks';
import { updateOrgSettings } from '@/server/data-access-layer/github/org/update-org-settings';
import { listPullRequests } from '@/server/data-access-layer/github/pr/list-pull-requests';
import { mergePullRequest } from '@/server/data-access-layer/github/pr/merge-pull-request';
import { createRelease } from '@/server/data-access-layer/github/release/create-release-v2';
import { listReleases } from '@/server/data-access-layer/github/release/list-releases';
import { archiveRepo } from '@/server/data-access-layer/github/repo/archive-repo';
import { compareCommits } from '@/server/data-access-layer/github/repo/compare-commits';
import {
  createGitHubRepo,
  createGitHubRepoFromTemplate,
} from '@/server/data-access-layer/github/repo/create-repo';
import { createRepoWebhook } from '@/server/data-access-layer/github/repo/create-repo-webhook';
import { deleteGitHubRepos } from '@/server/data-access-layer/github/repo/delete-repos';
import { getFileContents } from '@/server/data-access-layer/github/repo/get-file-contents';
import { getGitHubRepoBranches } from '@/server/data-access-layer/github/repo/get-repo-branches';
import { getRepoStats } from '@/server/data-access-layer/github/repo/get-repo-stats';
import { listRepoContributors } from '@/server/data-access-layer/github/repo/list-repo-contributors';
import { listRepoWebhooks } from '@/server/data-access-layer/github/repo/list-repo-webhooks';
import { listTags } from '@/server/data-access-layer/github/repo/list-tags';
import { renameRepo } from '@/server/data-access-layer/github/repo/rename-repo';
import { searchCode } from '@/server/data-access-layer/github/repo/search-code';
import { setRepoTopics } from '@/server/data-access-layer/github/repo/set-repo-topics';
import { transferRepo } from '@/server/data-access-layer/github/repo/transfer-repo';
import { updateRepoSettings } from '@/server/data-access-layer/github/repo/update-repo-settings';
import { updateGitHubRepos } from '@/server/data-access-layer/github/repo/update-repos';
import { createGitHubRepoRuleset } from '@/server/data-access-layer/github/rulesets/create-repo-ruleset';
import { deleteGitHubRepoRuleset } from '@/server/data-access-layer/github/rulesets/delete-repo-ruleset';
import { getGitHubRepoRulesetById } from '@/server/data-access-layer/github/rulesets/get-repo-ruleset-by-id';
import { getGitHubRepoRulesets } from '@/server/data-access-layer/github/rulesets/get-repo-rulesets';
import { updateGitHubRepoRuleset } from '@/server/data-access-layer/github/rulesets/update-repo-ruleset';
import { enableSecurityFeatures } from '@/server/data-access-layer/github/security/enable-security-features';
import { getAuditLog } from '@/server/data-access-layer/github/security/get-audit-log';
import { listDeployKeys } from '@/server/data-access-layer/github/security/list-deploy-keys';
import { listPendingOrgInvitations } from '@/server/data-access-layer/github/security/list-pending-invitations';
import { listSecurityAlerts } from '@/server/data-access-layer/github/security/list-security-alerts';
import { copyGitHubRepoAccess } from '@/server/data-access-layer/github/settings/copy-access';
import { copyGitHubBranchProtection } from '@/server/data-access-layer/github/settings/copy-branch-protection';
import { copyGitHubDirectory } from '@/server/data-access-layer/github/settings/copy-github-directory';
import { synchronizeGitHubRepoAccess } from '@/server/data-access-layer/github/settings/synchronize-access';
import { addGitHubTeamsToRepos } from '@/server/data-access-layer/github/team/add-teams-to-repos';
import { addGitHubUsersToTeams } from '@/server/data-access-layer/github/team/add-users-to-teams';
import { createTeam } from '@/server/data-access-layer/github/team/create-team';
import { deleteTeam } from '@/server/data-access-layer/github/team/delete-team';
import { getGitHubRepoTeams } from '@/server/data-access-layer/github/team/get-repo-teams';
import { getGitHubTeamRepos } from '@/server/data-access-layer/github/team/get-team-repos';
import { getGitHubTeamUsers } from '@/server/data-access-layer/github/team/get-team-users';
import { listChildTeams } from '@/server/data-access-layer/github/team/list-child-teams';
import { removeGitHubTeamsFromRepos } from '@/server/data-access-layer/github/team/remove-teams-from-repos';
import { removeGitHubUsersFromTeams } from '@/server/data-access-layer/github/team/remove-users-from-teams';
import { updateTeam } from '@/server/data-access-layer/github/team/update-team';
import {
  GitHubErrorCode,
  type GitHubResult,
} from '@/server/data-access-layer/github/types';
import { addGitHubUsersToRepos } from '@/server/data-access-layer/github/user/add-users-to-repos';
import { getGitHubUserInfo } from '@/server/data-access-layer/github/user/get-github-user-info';
import { getGitHubRepoUsers } from '@/server/data-access-layer/github/user/get-repo-users';
import { listRepoCollaborators } from '@/server/data-access-layer/github/user/list-repo-collaborators';
import { removeOutsideCollaborator } from '@/server/data-access-layer/github/user/remove-outside-collaborator';
import { removeGitHubUsersFromRepos } from '@/server/data-access-layer/github/user/remove-users-from-repos';
import { setRepoPermission } from '@/server/data-access-layer/github/user/set-repo-permission';
import type {
  CachedOrgRepos,
  CachedOrgTeams,
  CachedRepoEntry,
  CachedTeamEntry,
} from '@/server/durable-objects/cache-manager';
import { CACHE_FRESHNESS_THRESHOLD_MS } from '@/server/durable-objects/cache-manager';
import { toolNeedsApproval } from '@/shared/config/tool-approval';
import { createLogger } from '@/shared/logger';

const toolLogger = createLogger({ module: 'tool-definitions' });

// ============================================================================
// Shared Interfaces
// ============================================================================

/** Cache provider interface — avoids importing the concrete GitHubAgent class. */
export interface GitHubCacheProvider {
  getCachedOrgRepos(org: string): CachedOrgRepos | null;
  setCachedOrgRepos(org: string, repos: CachedRepoEntry[]): void;
  getCachedOrgTeams(org: string): CachedOrgTeams | null;
  setCachedOrgTeams(org: string, teams: CachedTeamEntry[]): void;
  addCachedRepo(org: string, repo: CachedRepoEntry): void;
  removeCachedRepos(org: string, repoNames: string[]): void;
  updateCachedRepo(
    org: string,
    oldName: string,
    updates: Partial<CachedRepoEntry>,
  ): void;
}

/** Schedule provider interface — avoids importing the concrete GitHubAgent class. */
export interface GitHubScheduleProvider {
  scheduleToolCallTask(
    toolName: string,
    toolInput: Record<string, unknown>,
    scheduledAt: Date,
    title: string,
  ): Promise<{
    id: string;
    title: string;
    taskType: string;
    status: string;
    scheduledAt: Date;
    payload: Record<string, unknown>;
  }>;
  listUserScheduledTasks(filters?: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  }): Promise<
    Array<{
      id: string;
      title: string;
      taskType: string;
      status: string;
      scheduledAt: Date;
      payload: Record<string, unknown>;
      error: string | null;
    }>
  >;
  cancelUserScheduledTask(
    id: string,
  ): Promise<{ id: string; title: string; status: string }>;
  deleteUserScheduledTask(id: string): Promise<void>;
}

/** Platform-agnostic context passed to every tool execute function. */
export interface ToolContext {
  getAccessToken: () => Promise<string | undefined>;
  cache: GitHubCacheProvider | null;
  schedule: GitHubScheduleProvider | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Unwraps a GitHubResult<T>, throwing a descriptive error on failure.
 *
 * Error messages include actionable context for the AI agent:
 * - RATE_LIMITED: includes seconds until reset so the agent can suggest retrying
 * - TOKEN_EXPIRED: directs the user to re-authenticate
 * - FORBIDDEN / NOT_FOUND: includes the error code prefix so the agent can advise
 */
export function unwrapResult<T>(result: GitHubResult<T>): T {
  if (!result.success) {
    const { code, message, resetAt } = result.error;
    if (code === GitHubErrorCode.RATE_LIMITED) {
      const resetInfo =
        resetAt !== undefined
          ? ` Resets in ${Math.ceil((resetAt - Date.now()) / 1000)}s (${new Date(resetAt).toISOString()}).`
          : '';
      throw new Error(`GitHub rate limit reached: ${message}.${resetInfo}`);
    }
    if (code === GitHubErrorCode.TOKEN_EXPIRED) {
      throw new Error(
        `GitHub authentication required: ${message}. Please sign in again via GitHub OAuth.`,
      );
    }
    if (code === GitHubErrorCode.FORBIDDEN) {
      throw new Error(
        `Access denied: ${message}. Check your GitHub permissions.`,
      );
    }
    if (code === GitHubErrorCode.NOT_FOUND) {
      throw new Error(`Not found: ${message}`);
    }
    throw new Error(`[${code}] ${message}`);
  }
  return result.data;
}

function isCacheFresh(cachedAt: number): boolean {
  return Date.now() - cachedAt < CACHE_FRESHNESS_THRESHOLD_MS;
}

// ============================================================================
// Tool Definition Type
// ============================================================================

/** A platform-agnostic tool definition with its execute logic. */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const listUserOrgsDef: ToolDefinition = {
  execute: async (_input, ctx) => {
    const result = await getGitHubUserOrgs({
      accessToken: await ctx.getAccessToken(),
    });
    return unwrapResult(result).map((org) => ({
      description: org.description ?? null,
      login: org.login,
    }));
  },
};

export const listOrgReposDef: ToolDefinition = {
  execute: async (
    input: { org: string; type?: string; forceRefresh?: boolean },
    ctx,
  ) => {
    const { org, type, forceRefresh } = input;

    if (!forceRefresh && ctx.cache) {
      const cached = ctx.cache.getCachedOrgRepos(org);
      if (cached && isCacheFresh(cached.cachedAt)) {
        return {
          repos: cached.repos,
          cachedAt: cached.cachedAt,
          isFresh: true,
        };
      }
    }

    const result = await getGitHubOrgRepos({
      accessToken: await ctx.getAccessToken(),
      org,
      type,
    });
    const repos = unwrapResult(result).map((repo) => ({
      description: repo.description ?? null,
      full_name: repo.full_name,
      html_url: repo.html_url,
      name: repo.name,
      private: repo.private,
    }));

    if (ctx.cache) {
      try {
        ctx.cache.setCachedOrgRepos(org, repos);
      } catch (err) {
        toolLogger.error({ err }, 'failed to cache org repos');
      }
    }

    return { repos, cachedAt: Date.now(), isFresh: true };
  },
};

export const listOrgTeamsDef: ToolDefinition = {
  execute: async (input: { org: string; forceRefresh?: boolean }, ctx) => {
    const { org, forceRefresh } = input;

    if (!forceRefresh && ctx.cache) {
      const cached = ctx.cache.getCachedOrgTeams(org);
      if (cached && isCacheFresh(cached.cachedAt)) {
        return {
          teams: cached.teams,
          cachedAt: cached.cachedAt,
          isFresh: true,
        };
      }
    }

    const result = await getGitHubOrgTeams({
      accessToken: await ctx.getAccessToken(),
      org,
    });
    const teams = unwrapResult(result).map((team) => ({
      description: team.description ?? null,
      name: team.name,
      permission: team.permission,
      privacy: team.privacy ?? null,
      slug: team.slug,
    }));

    if (ctx.cache) {
      try {
        ctx.cache.setCachedOrgTeams(org, teams);
      } catch (err) {
        toolLogger.error({ err }, 'failed to cache org teams');
      }
    }

    return { teams, cachedAt: Date.now(), isFresh: true };
  },
};

export const getRepoBranchesDef: ToolDefinition = {
  execute: async (input: { org: string; repo: string }, ctx) => {
    const result = await getGitHubRepoBranches({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      repo: input.repo,
    });
    return unwrapResult(result).map((branch) => ({
      name: branch.name,
      protected: branch.protected,
    }));
  },
};

export const getRepoTeamsDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await getGitHubRepoTeams({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result).map((team) => ({
      html_url: team.html_url,
      name: team.name,
      permission: team.permission,
    }));
  },
};

export const getGitHubUserInfoDef: ToolDefinition = {
  execute: async (_input, ctx) => {
    const result = await getGitHubUserInfo({
      accessToken: await ctx.getAccessToken(),
    });
    const user = unwrapResult(result);
    return {
      id: user.id,
      login: user.login,
      name: user.name ?? null,
      email: user.email ?? null,
    };
  },
};

export const createGitHubRepoDef: ToolDefinition = {
  execute: async (
    input: {
      org: string;
      name: string;
      description?: string | null;
      visibility?: string;
      auto_init?: boolean;
    },
    ctx,
  ) => {
    const result = await createGitHubRepo({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      auto_init: input.auto_init,
    });
    const repo = unwrapResult(result);
    const entry = {
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: repo.description ?? null,
    };

    try {
      ctx.cache?.addCachedRepo(input.org, entry);
    } catch (err) {
      toolLogger.error({ err }, 'failed to update repo cache after create');
    }

    return entry;
  },
};

export const createGitHubRepoFromTemplateDef: ToolDefinition = {
  execute: async (
    input: {
      template_owner: string;
      template_repo: string;
      owner: string;
      name: string;
      description?: string | null;
      include_all_branches?: boolean;
      private?: boolean;
    },
    ctx,
  ) => {
    const result = await createGitHubRepoFromTemplate({
      accessToken: await ctx.getAccessToken(),
      template_owner: input.template_owner,
      template_repo: input.template_repo,
      owner: input.owner,
      name: input.name,
      description: input.description,
      include_all_branches: input.include_all_branches,
      private: input.private,
    });
    const repo = unwrapResult(result);
    const entry = {
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: repo.description ?? null,
    };

    try {
      ctx.cache?.addCachedRepo(input.owner, entry);
    } catch (err) {
      toolLogger.error(
        { err },
        'failed to update repo cache after template create',
      );
    }

    return entry;
  },
};

export const deleteGitHubReposDef: ToolDefinition = {
  execute: async (input: { owner: string; repos: string[] }, ctx) => {
    const data = unwrapResult(
      await deleteGitHubRepos({
        accessToken: await ctx.getAccessToken(),
        owner: input.owner,
        repos: input.repos,
      }),
    );

    if (data.deletedRepos.length > 0) {
      try {
        ctx.cache?.removeCachedRepos(
          input.owner,
          data.deletedRepos.map((r) => r.name),
        );
      } catch (err) {
        toolLogger.error({ err }, 'failed to update repo cache after delete');
      }
    }

    return data;
  },
};

export const updateGitHubReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repos: Array<{ name: string; [key: string]: unknown }>;
    },
    ctx,
  ) => {
    const result = await updateGitHubRepos({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repos: input.repos,
    });
    const updates = unwrapResult(result);

    if (ctx.cache) {
      for (const u of updates) {
        if (!u.success) continue;
        const inputRepo = input.repos.find((r) => r.name === u.repo);
        if (!inputRepo) continue;
        const { name: _, ...fields } = inputRepo;
        try {
          ctx.cache.updateCachedRepo(input.owner, u.repo, fields);
        } catch (err) {
          toolLogger.error({ err }, 'failed to update repo cache after update');
        }
      }
    }

    return updates.map((u) => ({
      repo: u.repo,
      success: u.success,
      error: u.error,
      updated_fields: u.updated_fields,
    }));
  },
};

export const addGitHubUsersToReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repos: string[];
      users: Array<{ username: string; permission: string }>;
    },
    ctx,
  ) => {
    return unwrapResult(
      await addGitHubUsersToRepos({
        accessToken: await ctx.getAccessToken(),
        owner: input.owner,
        repos: input.repos,
        users: input.users,
      }),
    );
  },
};

export const removeGitHubUsersFromReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repos: string[];
      users: Array<{ username: string }>;
    },
    ctx,
  ) => {
    return unwrapResult(
      await removeGitHubUsersFromRepos({
        accessToken: await ctx.getAccessToken(),
        owner: input.owner,
        repos: input.repos,
        users: input.users,
      }),
    );
  },
};

export const getGitHubRepoUsersDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await getGitHubRepoUsers({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result).map((user) => ({
      login: user.login,
      permissions: user.permissions,
      html_url: user.html_url,
    }));
  },
};

export const addGitHubTeamsToReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repos: string[];
      teams: Array<{ name: string; permission: string }>;
    },
    ctx,
  ) => {
    return unwrapResult(
      await addGitHubTeamsToRepos({
        accessToken: await ctx.getAccessToken(),
        owner: input.owner,
        repos: input.repos,
        teams: input.teams,
      }),
    );
  },
};

export const removeGitHubTeamsFromReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repos: string[];
      teams: Array<{ name: string }>;
    },
    ctx,
  ) => {
    return unwrapResult(
      await removeGitHubTeamsFromRepos({
        accessToken: await ctx.getAccessToken(),
        owner: input.owner,
        repos: input.repos,
        teams: input.teams,
      }),
    );
  },
};

export const addGitHubUsersToTeamsDef: ToolDefinition = {
  execute: async (
    input: {
      org: string;
      teams: string[];
      users: Array<{ username: string; role?: 'member' | 'maintainer' }>;
    },
    ctx,
  ) => {
    return unwrapResult(
      await addGitHubUsersToTeams({
        accessToken: await ctx.getAccessToken(),
        org: input.org,
        teams: input.teams,
        users: input.users,
      }),
    );
  },
};

export const removeGitHubUsersFromTeamsDef: ToolDefinition = {
  execute: async (
    input: {
      org: string;
      teams: string[];
      users: Array<{ username: string }>;
    },
    ctx,
  ) => {
    return unwrapResult(
      await removeGitHubUsersFromTeams({
        accessToken: await ctx.getAccessToken(),
        org: input.org,
        teams: input.teams,
        users: input.users,
      }),
    );
  },
};

export const getGitHubTeamUsersDef: ToolDefinition = {
  execute: async (input: { org: string; team_slug: string }, ctx) => {
    const result = await getGitHubTeamUsers({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      team_slug: input.team_slug,
    });
    return unwrapResult(result).map((member) => ({
      login: member.login,
      id: member.id,
      name: member.name ?? undefined,
      role: member.role,
    }));
  },
};

export const getGitHubTeamReposDef: ToolDefinition = {
  execute: async (input: { org: string; teamSlug: string }, ctx) => {
    const result = await getGitHubTeamRepos({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      teamSlug: input.teamSlug,
    });
    return unwrapResult(result).map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      permissions: repo.permissions as Record<string, boolean> | undefined,
      role_name: repo.role_name ?? undefined,
    }));
  },
};

export const getGitHubBranchesForReposDef: ToolDefinition = {
  execute: async (input: { owner: string; repos: string[] }, ctx) => {
    const result = await getGitHubBranchesForRepos({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repos: input.repos,
    });
    const data = unwrapResult(result);
    const output: Record<string, { name: string; protected: boolean }[]> = {};
    for (const [repo, branches] of Object.entries(data)) {
      output[repo] = branches.map((b) => ({
        name: b.name,
        protected: b.protected,
      }));
    }
    return output;
  },
};

export const getGitHubDefaultBranchesForReposDef: ToolDefinition = {
  execute: async (input: { owner: string; repos: string[] }, ctx) => {
    const result = await getGitHubDefaultBranchesForRepos({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repos: input.repos,
    });
    return unwrapResult(result);
  },
};

export const getGitHubBranchShaForReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      reposBranches: Array<{ repo: string; branch: string }>;
    },
    ctx,
  ) => {
    const result = await getGitHubBranchShaForRepos({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      reposBranches: input.reposBranches,
    });
    return unwrapResult(result);
  },
};

export const createGitHubBranchesOnReposDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      operations: Array<{
        repo: string;
        newBranch: string;
        sourceBranch?: string;
      }>;
    },
    ctx,
  ) => {
    const result = await createGitHubBranchesOnRepos({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      operations: input.operations,
    });
    const outcomes = unwrapResult(result);
    return outcomes.map((o) => ({
      repo: o.repo,
      newBranch: o.newBranch,
      sourceBranch: o.sourceBranch ?? undefined,
      success: o.success,
      error: o.error ?? undefined,
      sha: o.sha ?? undefined,
    }));
  },
};

export const deleteGitHubBranchOnRepoDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; branch: string },
    ctx,
  ) => {
    const result = await deleteGitHubBranchOnRepo({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
    });
    const outcome = unwrapResult(result);
    return {
      repo: outcome.repo,
      branch: outcome.branch,
      success: outcome.success,
      error: outcome.error ?? undefined,
    };
  },
};

export const createGitHubRepoRulesetDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; ruleset: Record<string, unknown> },
    ctx,
  ) => {
    const result = await createGitHubRepoRuleset({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      ruleset: input.ruleset,
    });
    const data = unwrapResult(result);
    return {
      id: data.id,
      name: data.name,
      enforcement: data.enforcement,
      target: data.target ?? undefined,
    };
  },
};

export const updateGitHubRepoRulesetDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      rulesetId: string;
      ruleset: Record<string, unknown>;
    },
    ctx,
  ) => {
    const result = await updateGitHubRepoRuleset({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      rulesetId: input.rulesetId,
      ruleset: input.ruleset,
    });
    const data = unwrapResult(result);
    return {
      id: data.id,
      name: data.name,
      enforcement: data.enforcement,
      target: data.target ?? undefined,
    };
  },
};

export const deleteGitHubRepoRulesetDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; rulesetId: string },
    ctx,
  ) => {
    const result = await deleteGitHubRepoRuleset({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      rulesetId: input.rulesetId,
    });
    unwrapResult(result);
    return { success: true, rulesetId: input.rulesetId };
  },
};

export const getGitHubRepoRulesetsDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await getGitHubRepoRulesets({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    const rulesets = unwrapResult(result);
    return rulesets.map((r) => ({
      id: r.id,
      name: r.name,
      enforcement: r.enforcement,
      target: r.target ?? undefined,
    }));
  },
};

export const getGitHubRepoRulesetByIdDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; rulesetId: string },
    ctx,
  ) => {
    const result = await getGitHubRepoRulesetById({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      rulesetId: input.rulesetId,
    });
    const data = unwrapResult(result);
    return {
      id: data.id,
      name: data.name,
      enforcement: data.enforcement,
      target: data.target ?? undefined,
      rules: data.rules ?? undefined,
    };
  },
};

export const copyGitHubRepoAccessDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      sourceRepo: string;
      targetRepos: string[];
      shouldCopyTeamAccess: boolean;
      shouldCopyUserAccess: boolean;
      shouldCopyGitHubDirectory?: boolean;
    },
    ctx,
  ) => {
    const result = await copyGitHubRepoAccess({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      sourceRepo: input.sourceRepo,
      targetRepos: input.targetRepos,
      shouldCopyTeamAccess: input.shouldCopyTeamAccess,
      shouldCopyUserAccess: input.shouldCopyUserAccess,
      shouldCopyGitHubDirectory: input.shouldCopyGitHubDirectory,
    });
    return result.map((r) => ({
      repo: r.repo,
      entity: r.entity,
      permission: r.permission,
      success: r.success,
      error: r.error ?? undefined,
    }));
  },
};

export const copyGitHubBranchProtectionDef: ToolDefinition = {
  execute: async (
    input: { owner: string; sourceRepo: string; targetRepos: string[] },
    ctx,
  ) => {
    const accessToken = await ctx.getAccessToken();
    if (!accessToken) {
      throw new Error(
        `Cannot copy branch protection from '${input.owner}/${input.sourceRepo}': not authenticated`,
      );
    }
    const result = await copyGitHubBranchProtection({
      accessToken,
      owner: input.owner,
      sourceRepo: input.sourceRepo,
      targetRepos: input.targetRepos,
    });
    return result.map((r) => ({
      repo: r.repo,
      ruleset: r.ruleset,
      success: r.success,
      error: r.error ?? undefined,
      warnings: r.warnings ?? undefined,
    }));
  },
};

export const copyGitHubDirectoryDef: ToolDefinition = {
  execute: async (
    input: { owner: string; sourceRepo: string; targetRepos: string[] },
    ctx,
  ) => {
    const result = await copyGitHubDirectory({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      sourceRepo: input.sourceRepo,
      targetRepos: input.targetRepos,
    });
    return result.map((r) => ({
      repo: r.repo,
      filePath: r.filePath,
      success: r.success,
      error: r.error ?? undefined,
    }));
  },
};

export const synchronizeGitHubRepoAccessDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      sourceRepo: string;
      targetRepos: string[];
      shouldSyncTeamAccess: boolean;
      shouldSyncUserAccess: boolean;
      shouldCopyGitHubDirectory?: boolean;
    },
    ctx,
  ) => {
    const result = await synchronizeGitHubRepoAccess({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      sourceRepo: input.sourceRepo,
      targetRepos: input.targetRepos,
      shouldSyncTeamAccess: input.shouldSyncTeamAccess,
      shouldSyncUserAccess: input.shouldSyncUserAccess,
      shouldCopyGitHubDirectory: input.shouldCopyGitHubDirectory,
    });
    return result.map((r) => ({
      repo: r.repo,
      entity: r.entity,
      entityType: r.entityType,
      action: r.action,
      permission: r.permission,
      success: r.success,
      error: r.error ?? undefined,
    }));
  },
};

// ============================================================================
// PR & Issue Management
// ============================================================================

export const listPullRequestsDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      state?: string;
      head?: string;
      base?: string;
    },
    ctx,
  ) => {
    const result = await listPullRequests({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      state: input.state,
      head: input.head,
      base: input.base,
    });
    return unwrapResult(result);
  },
};

export const mergePullRequestDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      pull_number: number;
      merge_method?: string;
      commit_title?: string;
      commit_message?: string;
    },
    ctx,
  ) => {
    const result = await mergePullRequest({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pull_number,
      merge_method: input.merge_method,
      commit_title: input.commit_title,
      commit_message: input.commit_message,
    });
    return unwrapResult(result);
  },
};

export const listIssuesDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      state?: string;
      labels?: string;
      assignee?: string;
    },
    ctx,
  ) => {
    const result = await listIssues({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      state: input.state,
      labels: input.labels,
      assignee: input.assignee,
    });
    return unwrapResult(result);
  },
};

export const createIssueDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
    },
    ctx,
  ) => {
    const result = await createIssue({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      title: input.title,
      body: input.body,
      labels: input.labels,
      assignees: input.assignees,
    });
    return unwrapResult(result);
  },
};

export const addLabelsToIssueDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      issue_number: number;
      labels: string[];
    },
    ctx,
  ) => {
    const result = await addLabelsToIssue({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issue_number,
      labels: input.labels,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// GitHub Actions / Workflows
// ============================================================================

export const listWorkflowRunsDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      workflow_id?: number | string;
      status?: string;
      branch?: string;
    },
    ctx,
  ) => {
    const result = await listWorkflowRuns({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      workflow_id: input.workflow_id,
      status: input.status,
      branch: input.branch,
    });
    return unwrapResult(result);
  },
};

export const triggerWorkflowDispatchDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      workflow_id: string | number;
      ref: string;
      inputs?: Record<string, string>;
    },
    ctx,
  ) => {
    const result = await triggerWorkflowDispatch({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      workflow_id: input.workflow_id,
      ref: input.ref,
      inputs: input.inputs,
    });
    return unwrapResult(result);
  },
};

export const listRepoSecretsDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await listRepoSecrets({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result);
  },
};

export const listEnvironmentsDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await listEnvironments({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result);
  },
};

export const getActionsUsageDef: ToolDefinition = {
  execute: async (input: { org: string }, ctx) => {
    const result = await getActionsUsage({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Security & Compliance
// ============================================================================

export const listSecurityAlertsDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; state?: string; severity?: string },
    ctx,
  ) => {
    const result = await listSecurityAlerts({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      state: input.state,
      severity: input.severity,
    });
    return unwrapResult(result);
  },
};

export const enableSecurityFeaturesDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repos: string[];
      features: {
        dependabot_alerts?: boolean;
        dependabot_updates?: boolean;
        secret_scanning?: boolean;
        secret_scanning_push_protection?: boolean;
      };
    },
    ctx,
  ) => {
    const result = await enableSecurityFeatures({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repos: input.repos,
      features: input.features,
    });
    return unwrapResult(result);
  },
};

export const getAuditLogDef: ToolDefinition = {
  execute: async (
    input: {
      org: string;
      phrase?: string;
      include?: string;
      after?: string;
      before?: string;
    },
    ctx,
  ) => {
    const result = await getAuditLog({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      phrase: input.phrase,
      include: input.include,
      after: input.after,
      before: input.before,
    });
    return unwrapResult(result);
  },
};

export const listDeployKeysDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await listDeployKeys({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result);
  },
};

export const listPendingOrgInvitationsDef: ToolDefinition = {
  execute: async (input: { org: string }, ctx) => {
    const result = await listPendingOrgInvitations({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Repository Insights & Reporting
// ============================================================================

export const getRepoStatsDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await getRepoStats({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result);
  },
};

export const listRepoContributorsDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await listRepoContributors({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result);
  },
};

export const findStaleReposDef: ToolDefinition = {
  execute: async (input: { org: string; days_inactive: number }, ctx) => {
    const result = await findStaleRepos({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      days_inactive: input.days_inactive,
    });
    return unwrapResult(result);
  },
};

export const getOrgMembersListDef: ToolDefinition = {
  execute: async (input: { org: string; role?: string }, ctx) => {
    const result = await getOrgMembersList({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      role: input.role,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Access & Permissions
// ============================================================================

export const listRepoCollaboratorsDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; affiliation?: string },
    ctx,
  ) => {
    const result = await listRepoCollaborators({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      affiliation: input.affiliation as
        | 'outside'
        | 'direct'
        | 'all'
        | undefined,
    });
    return unwrapResult(result);
  },
};

export const setRepoPermissionDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      username: string;
      permission: string;
    },
    ctx,
  ) => {
    const result = await setRepoPermission({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      username: input.username,
      permission: input.permission as
        | 'pull'
        | 'triage'
        | 'push'
        | 'maintain'
        | 'admin',
    });
    return unwrapResult(result);
  },
};

export const removeOutsideCollaboratorDef: ToolDefinition = {
  execute: async (input: { org: string; username: string }, ctx) => {
    const result = await removeOutsideCollaborator({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      username: input.username,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Repository Settings
// ============================================================================

export const updateRepoSettingsDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      settings: Record<string, unknown>;
    },
    ctx,
  ) => {
    const result = await updateRepoSettings({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      settings: input.settings as Parameters<
        typeof updateRepoSettings
      >[0]['settings'],
    });
    return unwrapResult(result);
  },
};

export const archiveRepoDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; archive?: boolean },
    ctx,
  ) => {
    const result = await archiveRepo({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      archive: input.archive,
    });
    return unwrapResult(result);
  },
};

export const setRepoTopicsDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; topics: string[] },
    ctx,
  ) => {
    const result = await setRepoTopics({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      topics: input.topics,
    });
    return unwrapResult(result);
  },
};

export const renameRepoDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; newName: string },
    ctx,
  ) => {
    const result = await renameRepo({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      newName: input.newName,
    });
    return unwrapResult(result);
  },
};

export const transferRepoDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      newOwner: string;
      teamIds?: number[];
    },
    ctx,
  ) => {
    const result = await transferRepo({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      newOwner: input.newOwner,
      teamIds: input.teamIds,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Team CRUD
// ============================================================================

export const createTeamDef: ToolDefinition = {
  execute: async (
    input: {
      org: string;
      name: string;
      description?: string;
      privacy?: string;
      parentTeamId?: number;
    },
    ctx,
  ) => {
    const result = await createTeam({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      name: input.name,
      description: input.description,
      privacy: input.privacy as 'closed' | 'secret' | undefined,
      parentTeamId: input.parentTeamId,
    });
    return unwrapResult(result);
  },
};

export const deleteTeamDef: ToolDefinition = {
  execute: async (input: { org: string; team_slug: string }, ctx) => {
    const result = await deleteTeam({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      team_slug: input.team_slug,
    });
    return unwrapResult(result);
  },
};

export const updateTeamDef: ToolDefinition = {
  execute: async (
    input: {
      org: string;
      team_slug: string;
      name?: string;
      description?: string;
      privacy?: string;
      notification_setting?: string;
    },
    ctx,
  ) => {
    const result = await updateTeam({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      team_slug: input.team_slug,
      name: input.name,
      description: input.description,
      privacy: input.privacy as 'closed' | 'secret' | undefined,
      notification_setting: input.notification_setting as
        | 'notifications_enabled'
        | 'notifications_disabled'
        | undefined,
    });
    return unwrapResult(result);
  },
};

export const listChildTeamsDef: ToolDefinition = {
  execute: async (input: { org: string; team_slug: string }, ctx) => {
    const result = await listChildTeams({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      team_slug: input.team_slug,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Webhooks & Integrations
// ============================================================================

export const listRepoWebhooksDef: ToolDefinition = {
  execute: async (input: { owner: string; repo: string }, ctx) => {
    const result = await listRepoWebhooks({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
    });
    return unwrapResult(result);
  },
};

export const createRepoWebhookDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      config: {
        url: string;
        content_type?: string;
        secret?: string;
        insecure_ssl?: string;
      };
      events?: string[];
      active?: boolean;
    },
    ctx,
  ) => {
    const result = await createRepoWebhook({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      config: input.config,
      events: input.events,
      active: input.active,
    });
    return unwrapResult(result);
  },
};

export const listOrgWebhooksDef: ToolDefinition = {
  execute: async (input: { org: string }, ctx) => {
    const result = await listOrgWebhooks({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Release & Tag Management
// ============================================================================

export const listReleasesDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; per_page?: number },
    ctx,
  ) => {
    const result = await listReleases({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      per_page: input.per_page,
    });
    return unwrapResult(result);
  },
};

export const createReleaseDef: ToolDefinition = {
  execute: async (
    input: {
      owner: string;
      repo: string;
      tag_name: string;
      name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
      target_commitish?: string;
    },
    ctx,
  ) => {
    const result = await createRelease({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      tag_name: input.tag_name,
      name: input.name,
      body: input.body,
      draft: input.draft,
      prerelease: input.prerelease,
      target_commitish: input.target_commitish,
    });
    return unwrapResult(result);
  },
};

export const listTagsDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; per_page?: number },
    ctx,
  ) => {
    const result = await listTags({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      per_page: input.per_page,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Code & Content
// ============================================================================

export const getFileContentsDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; path: string; ref?: string },
    ctx,
  ) => {
    const result = await getFileContents({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      ref: input.ref,
    });
    return unwrapResult(result);
  },
};

export const searchCodeDef: ToolDefinition = {
  execute: async (
    input: { query: string; org?: string; per_page?: number },
    ctx,
  ) => {
    const result = await searchCode({
      accessToken: await ctx.getAccessToken(),
      query: input.query,
      org: input.org,
      per_page: input.per_page,
    });
    return unwrapResult(result);
  },
};

export const compareCommitsDef: ToolDefinition = {
  execute: async (
    input: { owner: string; repo: string; base: string; head: string },
    ctx,
  ) => {
    const result = await compareCommits({
      accessToken: await ctx.getAccessToken(),
      owner: input.owner,
      repo: input.repo,
      base: input.base,
      head: input.head,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Org Administration
// ============================================================================

export const updateOrgSettingsDef: ToolDefinition = {
  execute: async (
    input: { org: string; settings: Record<string, unknown> },
    ctx,
  ) => {
    const result = await updateOrgSettings({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
      settings: input.settings as Parameters<
        typeof updateOrgSettings
      >[0]['settings'],
    });
    return unwrapResult(result);
  },
};

export const listBlockedUsersDef: ToolDefinition = {
  execute: async (input: { org: string }, ctx) => {
    const result = await listBlockedUsers({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
    });
    return unwrapResult(result);
  },
};

export const getOrgBillingDef: ToolDefinition = {
  execute: async (input: { org: string }, ctx) => {
    const result = await getOrgBilling({
      accessToken: await ctx.getAccessToken(),
      org: input.org,
    });
    return unwrapResult(result);
  },
};

// ============================================================================
// Scheduling
// ============================================================================

export const scheduleTaskDef: ToolDefinition = {
  execute: async (
    input: {
      toolName: string;
      toolInput: Record<string, unknown>;
      scheduledAt: string;
      title: string;
    },
    ctx,
  ) => {
    if (toolNeedsApproval(input.toolName)) {
      throw new Error(
        `"${input.toolName}" is a destructive tool that cannot be scheduled. ` +
          'Only non-destructive write tools may be scheduled. ' +
          'To perform this action, run it immediately so the user can approve it in real time.',
      );
    }
    const provider = ctx.schedule;
    if (!provider) throw new Error('Scheduling unavailable in this context.');
    const task = await provider.scheduleToolCallTask(
      input.toolName,
      input.toolInput,
      new Date(input.scheduledAt),
      input.title,
    );
    const p = task.payload as { toolName?: string };
    return {
      id: task.id,
      title: task.title,
      toolName: p.toolName ?? input.toolName,
      scheduledAt: task.scheduledAt.toISOString(),
      status: task.status,
    };
  },
};

export const listScheduledTasksDef: ToolDefinition = {
  execute: async (
    input: {
      status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    },
    ctx,
  ) => {
    const provider = ctx.schedule;
    if (!provider) throw new Error('Scheduling unavailable in this context.');
    const tasks = await provider.listUserScheduledTasks(
      input.status ? { status: input.status } : undefined,
    );
    return tasks.map((t) => {
      const p = t.payload as { toolName?: string };
      return {
        id: t.id,
        title: t.title,
        taskType: t.taskType,
        toolName: p.toolName,
        scheduledAt: t.scheduledAt.toISOString(),
        status: t.status,
        error: t.error ?? undefined,
      };
    });
  },
};

export const cancelScheduledTaskDef: ToolDefinition = {
  execute: async (input: { id: string }, ctx) => {
    const provider = ctx.schedule;
    if (!provider) throw new Error('Scheduling unavailable in this context.');
    const task = await provider.cancelUserScheduledTask(input.id);
    return { id: task.id, title: task.title, status: task.status };
  },
};

export const deleteScheduledTaskDef: ToolDefinition = {
  execute: async (input: { id: string }, ctx) => {
    const provider = ctx.schedule;
    if (!provider) throw new Error('Scheduling unavailable in this context.');
    await provider.deleteUserScheduledTask(input.id);
    return { success: true };
  },
};

// ============================================================================
// Registry — all tool definitions keyed by name
// ============================================================================

export const toolDefinitions: Record<string, ToolDefinition> = {
  listUserOrgs: listUserOrgsDef,
  listOrgRepos: listOrgReposDef,
  listOrgTeams: listOrgTeamsDef,
  getRepoBranches: getRepoBranchesDef,
  getRepoTeams: getRepoTeamsDef,
  getGitHubUserInfo: getGitHubUserInfoDef,
  createGitHubRepo: createGitHubRepoDef,
  createGitHubRepoFromTemplate: createGitHubRepoFromTemplateDef,
  deleteGitHubRepos: deleteGitHubReposDef,
  updateGitHubRepos: updateGitHubReposDef,
  addGitHubUsersToRepos: addGitHubUsersToReposDef,
  removeGitHubUsersFromRepos: removeGitHubUsersFromReposDef,
  getGitHubRepoUsers: getGitHubRepoUsersDef,
  addGitHubTeamsToRepos: addGitHubTeamsToReposDef,
  removeGitHubTeamsFromRepos: removeGitHubTeamsFromReposDef,
  addGitHubUsersToTeams: addGitHubUsersToTeamsDef,
  removeGitHubUsersFromTeams: removeGitHubUsersFromTeamsDef,
  getGitHubTeamUsers: getGitHubTeamUsersDef,
  getGitHubTeamRepos: getGitHubTeamReposDef,
  getGitHubBranchesForRepos: getGitHubBranchesForReposDef,
  getGitHubDefaultBranchesForRepos: getGitHubDefaultBranchesForReposDef,
  getGitHubBranchShaForRepos: getGitHubBranchShaForReposDef,
  createGitHubBranchesOnRepos: createGitHubBranchesOnReposDef,
  deleteGitHubBranchOnRepo: deleteGitHubBranchOnRepoDef,
  createGitHubRepoRuleset: createGitHubRepoRulesetDef,
  updateGitHubRepoRuleset: updateGitHubRepoRulesetDef,
  deleteGitHubRepoRuleset: deleteGitHubRepoRulesetDef,
  getGitHubRepoRulesets: getGitHubRepoRulesetsDef,
  getGitHubRepoRulesetById: getGitHubRepoRulesetByIdDef,
  copyGitHubRepoAccess: copyGitHubRepoAccessDef,
  copyGitHubBranchProtection: copyGitHubBranchProtectionDef,
  copyGitHubDirectory: copyGitHubDirectoryDef,
  synchronizeGitHubRepoAccess: synchronizeGitHubRepoAccessDef,
  listPullRequests: listPullRequestsDef,
  mergePullRequest: mergePullRequestDef,
  listIssues: listIssuesDef,
  createIssue: createIssueDef,
  addLabelsToIssue: addLabelsToIssueDef,
  listWorkflowRuns: listWorkflowRunsDef,
  triggerWorkflowDispatch: triggerWorkflowDispatchDef,
  listRepoSecrets: listRepoSecretsDef,
  listEnvironments: listEnvironmentsDef,
  getActionsUsage: getActionsUsageDef,
  listSecurityAlerts: listSecurityAlertsDef,
  enableSecurityFeatures: enableSecurityFeaturesDef,
  getAuditLog: getAuditLogDef,
  listDeployKeys: listDeployKeysDef,
  listPendingOrgInvitations: listPendingOrgInvitationsDef,
  getRepoStats: getRepoStatsDef,
  listRepoContributors: listRepoContributorsDef,
  findStaleRepos: findStaleReposDef,
  getOrgMembersList: getOrgMembersListDef,
  listRepoCollaborators: listRepoCollaboratorsDef,
  setRepoPermission: setRepoPermissionDef,
  removeOutsideCollaborator: removeOutsideCollaboratorDef,
  updateRepoSettings: updateRepoSettingsDef,
  archiveRepo: archiveRepoDef,
  setRepoTopics: setRepoTopicsDef,
  renameRepo: renameRepoDef,
  transferRepo: transferRepoDef,
  createTeam: createTeamDef,
  deleteTeam: deleteTeamDef,
  updateTeam: updateTeamDef,
  listChildTeams: listChildTeamsDef,
  listRepoWebhooks: listRepoWebhooksDef,
  createRepoWebhook: createRepoWebhookDef,
  listOrgWebhooks: listOrgWebhooksDef,
  listReleases: listReleasesDef,
  createRelease: createReleaseDef,
  listTags: listTagsDef,
  getFileContents: getFileContentsDef,
  searchCode: searchCodeDef,
  compareCommits: compareCommitsDef,
  updateOrgSettings: updateOrgSettingsDef,
  listBlockedUsers: listBlockedUsersDef,
  getOrgBilling: getOrgBillingDef,
  scheduleTask: scheduleTaskDef,
  listScheduledTasks: listScheduledTasksDef,
  cancelScheduledTask: cancelScheduledTaskDef,
  deleteScheduledTask: deleteScheduledTaskDef,
};
