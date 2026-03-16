import { implementTool } from '@orpc/ai-sdk';
import { getCurrentAgent } from 'agents';
import { toolNeedsApproval } from '@/shared/config/tool-approval';
import {
  addGitHubTeamsToReposContract,
  addGitHubUsersToReposContract,
  addGitHubUsersToTeamsContract,
  addLabelsToIssueContract,
  archiveRepoContract,
  cancelScheduledTaskContract,
  compareCommitsContract,
  copyGitHubBranchProtectionContract,
  copyGitHubDirectoryContract,
  copyGitHubRepoAccessContract,
  createGitHubBranchesOnReposContract,
  createGitHubRepoContract,
  createGitHubRepoFromTemplateContract,
  createGitHubRepoRulesetContract,
  createIssueContract,
  createReleaseContract,
  createRepoWebhookContract,
  createTeamContract,
  deleteGitHubBranchOnRepoContract,
  deleteGitHubRepoRulesetContract,
  deleteGitHubReposContract,
  deleteScheduledTaskContract,
  deleteTeamContract,
  enableSecurityFeaturesContract,
  findStaleReposContract,
  getActionsUsageContract,
  getAuditLogContract,
  getFileContentsContract,
  getGitHubBranchesForReposContract,
  getGitHubBranchShaForReposContract,
  getGitHubDefaultBranchesForReposContract,
  getGitHubRepoRulesetByIdContract,
  getGitHubRepoRulesetsContract,
  getGitHubRepoUsersContract,
  getGitHubTeamReposContract,
  getGitHubTeamUsersContract,
  getGitHubUserInfoContract,
  getOrgBillingContract,
  getOrgMembersListContract,
  getRepoBranchesContract,
  getRepoStatsContract,
  getRepoTeamsContract,
  listAvailableToolsContract,
  listBlockedUsersContract,
  listChildTeamsContract,
  listDeployKeysContract,
  listEnvironmentsContract,
  listIssuesContract,
  listOrgReposContract,
  listOrgTeamsContract,
  listOrgWebhooksContract,
  listPendingOrgInvitationsContract,
  listPullRequestsContract,
  listReleasesContract,
  listRepoCollaboratorsContract,
  listRepoContributorsContract,
  listRepoSecretsContract,
  listRepoWebhooksContract,
  listScheduledTasksContract,
  listSecurityAlertsContract,
  listTagsContract,
  listUserOrgsContract,
  listWorkflowRunsContract,
  mergePullRequestContract,
  removeGitHubTeamsFromReposContract,
  removeGitHubUsersFromReposContract,
  removeGitHubUsersFromTeamsContract,
  removeOutsideCollaboratorContract,
  renameRepoContract,
  scheduleTaskContract,
  searchCodeContract,
  setRepoPermissionContract,
  setRepoTopicsContract,
  synchronizeGitHubRepoAccessContract,
  transferRepoContract,
  triggerWorkflowDispatchContract,
  updateGitHubRepoRulesetContract,
  updateGitHubReposContract,
  updateOrgSettingsContract,
  updateRepoSettingsContract,
  updateTeamContract,
} from './contracts';
import {
  type GitHubCacheProvider,
  type GitHubScheduleProvider,
  type ToolContext,
  toolDefinitions,
} from './definitions';

export type {
  GitHubCacheProvider,
  GitHubScheduleProvider,
  ToolContext,
} from './definitions';
export { unwrapResult } from './definitions';

// ============================================================================
// Agent Context Adapters
// ============================================================================

interface GitHubTokenProvider {
  getGitHubToken(): Promise<string | undefined>;
}

function isGitHubTokenProvider(value: unknown): value is GitHubTokenProvider {
  return (
    value !== null &&
    typeof value === 'object' &&
    'getGitHubToken' in value &&
    typeof (value as GitHubTokenProvider).getGitHubToken === 'function'
  );
}

