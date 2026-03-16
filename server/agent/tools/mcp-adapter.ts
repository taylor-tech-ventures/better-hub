import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolNeedsApproval } from '@/shared/config/tool-approval';
import { createLogger } from '@/shared/logger';
import * as contracts from './contracts';
import { type ToolContext, toolDefinitions } from './definitions';

const logger = createLogger({ module: 'mcp-adapter' });

/** Map from tool name to its oRPC contract (for schema + description). */
const contractMap: Record<string, (typeof contracts)[keyof typeof contracts]> =
  {
    listUserOrgs: contracts.listUserOrgsContract,
    listOrgRepos: contracts.listOrgReposContract,
    listOrgTeams: contracts.listOrgTeamsContract,
    getRepoBranches: contracts.getRepoBranchesContract,
    getRepoTeams: contracts.getRepoTeamsContract,
    getGitHubUserInfo: contracts.getGitHubUserInfoContract,
    createGitHubRepo: contracts.createGitHubRepoContract,
    createGitHubRepoFromTemplate:
      contracts.createGitHubRepoFromTemplateContract,
    deleteGitHubRepos: contracts.deleteGitHubReposContract,
    updateGitHubRepos: contracts.updateGitHubReposContract,
    addGitHubUsersToRepos: contracts.addGitHubUsersToReposContract,
    removeGitHubUsersFromRepos: contracts.removeGitHubUsersFromReposContract,
    getGitHubRepoUsers: contracts.getGitHubRepoUsersContract,
    addGitHubTeamsToRepos: contracts.addGitHubTeamsToReposContract,
    removeGitHubTeamsFromRepos: contracts.removeGitHubTeamsFromReposContract,
    addGitHubUsersToTeams: contracts.addGitHubUsersToTeamsContract,
    removeGitHubUsersFromTeams: contracts.removeGitHubUsersFromTeamsContract,
    getGitHubTeamUsers: contracts.getGitHubTeamUsersContract,
    getGitHubTeamRepos: contracts.getGitHubTeamReposContract,
    getGitHubBranchesForRepos: contracts.getGitHubBranchesForReposContract,
    getGitHubDefaultBranchesForRepos:
      contracts.getGitHubDefaultBranchesForReposContract,
    getGitHubBranchShaForRepos: contracts.getGitHubBranchShaForReposContract,
    createGitHubBranchesOnRepos: contracts.createGitHubBranchesOnReposContract,
    deleteGitHubBranchOnRepo: contracts.deleteGitHubBranchOnRepoContract,
    createGitHubRepoRuleset: contracts.createGitHubRepoRulesetContract,
    updateGitHubRepoRuleset: contracts.updateGitHubRepoRulesetContract,
    deleteGitHubRepoRuleset: contracts.deleteGitHubRepoRulesetContract,
    getGitHubRepoRulesets: contracts.getGitHubRepoRulesetsContract,
    getGitHubRepoRulesetById: contracts.getGitHubRepoRulesetByIdContract,
    copyGitHubRepoAccess: contracts.copyGitHubRepoAccessContract,
    copyGitHubBranchProtection: contracts.copyGitHubBranchProtectionContract,
    copyGitHubDirectory: contracts.copyGitHubDirectoryContract,
    synchronizeGitHubRepoAccess: contracts.synchronizeGitHubRepoAccessContract,
    listPullRequests: contracts.listPullRequestsContract,
    mergePullRequest: contracts.mergePullRequestContract,
    listIssues: contracts.listIssuesContract,
    createIssue: contracts.createIssueContract,
    addLabelsToIssue: contracts.addLabelsToIssueContract,
    listWorkflowRuns: contracts.listWorkflowRunsContract,
    triggerWorkflowDispatch: contracts.triggerWorkflowDispatchContract,
    listRepoSecrets: contracts.listRepoSecretsContract,
    listEnvironments: contracts.listEnvironmentsContract,
    getActionsUsage: contracts.getActionsUsageContract,
    listSecurityAlerts: contracts.listSecurityAlertsContract,
    enableSecurityFeatures: contracts.enableSecurityFeaturesContract,
    getAuditLog: contracts.getAuditLogContract,
    listDeployKeys: contracts.listDeployKeysContract,
    listPendingOrgInvitations: contracts.listPendingOrgInvitationsContract,
    getRepoStats: contracts.getRepoStatsContract,
    listRepoContributors: contracts.listRepoContributorsContract,
    findStaleRepos: contracts.findStaleReposContract,
    getOrgMembersList: contracts.getOrgMembersListContract,
    listRepoCollaborators: contracts.listRepoCollaboratorsContract,
    setRepoPermission: contracts.setRepoPermissionContract,
    removeOutsideCollaborator: contracts.removeOutsideCollaboratorContract,
    updateRepoSettings: contracts.updateRepoSettingsContract,
    archiveRepo: contracts.archiveRepoContract,
    setRepoTopics: contracts.setRepoTopicsContract,
    renameRepo: contracts.renameRepoContract,
    transferRepo: contracts.transferRepoContract,
    createTeam: contracts.createTeamContract,
    deleteTeam: contracts.deleteTeamContract,
    updateTeam: contracts.updateTeamContract,
    listChildTeams: contracts.listChildTeamsContract,
    listRepoWebhooks: contracts.listRepoWebhooksContract,
    createRepoWebhook: contracts.createRepoWebhookContract,
    listOrgWebhooks: contracts.listOrgWebhooksContract,
    listReleases: contracts.listReleasesContract,
    createRelease: contracts.createReleaseContract,
    listTags: contracts.listTagsContract,
    getFileContents: contracts.getFileContentsContract,
    searchCode: contracts.searchCodeContract,
    compareCommits: contracts.compareCommitsContract,
    updateOrgSettings: contracts.updateOrgSettingsContract,
    listBlockedUsers: contracts.listBlockedUsersContract,
    getOrgBilling: contracts.getOrgBillingContract,
    scheduleTask: contracts.scheduleTaskContract,
    listScheduledTasks: contracts.listScheduledTasksContract,
    cancelScheduledTask: contracts.cancelScheduledTaskContract,
    deleteScheduledTask: contracts.deleteScheduledTaskContract,
  };

