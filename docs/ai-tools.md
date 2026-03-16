# AI Tools — 81 GitHub Administration Tools

The AI agent has 81 tools for GitHub Enterprise Cloud administration, defined as oRPC contracts with corresponding implementations.

## Architecture

- **Contracts:** `server/agent/tools/contracts.ts` — Zod schemas defining input/output for each tool
- **Implementations:** `server/agent/tools/index.ts` — `implementTool` wiring connecting contracts to DAL functions
- **Approval policy:** `shared/config/tool-approval.ts` — `TOOLS_REQUIRING_APPROVAL` list + `toolNeedsApproval()` helper
- **Approval enforcement:** `applyApprovalPolicy()` in `server/agent/tools/index.ts` sets `needsApproval: true` on listed tools

## Tool Categories

### Organization & User Management (Read-only)
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listUserOrgs` | Yes | `github/org/get-user-orgs.ts` |
| `listOrgRepos` | Yes | `github/org/get-org-repos.ts` (cached) |
| `listOrgTeams` | Yes | `github/org/get-org-teams.ts` (cached) |
| `getRepoBranches` | Yes | `github/repo/get-repo-branches.ts` |
| `getRepoTeams` | Yes | `github/team/get-team-repos.ts` |
| `getGitHubUserInfo` | Yes | `github/user/get-github-user-info.ts` |
| `getOrgMembersList` | Yes | `github/org/get-org-members.ts` |

### Repository Management
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `createGitHubRepo` | Yes | `github/repo/create-repo.ts` |
| `createGitHubRepoFromTemplate` | Yes | `github/repo/create-repo.ts` |
| `deleteGitHubRepos` | **No** | `github/repo/delete-repos.ts` |
| `updateGitHubRepos` | **No** | `github/repo/update-repos.ts` |

### Repository Settings
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `updateRepoSettings` | **No** | `github/repo/update-repo-settings.ts` |
| `archiveRepo` | **No** | `github/repo/archive-repo.ts` |
| `setRepoTopics` | Yes | `github/repo/set-repo-topics.ts` |
| `renameRepo` | **No** | `github/repo/rename-repo.ts` |
| `transferRepo` | **No** | `github/repo/transfer-repo.ts` |

### Access & Permissions
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `addGitHubUsersToRepos` | Yes | `github/user/add-users-to-repos.ts` |
| `removeGitHubUsersFromRepos` | **No** | `github/user/remove-users-from-repos.ts` |
| `getGitHubRepoUsers` | Yes | `github/user/get-repo-users.ts` |
| `listRepoCollaborators` | Yes | `github/user/list-repo-collaborators.ts` |
| `setRepoPermission` | **No** | `github/user/set-repo-permission.ts` |
| `removeOutsideCollaborator` | **No** | `github/user/remove-outside-collaborator.ts` |

### Team Management
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `createTeam` | **No** | `github/team/create-team.ts` |
| `deleteTeam` | **No** | `github/team/delete-team.ts` |
| `updateTeam` | **No** | `github/team/update-team.ts` |
| `listChildTeams` | Yes | `github/team/list-child-teams.ts` |
| `addGitHubTeamsToRepos` | Yes | `github/team/add-teams-to-repos.ts` |
| `removeGitHubTeamsFromRepos` | **No** | `github/team/remove-teams-from-repos.ts` |
| `addGitHubUsersToTeams` | Yes | `github/team/add-users-to-teams.ts` |
| `removeGitHubUsersFromTeams` | **No** | `github/team/remove-users-from-teams.ts` |
| `getGitHubTeamUsers` | Yes | `github/team/get-team-users.ts` |
| `getGitHubTeamRepos` | Yes | `github/team/get-team-repos.ts` |

### Branch Management
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `getGitHubBranchesForRepos` | Yes | `github/branch/get-branches-for-repos.ts` |
| `getGitHubDefaultBranchesForRepos` | Yes | `github/branch/get-default-branches-for-repos.ts` |
| `getGitHubBranchShaForRepos` | Yes | `github/branch/get-branch-sha-for-repos.ts` |
| `createGitHubBranchesOnRepos` | Yes | `github/branch/create-branches-on-repos.ts` |
| `deleteGitHubBranchOnRepo` | **No** | `github/branch/delete-branch-on-repo.ts` |

### Repository Rulesets (Branch Protection)
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `createGitHubRepoRuleset` | Yes | `github/rulesets/create-repo-ruleset.ts` |
| `updateGitHubRepoRuleset` | **No** | `github/rulesets/update-repo-ruleset.ts` |
| `deleteGitHubRepoRuleset` | **No** | `github/rulesets/delete-repo-ruleset.ts` |
| `getGitHubRepoRulesets` | Yes | `github/rulesets/get-repo-rulesets.ts` |
| `getGitHubRepoRulesetById` | Yes | `github/rulesets/get-repo-ruleset-by-id.ts` |

### Settings & Configuration
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `copyGitHubRepoAccess` | **No** | `github/settings/copy-access.ts` |
| `copyGitHubBranchProtection` | **No** | `github/settings/copy-branch-protection.ts` |
| `copyGitHubDirectory` | **No** | `github/settings/copy-github-directory.ts` |
| `synchronizeGitHubRepoAccess` | **No** | `github/settings/synchronize-access.ts` |

### PR & Issue Management
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listPullRequests` | Yes | `github/pr/list-pull-requests.ts` |
| `mergePullRequest` | **No** | `github/pr/merge-pull-request.ts` |
| `listIssues` | Yes | `github/issues/list-issues.ts` |
| `createIssue` | **No** | `github/issues/create-issue.ts` |
| `addLabelsToIssue` | **No** | `github/issues/add-labels.ts` |