function isGitHubCacheProvider(value: unknown): value is GitHubCacheProvider {
  return (
    value !== null &&
    typeof value === 'object' &&
    'getCachedOrgRepos' in value &&
    typeof (value as GitHubCacheProvider).getCachedOrgRepos === 'function'
  );
}

function isGitHubScheduleProvider(
  value: unknown,
): value is GitHubScheduleProvider {
  return (
    value !== null &&
    typeof value === 'object' &&
    'scheduleToolCallTask' in value &&
    typeof (value as GitHubScheduleProvider).scheduleToolCallTask === 'function'
  );
}

/** Builds a ToolContext from the current Cloudflare Agent context. */
function buildContextFromAgent(): ToolContext {
  const { agent } = getCurrentAgent();
  return {
    getAccessToken: () =>
      isGitHubTokenProvider(agent)
        ? agent.getGitHubToken()
        : Promise.resolve(undefined),
    cache: isGitHubCacheProvider(agent) ? agent : null,
    schedule: isGitHubScheduleProvider(agent) ? agent : null,
  };
}

// ============================================================================
// Approval Policy
// ============================================================================

function applyApprovalPolicy<
  T extends Record<string, { needsApproval?: boolean }>,
>(tools: T): T {
  for (const [name, tool] of Object.entries(tools)) {
    if (toolNeedsApproval(name)) {
      tool.needsApproval = true;
    }
  }
  return tools;
}

// ============================================================================
// Contract → Definition mapping
// ============================================================================