/**
 * Summarizes a destructive tool call for the confirmation prompt.
 */
function summarizeAction(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const owner = (params.owner as string) ?? (params.org as string) ?? 'unknown';

  switch (toolName) {
    case 'deleteGitHubRepos':
      return `Delete repositories [${(params.repos as string[])?.join(', ')}] from ${owner}`;
    case 'removeGitHubUsersFromRepos':
      return `Remove users from repositories in ${owner}`;
    case 'removeGitHubTeamsFromRepos':
      return `Remove teams from repositories in ${owner}`;
    case 'removeGitHubUsersFromTeams':
      return `Remove users from teams in ${owner}`;
    case 'deleteGitHubBranchOnRepo':
      return `Delete branch "${params.branch}" from ${owner}/${params.repo}`;
    case 'updateGitHubRepos':
      return `Update settings for repositories in ${owner}`;
    case 'deleteGitHubRepoRuleset':
      return `Delete ruleset ${params.rulesetId} from ${owner}/${params.repo}`;
    case 'updateGitHubRepoRuleset':
      return `Update ruleset ${params.rulesetId} on ${owner}/${params.repo}`;
    case 'copyGitHubRepoAccess':
      return `Copy access from ${owner}/${params.sourceRepo} to ${(params.targetRepos as string[])?.join(', ')}`;
    case 'copyGitHubBranchProtection':
      return `Copy branch protection from ${owner}/${params.sourceRepo} to ${(params.targetRepos as string[])?.join(', ')}`;
    case 'copyGitHubDirectory':
      return `Copy .github directory from ${owner}/${params.sourceRepo} to ${(params.targetRepos as string[])?.join(', ')}`;
    case 'synchronizeGitHubRepoAccess':
      return `Synchronize access from ${owner}/${params.sourceRepo} to ${(params.targetRepos as string[])?.join(', ')}`;
    case 'mergePullRequest':
      return `Merge PR #${params.pull_number} in ${owner}/${params.repo}`;
    case 'createIssue':
      return `Create issue "${params.title}" in ${owner}/${params.repo}`;
    case 'addLabelsToIssue':
      return `Add labels to issue #${params.issue_number} in ${owner}/${params.repo}`;
    case 'triggerWorkflowDispatch':
      return `Trigger workflow ${params.workflow_id} on ${owner}/${params.repo}`;
    case 'enableSecurityFeatures':
      return `Enable security features on ${(params.repos as string[])?.join(', ')} in ${owner}`;
    case 'setRepoPermission':
      return `Set ${params.permission} permission for ${params.username} on ${owner}/${params.repo}`;
    case 'removeOutsideCollaborator':
      return `Remove outside collaborator ${params.username} from ${owner}`;
    case 'updateRepoSettings':
      return `Update settings for ${owner}/${params.repo}`;
    case 'archiveRepo':
      return `${params.archive === false ? 'Unarchive' : 'Archive'} ${owner}/${params.repo}`;
    case 'renameRepo':
      return `Rename ${owner}/${params.repo} to ${params.newName}`;
    case 'transferRepo':
      return `Transfer ${owner}/${params.repo} to ${params.newOwner}`;
    case 'createTeam':
      return `Create team "${params.name}" in ${owner}`;
    case 'deleteTeam':
      return `Delete team ${params.team_slug} from ${owner}`;
    case 'updateTeam':
      return `Update team ${params.team_slug} in ${owner}`;
    case 'createRepoWebhook':
      return `Create webhook on ${owner}/${params.repo}`;
    case 'createRelease':
      return `Create release ${params.tag_name} on ${owner}/${params.repo}`;
    case 'updateOrgSettings':
      return `Update organization settings for ${owner}`;
    default:
      return `Execute ${toolName} on ${owner}`;
  }
}

