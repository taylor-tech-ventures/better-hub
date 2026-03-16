# Feature: GitHub Administration Tools

gh-admin provides 81 GitHub administration tools organized into 17 categories. All tools are available through the web chat, MCP server, and CLI. Read-only tools execute immediately; write/destructive tools require explicit user confirmation.

---

## Tool Categories

### Organization & User Management

| Tool | Description | Confirmation |
|---|---|---|
| `listUserOrgs` | List all GitHub organizations the authenticated user belongs to | Auto |
| `listOrgRepos` | List repositories in an organization with optional type filter and cache control | Auto |
| `listOrgTeams` | List teams in an organization with optional cache control | Auto |
| `getRepoBranches` | List branches for one or more repositories | Auto |
| `getRepoTeams` | List teams with access to a specific repository | Auto |
| `getGitHubUserInfo` | Get profile information for a GitHub user | Auto |
| `getOrgMembersList` | List all members of an organization | Auto |

### Repository Management

| Tool | Description | Confirmation |
|---|---|---|
| `createGitHubRepo` | Create a new repository (public/private, template, visibility) | **Required** |
| `createGitHubRepoFromTemplate` | Create a repository from an existing template repository | **Required** |
| `deleteGitHubRepos` | Delete one or more repositories (irreversible) | **Required** |
| `updateGitHubRepos` | Bulk update repository metadata (description, visibility, homepage) | **Required** |

### Repository Settings

| Tool | Description | Confirmation |
|---|---|---|
| `updateRepoSettings` | Update repository settings (merge strategies, features, default branch) | **Required** |
| `archiveRepo` | Archive a repository (read-only, reversible) | **Required** |
| `setRepoTopics` | Set topic tags on a repository | Auto |
| `renameRepo` | Rename a repository | **Required** |
| `transferRepo` | Transfer a repository to another owner or organization | **Required** |

### Access & Permissions

| Tool | Description | Confirmation |
|---|---|---|
| `addGitHubUsersToRepos` | Grant users direct access to repositories with a specified permission level | **Required** |
| `removeGitHubUsersFromRepos` | Revoke users' direct access to repositories | **Required** |
| `getGitHubRepoUsers` | List users with direct access to a repository | Auto |
| `listRepoCollaborators` | List all collaborators (direct + team) on a repository | Auto |
| `setRepoPermission` | Change a specific user's permission level on a repository | **Required** |
| `removeOutsideCollaborator` | Remove an outside collaborator from an organization | **Required** |

### Team Management

| Tool | Description | Confirmation |
|---|---|---|
| `createTeam` | Create a new team in an organization | **Required** |
| `deleteTeam` | Delete a team from an organization | **Required** |
| `updateTeam` | Update team name, description, or privacy | **Required** |
| `listChildTeams` | List child teams of a parent team | Auto |
| `addGitHubTeamsToRepos` | Grant teams access to repositories with a specified permission level | **Required** |
| `removeGitHubTeamsFromRepos` | Revoke teams' access to repositories | **Required** |
| `addGitHubUsersToTeams` | Add users as members or maintainers of a team | **Required** |
| `removeGitHubUsersFromTeams` | Remove users from a team | **Required** |
| `getGitHubTeamUsers` | List members of a team | Auto |
| `getGitHubTeamRepos` | List repositories a team has access to | Auto |

### Branch Management

| Tool | Description | Confirmation |
|---|---|---|
| `getGitHubBranchesForRepos` | List branches across multiple repositories | Auto |
| `getGitHubDefaultBranchesForRepos` | Get the default branch name for multiple repositories | Auto |
| `getGitHubBranchShaForRepos` | Get the current HEAD SHA for branches across repositories | Auto |
| `createGitHubBranchesOnRepos` | Create a branch on multiple repositories from a specified SHA | Auto |
| `deleteGitHubBranchOnRepo` | Delete a branch on a repository | **Required** |

### Branch Rulesets

| Tool | Description | Confirmation |
|---|---|---|
| `createGitHubRepoRuleset` | Create a branch ruleset on a repository | Auto |
| `updateGitHubRepoRuleset` | Update an existing branch ruleset | **Required** |
| `deleteGitHubRepoRuleset` | Delete a branch ruleset | **Required** |
| `getGitHubRepoRulesets` | List all rulesets on a repository | Auto |
| `getGitHubRepoRulesetById` | Get a specific ruleset by ID | Auto |

### Settings & Access Copy

| Tool | Description | Confirmation |
|---|---|---|
| `copyGitHubRepoAccess` | Copy all team and user access from one repository to another | **Required** |
| `copyGitHubBranchProtection` | Copy branch protection rules from one repository to others | **Required** |
| `copyGitHubDirectory` | Copy a directory of files from one repository to others | **Required** |
| `synchronizeGitHubRepoAccess` | Synchronize access permissions across a set of repositories | **Required** |