const contractMap = {
  listUserOrgs: listUserOrgsContract,
  listOrgRepos: listOrgReposContract,
  listOrgTeams: listOrgTeamsContract,
  getRepoBranches: getRepoBranchesContract,
  getRepoTeams: getRepoTeamsContract,
  getGitHubUserInfo: getGitHubUserInfoContract,
  createGitHubRepo: createGitHubRepoContract,
  createGitHubRepoFromTemplate: createGitHubRepoFromTemplateContract,
  deleteGitHubRepos: deleteGitHubReposContract,
  updateGitHubRepos: updateGitHubReposContract,
  addGitHubUsersToRepos: addGitHubUsersToReposContract,
  removeGitHubUsersFromRepos: removeGitHubUsersFromReposContract,
  getGitHubRepoUsers: getGitHubRepoUsersContract,
  addGitHubTeamsToRepos: addGitHubTeamsToReposContract,
  removeGitHubTeamsFromRepos: removeGitHubTeamsFromReposContract,
  addGitHubUsersToTeams: addGitHubUsersToTeamsContract,
  removeGitHubUsersFromTeams: removeGitHubUsersFromTeamsContract,
  getGitHubTeamUsers: getGitHubTeamUsersContract,
  getGitHubTeamRepos: getGitHubTeamReposContract,
  getGitHubBranchesForRepos: getGitHubBranchesForReposContract,
  getGitHubDefaultBranchesForRepos: getGitHubDefaultBranchesForReposContract,
  getGitHubBranchShaForRepos: getGitHubBranchShaForReposContract,
  createGitHubBranchesOnRepos: createGitHubBranchesOnReposContract,
  deleteGitHubBranchOnRepo: deleteGitHubBranchOnRepoContract,
  createGitHubRepoRuleset: createGitHubRepoRulesetContract,
  updateGitHubRepoRuleset: updateGitHubRepoRulesetContract,
  deleteGitHubRepoRuleset: deleteGitHubRepoRulesetContract,
  getGitHubRepoRulesets: getGitHubRepoRulesetsContract,
  getGitHubRepoRulesetById: getGitHubRepoRulesetByIdContract,
  copyGitHubRepoAccess: copyGitHubRepoAccessContract,
  copyGitHubBranchProtection: copyGitHubBranchProtectionContract,
  copyGitHubDirectory: copyGitHubDirectoryContract,
  synchronizeGitHubRepoAccess: synchronizeGitHubRepoAccessContract,
  listPullRequests: listPullRequestsContract,
  mergePullRequest: mergePullRequestContract,
  listIssues: listIssuesContract,
  createIssue: createIssueContract,
  addLabelsToIssue: addLabelsToIssueContract,
  listWorkflowRuns: listWorkflowRunsContract,
  triggerWorkflowDispatch: triggerWorkflowDispatchContract,
  listRepoSecrets: listRepoSecretsContract,
  listEnvironments: listEnvironmentsContract,
  getActionsUsage: getActionsUsageContract,
  listSecurityAlerts: listSecurityAlertsContract,
  enableSecurityFeatures: enableSecurityFeaturesContract,
  getAuditLog: getAuditLogContract,
  listDeployKeys: listDeployKeysContract,
  listPendingOrgInvitations: listPendingOrgInvitationsContract,
  getRepoStats: getRepoStatsContract,
  listRepoContributors: listRepoContributorsContract,
  findStaleRepos: findStaleReposContract,
  getOrgMembersList: getOrgMembersListContract,
  listRepoCollaborators: listRepoCollaboratorsContract,
  setRepoPermission: setRepoPermissionContract,
  removeOutsideCollaborator: removeOutsideCollaboratorContract,
  updateRepoSettings: updateRepoSettingsContract,
  archiveRepo: archiveRepoContract,
  setRepoTopics: setRepoTopicsContract,
  renameRepo: renameRepoContract,
  transferRepo: transferRepoContract,
  createTeam: createTeamContract,
  deleteTeam: deleteTeamContract,
  updateTeam: updateTeamContract,
  listChildTeams: listChildTeamsContract,
  listRepoWebhooks: listRepoWebhooksContract,
  createRepoWebhook: createRepoWebhookContract,
  listOrgWebhooks: listOrgWebhooksContract,
  listReleases: listReleasesContract,
  createRelease: createReleaseContract,
  listTags: listTagsContract,
  getFileContents: getFileContentsContract,
  searchCode: searchCodeContract,
  compareCommits: compareCommitsContract,
  updateOrgSettings: updateOrgSettingsContract,
  listBlockedUsers: listBlockedUsersContract,
  getOrgBilling: getOrgBillingContract,
  scheduleTask: scheduleTaskContract,
  listScheduledTasks: listScheduledTasksContract,
  cancelScheduledTask: cancelScheduledTaskContract,
  deleteScheduledTask: deleteScheduledTaskContract,
} as const;

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Builds the set of GitHub administration AI tools.
 * Each tool is derived from its oRPC contract via `implementTool`,
 * with the execute logic sourced from shared tool definitions.
 * The GitHub access token is resolved at call time via `getCurrentAgent`.
 */
export function buildGitHubTools() {
  const tools: Record<string, ReturnType<typeof implementTool>> = {};

  for (const [name, contract] of Object.entries(contractMap)) {
    const def = toolDefinitions[name];
    if (!def) continue;
    tools[name] = implementTool(contract, {
      execute: async (input: unknown) =>
        def.execute(input, buildContextFromAgent()),
    });
  }

  tools.listAvailableTools = implementTool(listAvailableToolsContract, {
    execute: async () => {
      const allTools = buildGitHubTools();
      return Object.entries(allTools).map(([name, tool]) => {
        const shape =
          tool.parameters &&
          typeof tool.parameters === 'object' &&
          'shape' in tool.parameters
            ? (tool.parameters.shape as Record<
                string,
                { description?: string }
              >)
            : {};
        const parameters = Object.entries(shape).map(
          ([paramName, paramDef]) => ({
            name: paramName,
            type: 'string',
            required: true,
            description:
              typeof paramDef === 'object' &&
              paramDef !== null &&
              'description' in paramDef
                ? String(paramDef.description)
                : undefined,
          }),
        );
        return {
          name,
          description: String(tool.description ?? ''),
          requiresConfirmation: tool.needsApproval ?? false,
          parameters,
        };
      });
    },
  });

  return applyApprovalPolicy(tools);
}