/**
 * Extracts a Zod schema's shape as a plain JSON Schema-like object
 * for MCP tool registration. Uses the contract's InputSchema.
 */
function getInputSchemaFromContract(
  contract: (typeof contracts)[keyof typeof contracts],
): Record<string, unknown> {
  const inputSchema = contract['~orpc'].InputSchema;
  if (!inputSchema) return {};

  // Let the MCP SDK handle Zod-to-JSON-Schema conversion via zodToJsonSchema
  // We pass the Zod schema directly if the SDK supports it, otherwise convert
  return inputSchema;
}

export interface McpToolHooks {
  checkUsageLimit: () => Promise<boolean>;
  recordExecution: (toolName: string) => Promise<void>;
}

/**
 * Registers all 81 GitHub administration tools on an MCP server instance.
 *
 * Destructive tools use a `confirmed` parameter pattern:
 * - First call without `confirmed: true` returns a confirmation prompt
 * - Second call with `confirmed: true` executes the tool
 */
export function registerMcpTools(
  server: McpServer,
  contextFactory: () => ToolContext,
  hooks: McpToolHooks,
): void {
  for (const [name, def] of Object.entries(toolDefinitions)) {
    const contract = contractMap[name];
    if (!contract) continue;

    const description = contract['~orpc'].route?.summary ?? name;
    const inputSchema = getInputSchemaFromContract(contract);
    const needsConfirmation = toolNeedsApproval(name);

    // For destructive tools, add optional `confirmed` field to schema
    let toolSchema: Record<string, unknown>;
    if (needsConfirmation && inputSchema instanceof z.ZodType) {
      toolSchema = (inputSchema as z.ZodObject<z.ZodRawShape>).extend({
        confirmed: z
          .boolean()
          .optional()
          .describe(
            'Set to true to confirm and execute this destructive action',
          ),
      });
    } else if (needsConfirmation) {
      toolSchema = inputSchema;
    } else {
      toolSchema = inputSchema;
    }

    server.tool(
      name,
      description,
      toolSchema,
      async (params: Record<string, unknown>) => {
        // Check confirmation for destructive tools
        if (needsConfirmation && !params.confirmed) {
          const summary = summarizeAction(name, params);
          return {
            content: [
              {
                type: 'text' as const,
                text: `CONFIRMATION REQUIRED: ${summary}. This action cannot be undone.\n\nTo confirm, call this tool again with the same parameters plus \`confirmed: true\`.`,
              },
            ],
          };
        }

        // Check usage limit
        const allowed = await hooks.checkUsageLimit();
        if (!allowed) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Monthly tool execution limit reached. Upgrade at https://gh-admin.com/dashboard/billing',
              },
            ],
            isError: true,
          };
        }

        // Strip `confirmed` from params before passing to tool definition
        const { confirmed: _, ...toolParams } = params;

        try {
          const result = await def.execute(toolParams, contextFactory());
          await hooks.recordExecution(name);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          logger.error({ err, tool: name }, 'MCP tool execution failed');
          return {
            content: [
              {
                type: 'text' as const,
                text: err instanceof Error ? err.message : String(err),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
}