### Pull Requests & Issues

| Tool | Description | Confirmation |
|---|---|---|
| `listPullRequests` | List open (or filtered) pull requests in a repository | Auto |
| `mergePullRequest` | Merge a pull request with specified merge strategy | **Required** |
| `listIssues` | List issues in a repository with optional filters | Auto |
| `createIssue` | Create a new issue in a repository | **Required** |
| `addLabelsToIssue` | Add labels to an existing issue | **Required** |

### GitHub Actions & Workflows

| Tool | Description | Confirmation |
|---|---|---|
| `listWorkflowRuns` | List recent workflow runs with status, branch, and duration | Auto |
| `triggerWorkflowDispatch` | Dispatch a workflow with optional inputs | **Required** |
| `listRepoSecrets` | List repository or organization secrets (names only, not values) | Auto |
| `listEnvironments` | List deployment environments and their protection rules | Auto |
| `getActionsUsage` | Get GitHub Actions minutes usage for a repository or organization | Auto |

### Security & Compliance

| Tool | Description | Confirmation |
|---|---|---|
| `listSecurityAlerts` | List Dependabot and code scanning alerts across repositories | Auto |
| `enableSecurityFeatures` | Enable Dependabot, secret scanning, and/or code scanning on repositories | **Required** |
| `getAuditLog` | Query the GitHub organization audit log with filters | Auto |
| `listDeployKeys` | List deploy keys configured on repositories | Auto |
| `listPendingOrgInvitations` | List pending organization membership invitations | Auto |

### Repository Insights

| Tool | Description | Confirmation |
|---|---|---|
| `getRepoStats` | Get commit frequency, contributor count, and activity metrics | Auto |
| `listRepoContributors` | List contributors with commit counts for a repository | Auto |
| `findStaleRepos` | Find repositories with no commits in the past N days | Auto |

### Webhooks

| Tool | Description | Confirmation |
|---|---|---|
| `listRepoWebhooks` | List webhooks configured on a repository | Auto |
| `createRepoWebhook` | Create a new webhook on a repository | **Required** |
| `listOrgWebhooks` | List webhooks configured at the organization level | Auto |

### Releases & Tags

| Tool | Description | Confirmation |
|---|---|---|
| `listReleases` | List releases for a repository | Auto |
| `createRelease` | Create a new release with optional draft, prerelease, and notes | **Required** |
| `listTags` | List tags for a repository | Auto |

### Code & Content

| Tool | Description | Confirmation |
|---|---|---|
| `getFileContents` | Read the contents of a file from a repository | Auto |
| `searchCode` | Search for code across repositories in an organization | Auto |
| `compareCommits` | Compare two commits, branches, or tags | Auto |

### Organization Administration

| Tool | Description | Confirmation |
|---|---|---|
| `updateOrgSettings` | Update organization-level settings | **Required** |
| `listBlockedUsers` | List users blocked at the organization level | Auto |
| `getOrgBilling` | Get storage and Actions billing summary for an organization | Auto |

### Scheduling

| Tool | Description | Confirmation |
|---|---|---|
| `scheduleTask` | Schedule a PR merge, release, or workflow dispatch for a future time | **Required** |
| `listScheduledTasks` | List pending and completed scheduled tasks | Auto |
| `cancelScheduledTask` | Cancel a pending scheduled task | Auto |
| `deleteScheduledTask` | Delete a scheduled task record | Auto |

### Meta

| Tool | Description | Confirmation |
|---|---|---|
| `listAvailableTools` | List all available tools with descriptions — useful for capability discovery | Auto |

---

## Common Use Cases

### Bulk repository management
```
Update all repos in the platform org that have "legacy" in their name: set them to archived,
remove the devops-team, and add a deprecation topic.
```
This chains `listOrgRepos` → filters → `updateGitHubRepos` (confirmation) → `removeGitHubTeamsFromRepos` (confirmation) → `setRepoTopics`.

### Access audit
```
Show me all users who have direct admin access to any repo in the payments org
that they don't get through a team.
```
Chains `listOrgRepos` → `listRepoCollaborators` for each repo → filters to direct collaborators with admin → renders as table.

### Standardizing branch protection across repos
```
Copy the branch protection rules from the payments-service repo to all other repos in the backend org
that don't already have a main branch ruleset.
```
Chains `listOrgRepos` → `getGitHubRepoRulesets` for each → filters to those without rules → `copyGitHubBranchProtection` (confirmation).

### Security compliance sweep
```
For the engineering org: list all repos that have open Dependabot critical alerts and
don't have secret scanning enabled.
```
Chains `listSecurityAlerts` + `listOrgRepos` → filters → renders compliance table with links.