### GitHub Actions / Workflows
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listWorkflowRuns` | Yes | `github/actions/list-workflow-runs.ts` |
| `triggerWorkflowDispatch` | **No** | `github/actions/trigger-workflow.ts` |
| `listRepoSecrets` | Yes | `github/actions/list-repo-secrets.ts` |
| `listEnvironments` | Yes | `github/actions/list-environments.ts` |
| `getActionsUsage` | Yes | `github/actions/get-actions-usage.ts` |

### Security & Compliance
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listSecurityAlerts` | Yes | `github/security/list-security-alerts.ts` |
| `enableSecurityFeatures` | **No** | `github/security/enable-security-features.ts` |
| `getAuditLog` | Yes | `github/security/get-audit-log.ts` |
| `listDeployKeys` | Yes | `github/security/list-deploy-keys.ts` |
| `listPendingOrgInvitations` | Yes | `github/security/list-pending-invitations.ts` |

### Repository Insights & Reporting
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `getRepoStats` | Yes | `github/repo/get-repo-stats.ts` |
| `listRepoContributors` | Yes | `github/repo/list-repo-contributors.ts` |
| `findStaleRepos` | Yes | `github/org/find-stale-repos.ts` |

### Webhooks & Integrations
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listRepoWebhooks` | Yes | `github/repo/list-repo-webhooks.ts` |
| `createRepoWebhook` | **No** | `github/repo/create-repo-webhook.ts` |
| `listOrgWebhooks` | Yes | `github/org/list-org-webhooks.ts` |

### Release & Tag Management
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listReleases` | Yes | `github/release/list-releases.ts` |
| `createRelease` | **No** | `github/release/create-release-v2.ts` |
| `listTags` | Yes | `github/repo/list-tags.ts` |

### Code & Content
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `getFileContents` | Yes | `github/repo/get-file-contents.ts` |
| `searchCode` | Yes | `github/repo/search-code.ts` |
| `compareCommits` | Yes | `github/repo/compare-commits.ts` |

### Org Administration
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `updateOrgSettings` | **No** | `github/org/update-org-settings.ts` |
| `listBlockedUsers` | Yes | `github/org/list-blocked-users.ts` |
| `getOrgBilling` | Yes | `github/org/get-org-billing.ts` |

### Scheduling
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `scheduleTask` | Yes | `scheduling/scheduled-tasks.ts` |
| `listScheduledTasks` | Yes | `scheduling/scheduled-tasks.ts` |
| `cancelScheduledTask` | Yes | `scheduling/scheduled-tasks.ts` |
| `deleteScheduledTask` | Yes | `scheduling/scheduled-tasks.ts` |

### Meta
| Tool | Auto-Approved | DAL Location |
|------|:---:|---|
| `listAvailableTools` | Yes | N/A (reads from tool registry) |

## Adding a New Tool

1. Define the Zod contract in `server/agent/tools/contracts.ts`
2. Create the DAL function in `server/data-access-layer/github/`
3. Wire the contract to the DAL via `implementTool` in `server/agent/tools/index.ts`
4. If destructive, add the tool name to `TOOLS_REQUIRING_APPROVAL` in `shared/config/tool-approval.ts`
5. Add unit tests in `__tests__/server/data-access-layer/github/`

## Design Decisions

- **Naming convention:** Tool names match FR-3.x requirement references (e.g., `createGitHubRepo`, `deleteGitHubRepos`)
- **Batch operations:** Tools like `deleteGitHubRepos` report per-item success/failure rather than failing the entire batch on first error
- **Cache integration:** `listOrgRepos` and `listOrgTeams` check entity cache first; mutation tools perform write-through cache updates
- **Token retrieval:** All tools get the GitHub access token via `getCurrentAgent()` from the DO context
