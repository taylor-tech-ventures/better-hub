/**
 * Tool names that require user approval before server-side execution.
 *
 * These correspond to destructive or settings-modifying operations that the
 * AI SDK will pause on (via `needsApproval`) and send an `approval-requested`
 * state to the client. The user must approve or deny before the tool executes.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#tool-execution-approval
 */
export const TOOLS_REQUIRING_APPROVAL = [
  // Destructive operations
  'deleteGitHubRepos',
  'updateGitHubRepos',
  'removeGitHubUsersFromRepos',
  'removeGitHubTeamsFromRepos',
  'removeGitHubUsersFromTeams',
  'deleteGitHubBranchOnRepo',
  'updateGitHubRepoRuleset',
  'deleteGitHubRepoRuleset',
  // Additive operations (create / grant access)
  'createGitHubRepo',
  'addGitHubUsersToRepos',
  'addGitHubTeamsToRepos',
  'addGitHubUsersToTeams',
  // PR & Issue operations
  'mergePullRequest',
  'createIssue',
  'addLabelsToIssue',
  // Workflow operations
  'triggerWorkflowDispatch',
  // Security operations
  'enableSecurityFeatures',
  // Settings / copy operations
  'copyGitHubRepoAccess',
  'copyGitHubBranchProtection',
  'copyGitHubDirectory',
  'synchronizeGitHubRepoAccess',
  // Access & permissions
  'setRepoPermission',
  'removeOutsideCollaborator',
  // Repository settings
  'updateRepoSettings',
  'archiveRepo',
  'renameRepo',
  'transferRepo',
  // Team CRUD
  'createTeam',
  'deleteTeam',
  'updateTeam',
  // Webhooks
  'createRepoWebhook',
  // Releases
  'createRelease',
  // Org administration
  'updateOrgSettings',
  // Scheduling — always confirm before committing a deferred operation
  'scheduleTask',
] as const;

export type ToolRequiringApproval = (typeof TOOLS_REQUIRING_APPROVAL)[number];

/** Check whether a tool name requires user approval before execution. */
export function toolNeedsApproval(toolName: string): boolean {
  return (TOOLS_REQUIRING_APPROVAL as readonly string[]).includes(toolName);
}