### Onboarding a new service
```
Create a repo called recommendation-engine in the ml-team org, private, with the ml-service template.
Add the ml-platform team as maintainers and the data-eng team as write.
Set up a main branch ruleset requiring 2 reviews and all status checks.
```
Full workflow: `createGitHubRepoFromTemplate` → `addGitHubTeamsToRepos` (×2) → `createGitHubRepoRuleset`.

---

## How the Agent Handles Large Orgs

For organizations with many repositories, `listOrgRepos` returns cached results (15-minute TTL per user, stored in DO SQLite). The cache is populated in the background at login for Standard and Unlimited plan users.

When you explicitly want fresh data, tell the agent:
```
Show me repos in acme-corp — force a fresh fetch, don't use cache
```

The agent passes `forceRefresh: true` to bypass the cache.

---

## Permission Requirements

The agent uses your own GitHub OAuth token. The tools can only perform actions that your GitHub account is authorized to perform. Common permission issues:

| Error | Meaning |
|---|---|
| `403 Forbidden` | Your account lacks the required GitHub permission |
| `404 Not Found` | The resource doesn't exist or your account can't see it |
| `TOKEN_EXPIRED` | Re-authenticate by signing in again |
| `RATE_LIMITED` | GitHub API rate limit hit; agent shows exact reset time |

For organization-level operations, you typically need to be an org owner or have the relevant team/repo permissions. The agent surfaces the exact GitHub error message so you know what permission is missing.

---

## E2E Test Scenarios

### Scenario 1: Auto-approved read tool — list repos
1. Sign in; navigate to chat
2. Prompt: `List repos in [test org]`
3. **Expect:** `listOrgRepos` executes without confirmation; table renders with name, visibility, language, last-updated, URL columns; no usage warning

### Scenario 2: Stale repo detection
1. Prompt: `Find repos in [test org] with no activity in the last 180 days`
2. **Expect:** `findStaleRepos` executes; results table shows repo name, last commit date, URL; empty state if none qualify

### Scenario 3: Security alert scan
1. Prompt: `List all critical Dependabot alerts in [test org]`
2. **Expect:** `listSecurityAlerts` executes; results grouped by severity; includes repo name, alert title, CVE, URL

### Scenario 4: Create repo — confirmation flow
1. Prompt: `Create a private repo called e2e-test-repo in [test org]`
2. **Expect:** Confirmation card shows repo name, org, visibility; clicking Approve creates repo; agent confirms with GitHub URL; clicking Deny stops operation

### Scenario 5: Bulk delete with individual exclusion
1. Prompt: `Delete the repos e2e-test-a, e2e-test-b, and e2e-test-c from [test org]`
2. **Expect:** Grouped confirmation card lists all three repos with checkboxes; uncheck e2e-test-b; click Approve; only e2e-test-a and e2e-test-c are deleted; agent reports partial completion

### Scenario 6: Copy branch protection
1. Ensure source repo has a main branch ruleset
2. Prompt: `Copy branch protection from [source-repo] to [dest-repo] in [test org]`
3. **Expect:** Agent reads source ruleset with `getGitHubRepoRulesets`; confirmation card summarizes rules to copy; after approval, `copyGitHubBranchProtection` runs; agent confirms

### Scenario 7: Permission error handling
1. Prompt: `Delete the repo [repo you don't own]`
2. **Expect:** Agent attempts deletion; GitHub returns 403; agent surfaces the error with explanation of what permission is needed

### Scenario 8: Rate limit handling
1. (Simulate or wait for rate limit)
2. **Expect:** Agent message includes exact reset time: "GitHub rate limit reached. Resets in 47s (2026-03-15T00:00:47Z)."

### Scenario 9: Cache bypass
1. Prompt: `List repos in [org], skip cache, fresh data only`
2. **Expect:** `listOrgRepos` called with `forceRefresh: true`; cache is populated with fresh data; response notes data freshness

### Scenario 10: listAvailableTools
1. Prompt: `What tools do you have for security compliance?`
2. **Expect:** Agent calls `listAvailableTools` or responds from knowledge; surfaces `listSecurityAlerts`, `enableSecurityFeatures`, `getAuditLog`, `listDeployKeys`, `listPendingOrgInvitations` with descriptions

---

## Technical Reference

| Component | Location |
|---|---|
| Tool contracts (schemas) | `server/agent/tools/contracts.ts` |
| Tool implementations | `server/agent/tools/definitions.ts` |
| AI SDK adapter | `server/agent/tools/index.ts` |
| MCP adapter | `server/agent/tools/mcp-adapter.ts` |
| Approval list | `packages/shared/config/tool-approval.ts` |
| GitHub DAL | `server/data-access-layer/github/` |
| Error types | `server/data-access-layer/github/types.ts` |
| Cache manager | `server/durable-objects/cache-manager.ts` |
