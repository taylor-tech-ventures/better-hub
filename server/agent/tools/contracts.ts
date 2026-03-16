import { oc } from '@orpc/contract';
import { z } from 'zod';

/**
 * oRPC contracts for GitHub administration tools.
 *
 * Each contract is the single source of truth for the tool's schema.
 * It defines both the input/output types (for TypeScript) and the
 * schema (for AI SDK tool parameter validation).
 *
 * These contracts are consumed by `implementTool` in tools/index.ts to
 * produce AI SDK-compatible tool definitions without duplicating schemas.
 */

// ============================================================================
// Organization & User Management
// ============================================================================

export const listUserOrgsContract = oc
  .route({
    summary: 'List all GitHub organizations the authenticated user belongs to',
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({ login: z.string(), description: z.string().nullable() }),
    ),
  );

export const listOrgReposContract = oc
  .route({ summary: 'List all repositories in a GitHub organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      type: z
        .enum(['all', 'public', 'private', 'forks', 'sources', 'member'])
        .optional()
        .describe('Filter repositories by type'),
      forceRefresh: z
        .boolean()
        .optional()
        .describe(
          'Set to true to bypass the cache and fetch fresh data from GitHub',
        ),
    }),
  )
  .output(
    z.object({
      repos: z.array(
        z.object({
          name: z.string(),
          full_name: z.string(),
          private: z.boolean(),
          description: z.string().nullable(),
          html_url: z.string(),
        }),
      ),
      cachedAt: z.number().nullable(),
      isFresh: z.boolean(),
    }),
  );

export const listOrgTeamsContract = oc
  .route({ summary: 'List all teams in a GitHub organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      forceRefresh: z
        .boolean()
        .optional()
        .describe(
          'Set to true to bypass the cache and fetch fresh data from GitHub',
        ),
    }),
  )
  .output(
    z.object({
      teams: z.array(
        z.object({
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable(),
          privacy: z.string().nullable(),
          permission: z.string(),
        }),
      ),
      cachedAt: z.number().nullable(),
      isFresh: z.boolean(),
    }),
  );

export const getRepoBranchesContract = oc
  .route({
    summary: 'List all branches for a repository in a GitHub organization',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(z.array(z.object({ name: z.string(), protected: z.boolean() })));

export const getRepoTeamsContract = oc
  .route({ summary: 'List all teams that have access to a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        name: z.string(),
        permission: z.string(),
        html_url: z.string(),
      }),
    ),
  );

export const getGitHubUserInfoContract = oc
  .route({ summary: 'Get information about the authenticated GitHub user' })
  .input(z.object({}))
  .output(
    z.object({
      id: z.number(),
      login: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    }),
  );

// ============================================================================
// Repository Management
// ============================================================================

export const createGitHubRepoContract = oc
  .route({ summary: 'Create a new repository in a GitHub organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      name: z.string().describe('The repository name'),
      description: z
        .string()
        .nullable()
        .optional()
        .describe('A short description of the repository'),
      visibility: z
        .enum(['public', 'private', 'internal'])
        .optional()
        .describe('Repository visibility (defaults to private)'),
      auto_init: z
        .boolean()
        .optional()
        .describe('Initialize with a README (defaults to true)'),
    }),
  )
  .output(
    z.object({
      name: z.string(),
      full_name: z.string(),
      private: z.boolean(),
      html_url: z.string(),
      description: z.string().nullable(),
    }),
  );

export const createGitHubRepoFromTemplateContract = oc
  .route({
    summary: 'Create a new GitHub repository from a template repository',
  })
  .input(
    z.object({
      template_owner: z
        .string()
        .describe('Owner of the template repository (org or user)'),
      template_repo: z.string().describe('Name of the template repository'),
      owner: z.string().describe('Owner for the new repository (org or user)'),
      name: z.string().describe('Name for the new repository'),
      description: z
        .string()
        .nullable()
        .optional()
        .describe('A short description of the new repository'),
      include_all_branches: z
        .boolean()
        .optional()
        .describe(
          'Copy all branches from the template (defaults to false, only default branch)',
        ),
      private: z
        .boolean()
        .optional()
        .describe('Make the new repository private (defaults to true)'),
    }),
  )
  .output(
    z.object({
      name: z.string(),
      full_name: z.string(),
      private: z.boolean(),
      html_url: z.string(),
      description: z.string().nullable(),
    }),
  );

export const deleteGitHubReposContract = oc
  .route({
    summary: 'Delete one or more repositories in a GitHub organization',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repos: z.array(z.string()).describe('List of repository names to delete'),
    }),
  )
  .output(
    z.object({
      deletedRepos: z.array(z.object({ owner: z.string(), name: z.string() })),
      errors: z.array(z.string()),
    }),
  );

export const updateGitHubReposContract = oc
  .route({ summary: 'Update settings for one or more GitHub repositories' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repos: z
        .array(
          z.object({
            name: z.string().describe('The repository name'),
            description: z.string().optional(),
            homepage: z.string().optional(),
            private: z.boolean().optional(),
            has_issues: z.boolean().optional(),
            has_projects: z.boolean().optional(),
            has_wiki: z.boolean().optional(),
            is_template: z.boolean().optional(),
            default_branch: z.string().optional(),
            allow_squash_merge: z.boolean().optional(),
            allow_merge_commit: z.boolean().optional(),
            allow_rebase_merge: z.boolean().optional(),
            allow_auto_merge: z.boolean().optional(),
            delete_branch_on_merge: z.boolean().optional(),
            allow_update_branch: z.boolean().optional(),
            archived: z.boolean().optional(),
          }),
        )
        .describe('List of repositories to update with their new settings'),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
        updated_fields: z.array(z.string()).optional(),
      }),
    ),
  );

// ============================================================================
// User Access Management
// ============================================================================

export const addGitHubUsersToReposContract = oc
  .route({
    summary: 'Add one or more users to one or more GitHub repositories',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repos: z.array(z.string()).describe('List of repository names'),
      users: z
        .array(
          z.object({
            username: z.string().describe('GitHub username'),
            permission: z
              .string()
              .describe(
                'Permission level: pull, triage, push, maintain, or admin',
              ),
          }),
        )
        .describe('Users to add with their permission levels'),
    }),
  )
  .output(
    z.object({
      addedUsers: z.array(z.object({ repo: z.string(), username: z.string() })),
      errors: z.array(z.string()),
    }),
  );

export const removeGitHubUsersFromReposContract = oc
  .route({
    summary: 'Remove one or more users from one or more GitHub repositories',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repos: z.array(z.string()).describe('List of repository names'),
      users: z
        .array(z.object({ username: z.string().describe('GitHub username') }))
        .describe('Users to remove'),
    }),
  )
  .output(
    z.object({
      removedUsers: z.array(
        z.object({ repo: z.string(), username: z.string() }),
      ),
      errors: z.array(z.string()),
    }),
  );

export const getGitHubRepoUsersContract = oc
  .route({ summary: 'List all users who have access to a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        login: z.string(),
        permissions: z
          .object({
            pull: z.boolean().optional(),
            triage: z.boolean().optional(),
            push: z.boolean().optional(),
            maintain: z.boolean().optional(),
            admin: z.boolean().optional(),
          })
          .optional(),
        html_url: z.string(),
      }),
    ),
  );

// ============================================================================
// Team Management
// ============================================================================

export const addGitHubTeamsToReposContract = oc
  .route({
    summary: 'Add one or more teams to one or more GitHub repositories',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization login name'),
      repos: z.array(z.string()).describe('List of repository names'),
      teams: z
        .array(
          z.object({
            name: z.string().describe('Team slug or name'),
            permission: z
              .string()
              .describe(
                'Permission level: pull, triage, push, maintain, or admin',
              ),
          }),
        )
        .describe('Teams to add with their permission levels'),
    }),
  )
  .output(
    z.object({
      addedTeams: z.array(z.object({ repo: z.string(), team: z.string() })),
      errors: z.array(z.string()),
    }),
  );

export const removeGitHubTeamsFromReposContract = oc
  .route({
    summary: 'Remove one or more teams from one or more GitHub repositories',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization login name'),
      repos: z.array(z.string()).describe('List of repository names'),
      teams: z
        .array(z.object({ name: z.string().describe('Team slug or name') }))
        .describe('Teams to remove'),
    }),
  )
  .output(
    z.object({
      removedTeams: z.array(z.object({ repo: z.string(), team: z.string() })),
      errors: z.array(z.string()),
    }),
  );

export const addGitHubUsersToTeamsContract = oc
  .route({
    summary: 'Add one or more users to one or more GitHub teams',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      teams: z.array(z.string()).describe('List of team slugs'),
      users: z
        .array(
          z.object({
            username: z.string().describe('GitHub username'),
            role: z
              .enum(['member', 'maintainer'])
              .optional()
              .describe('Team role (defaults to member)'),
          }),
        )
        .describe('Users to add with their optional roles'),
    }),
  )
  .output(
    z.object({
      addedUsers: z.array(z.object({ team: z.string(), username: z.string() })),
      errors: z.array(z.string()),
    }),
  );

export const removeGitHubUsersFromTeamsContract = oc
  .route({
    summary: 'Remove one or more users from one or more GitHub teams',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      teams: z.array(z.string()).describe('List of team slugs'),
      users: z
        .array(z.object({ username: z.string().describe('GitHub username') }))
        .describe('Users to remove'),
    }),
  )
  .output(
    z.object({
      removedUsers: z.array(
        z.object({ team: z.string(), username: z.string() }),
      ),
      errors: z.array(z.string()),
    }),
  );

export const getGitHubTeamUsersContract = oc
  .route({ summary: 'List all members of a GitHub team' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      team_slug: z.string().describe('The team slug'),
    }),
  )
  .output(
    z.array(
      z.object({
        login: z.string(),
        id: z.number(),
        name: z.string().nullable().optional(),
        role: z.string(),
      }),
    ),
  );

export const getGitHubTeamReposContract = oc
  .route({ summary: 'List all repositories accessible by a GitHub team' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      teamSlug: z.string().describe('The team slug'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        full_name: z.string(),
        private: z.boolean(),
        permissions: z.record(z.string(), z.boolean()).optional(),
        role_name: z.string().optional(),
      }),
    ),
  );

// ============================================================================
// Branch Management
// ============================================================================

export const getGitHubBranchesForReposContract = oc
  .route({ summary: 'List branches for multiple GitHub repositories' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repos: z.array(z.string()).describe('List of repository names'),
    }),
  )
  .output(
    z.record(
      z.string(),
      z.array(z.object({ name: z.string(), protected: z.boolean() })),
    ),
  );

export const getGitHubDefaultBranchesForReposContract = oc
  .route({
    summary: 'Get the default branch name for multiple GitHub repositories',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repos: z.array(z.string()).describe('List of repository names'),
    }),
  )
  .output(z.record(z.string(), z.string()));

export const getGitHubBranchShaForReposContract = oc
  .route({
    summary:
      'Get the SHA commit hash for specific branches across multiple repositories',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      reposBranches: z
        .array(
          z.object({
            repo: z.string().describe('Repository name'),
            branch: z.string().describe('Branch name'),
          }),
        )
        .describe('List of repo/branch pairs to query'),
    }),
  )
  .output(z.record(z.string(), z.object({ sha: z.string(), url: z.string() })));

export const createGitHubBranchesOnReposContract = oc
  .route({ summary: 'Create branches on one or more GitHub repositories' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      operations: z
        .array(
          z.object({
            repo: z.string().describe('Repository name'),
            newBranch: z.string().describe('Name of the branch to create'),
            sourceBranch: z
              .string()
              .optional()
              .describe(
                'Branch to create from (defaults to the default branch)',
              ),
          }),
        )
        .describe('List of branch creation operations'),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        newBranch: z.string(),
        sourceBranch: z.string().optional(),
        success: z.boolean(),
        error: z.string().optional(),
        sha: z.string().optional(),
      }),
    ),
  );

export const deleteGitHubBranchOnRepoContract = oc
  .route({ summary: 'Delete a branch from a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repo: z.string().describe('The repository name'),
      branch: z.string().describe('The branch name to delete'),
    }),
  )
  .output(
    z.object({
      repo: z.string(),
      branch: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
  );

// ============================================================================
// Repository Rulesets
// ============================================================================

const rulesetBypassActorSchema = z.object({
  actor_id: z.number().nullable().optional(),
  actor_type: z.enum([
    'Integration',
    'OrganizationAdmin',
    'RepositoryRole',
    'Team',
    'DeployKey',
  ]),
  bypass_mode: z.enum(['pull_request', 'always']).optional(),
});

const rulesetConditionsSchema = z.object({
  ref_name: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});

const rulesetRuleSchema = z.object({
  type: z.string(),
  parameters: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});

const rulesetOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  enforcement: z.string(),
  target: z.string().optional(),
});

export const createGitHubRepoRulesetContract = oc
  .route({ summary: 'Create a ruleset for a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repo: z.string().describe('The repository name'),
      ruleset: z.object({
        name: z.string().describe('The ruleset name'),
        enforcement: z
          .enum(['active', 'disabled', 'evaluate'])
          .describe('Enforcement level'),
        target: z
          .enum(['branch', 'tag', 'push'])
          .describe('The target for the ruleset'),
        bypass_actors: z
          .array(rulesetBypassActorSchema)
          .optional()
          .describe('Actors that can bypass the ruleset'),
        conditions: rulesetConditionsSchema
          .optional()
          .describe('Conditions that must pass for the ruleset to apply'),
        rules: z
          .array(rulesetRuleSchema)
          .optional()
          .describe('Rules in the ruleset'),
      }),
    }),
  )
  .output(rulesetOutputSchema);

export const updateGitHubRepoRulesetContract = oc
  .route({ summary: 'Update an existing ruleset for a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repo: z.string().describe('The repository name'),
      rulesetId: z.string().describe('The ID of the ruleset to update'),
      ruleset: z.object({
        name: z.string().optional().describe('The ruleset name'),
        enforcement: z
          .enum(['active', 'disabled', 'evaluate'])
          .optional()
          .describe('Enforcement level'),
        target: z
          .enum(['branch', 'tag', 'push'])
          .optional()
          .describe('The target for the ruleset'),
        bypass_actors: z
          .array(rulesetBypassActorSchema)
          .optional()
          .describe('Actors that can bypass the ruleset'),
        conditions: rulesetConditionsSchema
          .optional()
          .describe('Conditions that must pass for the ruleset to apply'),
        rules: z
          .array(rulesetRuleSchema)
          .optional()
          .describe('Rules in the ruleset'),
      }),
    }),
  )
  .output(rulesetOutputSchema);

export const deleteGitHubRepoRulesetContract = oc
  .route({ summary: 'Delete a ruleset from a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repo: z.string().describe('The repository name'),
      rulesetId: z.string().describe('The ID of the ruleset to delete'),
    }),
  )
  .output(z.object({ success: z.boolean(), rulesetId: z.string() }));

export const getGitHubRepoRulesetsContract = oc
  .route({ summary: 'List all rulesets for a GitHub repository' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(z.array(rulesetOutputSchema));

export const getGitHubRepoRulesetByIdContract = oc
  .route({ summary: 'Get a specific ruleset for a GitHub repository by ID' })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization or user login name'),
      repo: z.string().describe('The repository name'),
      rulesetId: z.string().describe('The ID of the ruleset'),
    }),
  )
  .output(
    rulesetOutputSchema.extend({
      rules: z.array(rulesetRuleSchema).optional(),
    }),
  );

// ============================================================================
// Settings & Configuration
// ============================================================================

export const copyGitHubRepoAccessContract = oc
  .route({
    summary:
      'Copy team and/or user access permissions from one repository to others',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization login name'),
      sourceRepo: z
        .string()
        .describe('Repository to copy access settings from'),
      targetRepos: z
        .array(z.string())
        .describe('Repositories to apply the copied access settings to'),
      shouldCopyTeamAccess: z
        .boolean()
        .describe('Copy team access permissions'),
      shouldCopyUserAccess: z
        .boolean()
        .describe('Copy user (collaborator) access permissions'),
      shouldCopyGitHubDirectory: z
        .boolean()
        .optional()
        .describe('Also copy the .github directory contents'),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        entity: z.string(),
        permission: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),
  );

export const copyGitHubBranchProtectionContract = oc
  .route({
    summary:
      'Copy branch protection rules (rulesets) from one repository to others',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization login name'),
      sourceRepo: z
        .string()
        .describe('Repository to copy branch protection rules from'),
      targetRepos: z
        .array(z.string())
        .describe(
          'Repositories to apply the copied branch protection rules to',
        ),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        ruleset: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
        warnings: z.array(z.string()).optional(),
      }),
    ),
  );

export const copyGitHubDirectoryContract = oc
  .route({
    summary: 'Copy the .github directory from one repository to others',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization login name'),
      sourceRepo: z
        .string()
        .describe('Repository to copy the .github directory from'),
      targetRepos: z
        .array(z.string())
        .describe('Repositories to copy the .github directory into'),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        filePath: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),
  );

export const synchronizeGitHubRepoAccessContract = oc
  .route({
    summary:
      'Synchronize access permissions from a source repository to target repositories, adding and removing as needed',
  })
  .input(
    z.object({
      owner: z.string().describe('The GitHub organization login name'),
      sourceRepo: z
        .string()
        .describe('Repository whose access settings are the source of truth'),
      targetRepos: z
        .array(z.string())
        .describe('Repositories to synchronize access settings to'),
      shouldSyncTeamAccess: z.boolean().describe('Sync team access'),
      shouldSyncUserAccess: z
        .boolean()
        .describe('Sync user (collaborator) access'),
      shouldCopyGitHubDirectory: z
        .boolean()
        .optional()
        .describe('Also sync the .github directory'),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        entity: z.string(),
        entityType: z.enum(['team', 'user']),
        action: z.enum(['added', 'removed', 'updated', 'unchanged']),
        permission: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),
  );

// ============================================================================
// PR & Issue Management
// ============================================================================

export const listPullRequestsContract = oc
  .route({ summary: 'List pull requests for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      state: z
        .enum(['open', 'closed', 'all'])
        .optional()
        .describe('Filter by PR state (defaults to open)'),
      head: z
        .string()
        .optional()
        .describe('Filter by head user or head user:branch name'),
      base: z.string().optional().describe('Filter by base branch name'),
    }),
  )
  .output(
    z.array(
      z.object({
        number: z.number(),
        title: z.string(),
        state: z.string(),
        user_login: z.string(),
        html_url: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
        draft: z.boolean(),
      }),
    ),
  );

export const mergePullRequestContract = oc
  .route({ summary: 'Merge a pull request' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      pull_number: z.number().describe('The pull request number'),
      merge_method: z
        .enum(['merge', 'squash', 'rebase'])
        .optional()
        .describe('Merge method (defaults to merge)'),
      commit_title: z
        .string()
        .optional()
        .describe('Custom title for the merge commit'),
      commit_message: z
        .string()
        .optional()
        .describe('Custom message for the merge commit'),
    }),
  )
  .output(
    z.object({
      sha: z.string(),
      merged: z.boolean(),
      message: z.string(),
    }),
  );

export const listIssuesContract = oc
  .route({ summary: 'List issues for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      state: z
        .enum(['open', 'closed', 'all'])
        .optional()
        .describe('Filter by issue state (defaults to open)'),
      labels: z
        .string()
        .optional()
        .describe('Comma-separated list of label names to filter by'),
      assignee: z.string().optional().describe('Filter by assignee username'),
    }),
  )
  .output(
    z.array(
      z.object({
        number: z.number(),
        title: z.string(),
        state: z.string(),
        user_login: z.string(),
        html_url: z.string(),
        labels: z.array(z.string()),
        created_at: z.string(),
      }),
    ),
  );

export const createIssueContract = oc
  .route({ summary: 'Create an issue in a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      title: z.string().describe('Issue title'),
      body: z.string().optional().describe('Issue body content'),
      labels: z
        .array(z.string())
        .optional()
        .describe('Labels to apply to the issue'),
      assignees: z
        .array(z.string())
        .optional()
        .describe('Usernames to assign to the issue'),
    }),
  )
  .output(
    z.object({
      number: z.number(),
      title: z.string(),
      html_url: z.string(),
      state: z.string(),
    }),
  );

export const addLabelsToIssueContract = oc
  .route({ summary: 'Add labels to an issue or pull request' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      issue_number: z.number().describe('The issue or PR number'),
      labels: z.array(z.string()).describe('Labels to add'),
    }),
  )
  .output(
    z.array(
      z.object({
        name: z.string(),
        color: z.string(),
        description: z.string().nullable(),
      }),
    ),
  );

// ============================================================================
// GitHub Actions / Workflows
// ============================================================================

export const listWorkflowRunsContract = oc
  .route({ summary: 'List recent workflow runs for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      workflow_id: z
        .union([z.number(), z.string()])
        .optional()
        .describe('Filter by workflow ID or filename'),
      status: z
        .string()
        .optional()
        .describe('Filter by status (completed, in_progress, queued)'),
      branch: z.string().optional().describe('Filter by branch name'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        name: z.string().nullable(),
        status: z.string().nullable(),
        conclusion: z.string().nullable(),
        html_url: z.string(),
        created_at: z.string(),
        head_branch: z.string().nullable(),
      }),
    ),
  );

export const triggerWorkflowDispatchContract = oc
  .route({ summary: 'Trigger a workflow dispatch event' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      workflow_id: z
        .union([z.number(), z.string()])
        .describe('The workflow ID or filename'),
      ref: z
        .string()
        .describe('The git reference (branch or tag) to run the workflow on'),
      inputs: z
        .record(z.string(), z.string())
        .optional()
        .describe('Input parameters for the workflow'),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  );

export const listRepoSecretsContract = oc
  .route({ summary: 'List repository Actions secret names (not values)' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        name: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
      }),
    ),
  );

export const listEnvironmentsContract = oc
  .route({ summary: 'List deployment environments for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        html_url: z.string(),
        protection_rules_count: z.number(),
        deployment_branch_policy: z
          .object({
            protected_branches: z.boolean(),
            custom_branch_policies: z.boolean(),
          })
          .nullable(),
      }),
    ),
  );

export const getActionsUsageContract = oc
  .route({
    summary: 'Get GitHub Actions billing and usage for an organization',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
    }),
  )
  .output(
    z.object({
      total_minutes_used: z.number(),
      total_paid_minutes_used: z.number(),
      included_minutes: z.number(),
      minutes_used_breakdown: z.record(z.string(), z.number()),
    }),
  );

// ============================================================================
// Security & Compliance
// ============================================================================

export const listSecurityAlertsContract = oc
  .route({ summary: 'List Dependabot security alerts for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      state: z
        .enum(['open', 'fixed', 'dismissed'])
        .optional()
        .describe('Filter by alert state'),
      severity: z
        .enum(['critical', 'high', 'medium', 'low'])
        .optional()
        .describe('Filter by severity level'),
    }),
  )
  .output(
    z.array(
      z.object({
        number: z.number(),
        state: z.string(),
        severity: z.string(),
        summary: z.string(),
        html_url: z.string(),
        created_at: z.string(),
        package_name: z.string(),
      }),
    ),
  );

export const enableSecurityFeaturesContract = oc
  .route({ summary: 'Enable security features on one or more repositories' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repos: z.array(z.string()).describe('List of repository names'),
      features: z
        .object({
          dependabot_alerts: z
            .boolean()
            .optional()
            .describe('Enable Dependabot alerts'),
          dependabot_updates: z
            .boolean()
            .optional()
            .describe('Enable Dependabot security updates'),
          secret_scanning: z
            .boolean()
            .optional()
            .describe('Enable secret scanning'),
          secret_scanning_push_protection: z
            .boolean()
            .optional()
            .describe('Enable secret scanning push protection'),
        })
        .describe('Security features to enable'),
    }),
  )
  .output(
    z.array(
      z.object({
        repo: z.string(),
        feature: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
      }),
    ),
  );

export const getAuditLogContract = oc
  .route({ summary: 'Query the organization audit log' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      phrase: z
        .string()
        .optional()
        .describe('Search phrase to filter audit log entries'),
      include: z
        .enum(['web', 'git', 'all'])
        .optional()
        .describe('Event type to include'),
      after: z.string().optional().describe('Cursor for pagination (after)'),
      before: z.string().optional().describe('Cursor for pagination (before)'),
    }),
  )
  .output(
    z.array(
      z.object({
        action: z.string(),
        actor: z.string(),
        created_at: z.number(),
        repo: z.string().optional(),
        org: z.string().optional(),
      }),
    ),
  );

export const listDeployKeysContract = oc
  .route({ summary: 'List deploy keys for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        key_preview: z.string(),
        read_only: z.boolean(),
        created_at: z.string(),
      }),
    ),
  );

export const listPendingOrgInvitationsContract = oc
  .route({ summary: 'List pending organization invitations' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        login: z.string().nullable(),
        email: z.string().nullable(),
        role: z.string(),
        created_at: z.string(),
        inviter_login: z.string(),
      }),
    ),
  );

// ============================================================================
// Repository Insights & Reporting
// ============================================================================

export const getRepoStatsContract = oc
  .route({
    summary: 'Get repository statistics (forks, stars, watchers, etc.)',
  })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.object({
      forks_count: z.number(),
      stargazers_count: z.number(),
      watchers_count: z.number(),
      open_issues_count: z.number(),
      last_push_at: z.string().nullable(),
      language: z.string().nullable(),
      license: z.string().nullable(),
      size_kb: z.number(),
    }),
  );

export const listRepoContributorsContract = oc
  .route({ summary: 'List contributors for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        login: z.string(),
        contributions: z.number(),
        html_url: z.string(),
      }),
    ),
  );

export const findStaleReposContract = oc
  .route({
    summary: 'Find repositories with no recent activity in an organization',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      days_inactive: z
        .number()
        .describe('Number of days without a push to consider a repo stale'),
    }),
  )
  .output(
    z.array(
      z.object({
        name: z.string(),
        full_name: z.string(),
        html_url: z.string(),
        last_push_at: z.string().nullable(),
        private: z.boolean(),
        description: z.string().nullable(),
      }),
    ),
  );

export const getOrgMembersListContract = oc
  .route({ summary: 'List all members of a GitHub organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      role: z
        .enum(['all', 'admin', 'member'])
        .optional()
        .describe('Filter by member role (defaults to all)'),
    }),
  )
  .output(
    z.array(
      z.object({
        login: z.string(),
        id: z.number(),
        role: z.string(),
        html_url: z.string(),
      }),
    ),
  );

// ============================================================================
// Access & Permissions
// ============================================================================

export const listRepoCollaboratorsContract = oc
  .route({ summary: 'List outside collaborators on a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      affiliation: z
        .enum(['outside', 'direct', 'all'])
        .optional()
        .describe('Filter by affiliation (defaults to all)'),
    }),
  )
  .output(
    z.array(
      z.object({
        login: z.string(),
        id: z.number(),
        avatar_url: z.string(),
        permissions: z.object({
          admin: z.boolean(),
          maintain: z.boolean(),
          push: z.boolean(),
          triage: z.boolean(),
          pull: z.boolean(),
        }),
        role_name: z.string(),
      }),
    ),
  );

export const setRepoPermissionContract = oc
  .route({ summary: "Set a user's permission level on a repository" })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      username: z.string().describe('The GitHub username'),
      permission: z
        .enum(['pull', 'triage', 'push', 'maintain', 'admin'])
        .describe('Permission level to grant'),
    }),
  )
  .output(
    z.object({
      username: z.string(),
      permission: z.string(),
      repository: z.string(),
    }),
  );

export const removeOutsideCollaboratorContract = oc
  .route({ summary: 'Remove an outside collaborator from an organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      username: z.string().describe('The GitHub username to remove'),
    }),
  )
  .output(z.object({ removed: z.boolean() }));

// ============================================================================
// Repository Settings
// ============================================================================

export const updateRepoSettingsContract = oc
  .route({
    summary:
      'Update repository settings (wiki, issues, projects, discussions, auto-merge, etc.)',
  })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      settings: z
        .object({
          has_wiki: z.boolean().optional().describe('Enable/disable wiki'),
          has_issues: z.boolean().optional().describe('Enable/disable issues'),
          has_projects: z
            .boolean()
            .optional()
            .describe('Enable/disable projects'),
          has_discussions: z
            .boolean()
            .optional()
            .describe('Enable/disable discussions'),
          allow_auto_merge: z
            .boolean()
            .optional()
            .describe('Enable/disable auto-merge'),
          delete_branch_on_merge: z
            .boolean()
            .optional()
            .describe('Auto-delete head branches on merge'),
          allow_squash_merge: z
            .boolean()
            .optional()
            .describe('Allow squash merging'),
          allow_merge_commit: z
            .boolean()
            .optional()
            .describe('Allow merge commits'),
          allow_rebase_merge: z
            .boolean()
            .optional()
            .describe('Allow rebase merging'),
          default_branch: z.string().optional().describe('Default branch name'),
        })
        .describe('Repository settings to update'),
    }),
  )
  .output(
    z.object({
      full_name: z.string(),
      updated_settings: z.record(z.string(), z.unknown()),
    }),
  );

export const archiveRepoContract = oc
  .route({ summary: 'Archive or unarchive a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      archive: z
        .boolean()
        .optional()
        .describe(
          'Set to true to archive, false to unarchive (defaults to true)',
        ),
    }),
  )
  .output(
    z.object({
      archived: z.boolean(),
      full_name: z.string(),
    }),
  );

export const setRepoTopicsContract = oc
  .route({ summary: 'Set topics (tags) on a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      topics: z.array(z.string()).describe('Topics to set on the repository'),
    }),
  )
  .output(z.object({ topics: z.array(z.string()) }));

export const renameRepoContract = oc
  .route({ summary: 'Rename a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The current repository name'),
      newName: z.string().describe('The new name for the repository'),
    }),
  )
  .output(
    z.object({
      full_name: z.string(),
      html_url: z.string(),
    }),
  );

export const transferRepoContract = oc
  .route({ summary: 'Transfer a repository to another organization or user' })
  .input(
    z.object({
      owner: z.string().describe('The current repository owner'),
      repo: z.string().describe('The repository name'),
      newOwner: z.string().describe('The new owner (organization or user)'),
      teamIds: z
        .array(z.number())
        .optional()
        .describe('Team IDs to add to the repo in the new org'),
    }),
  )
  .output(
    z.object({
      full_name: z.string(),
      html_url: z.string(),
    }),
  );

// ============================================================================
// Team CRUD
// ============================================================================

export const createTeamContract = oc
  .route({ summary: 'Create a new team in a GitHub organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      name: z.string().describe('The name of the new team'),
      description: z.string().optional().describe('Team description'),
      privacy: z
        .enum(['closed', 'secret'])
        .optional()
        .describe('Team visibility (defaults to closed)'),
      parentTeamId: z
        .number()
        .optional()
        .describe('Parent team ID for nested teams'),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      privacy: z.string(),
      html_url: z.string(),
    }),
  );

export const deleteTeamContract = oc
  .route({ summary: 'Delete a team from a GitHub organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      team_slug: z.string().describe('The team slug to delete'),
    }),
  )
  .output(z.object({ deleted: z.boolean() }));

export const updateTeamContract = oc
  .route({
    summary:
      "Update a team's name, description, privacy, or notification settings",
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      team_slug: z.string().describe('The team slug to update'),
      name: z.string().optional().describe('New team name'),
      description: z.string().optional().describe('New team description'),
      privacy: z
        .enum(['closed', 'secret'])
        .optional()
        .describe('Team visibility'),
      notification_setting: z
        .enum(['notifications_enabled', 'notifications_disabled'])
        .optional()
        .describe('Notification setting'),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      privacy: z.string(),
      html_url: z.string(),
    }),
  );

export const listChildTeamsContract = oc
  .route({ summary: 'List child (nested) teams of a parent team' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      team_slug: z.string().describe('The parent team slug'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        slug: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        privacy: z.string(),
      }),
    ),
  );

// ============================================================================
// Webhooks & Integrations
// ============================================================================

export const listRepoWebhooksContract = oc
  .route({ summary: 'List webhooks configured on a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        active: z.boolean(),
        events: z.array(z.string()),
        config: z.object({
          url: z.string().optional(),
          content_type: z.string().optional(),
          insecure_ssl: z.string().optional(),
        }),
      }),
    ),
  );

export const createRepoWebhookContract = oc
  .route({ summary: 'Create a webhook on a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      config: z
        .object({
          url: z.string().describe('Webhook payload URL'),
          content_type: z
            .string()
            .optional()
            .describe('Content type (json or form)'),
          secret: z
            .string()
            .optional()
            .describe('Webhook secret for validation'),
          insecure_ssl: z
            .string()
            .optional()
            .describe('Set to "1" to allow insecure SSL'),
        })
        .describe('Webhook configuration'),
      events: z
        .array(z.string())
        .optional()
        .describe('Events to trigger the webhook (defaults to push)'),
      active: z
        .boolean()
        .optional()
        .describe('Whether the webhook is active (defaults to true)'),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      name: z.string(),
      active: z.boolean(),
      events: z.array(z.string()),
      config: z.object({
        url: z.string().optional(),
        content_type: z.string().optional(),
        insecure_ssl: z.string().optional(),
      }),
    }),
  );

export const listOrgWebhooksContract = oc
  .route({ summary: 'List webhooks configured on an organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        active: z.boolean(),
        events: z.array(z.string()),
        config: z.object({
          url: z.string().optional(),
          content_type: z.string().optional(),
          insecure_ssl: z.string().optional(),
        }),
      }),
    ),
  );

// ============================================================================
// Release & Tag Management
// ============================================================================

export const listReleasesContract = oc
  .route({ summary: 'List releases for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      per_page: z
        .number()
        .optional()
        .describe('Number of releases to return (max 100, defaults to 30)'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.number(),
        tag_name: z.string(),
        name: z.string().nullable(),
        draft: z.boolean(),
        prerelease: z.boolean(),
        created_at: z.string(),
        published_at: z.string().nullable(),
        html_url: z.string(),
        author_login: z.string(),
      }),
    ),
  );

export const createReleaseContract = oc
  .route({ summary: 'Create a GitHub release' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      tag_name: z.string().describe('Tag name for the release'),
      name: z.string().optional().describe('Release title'),
      body: z.string().optional().describe('Release notes body'),
      draft: z.boolean().optional().describe('Create as draft release'),
      prerelease: z.boolean().optional().describe('Mark as pre-release'),
      target_commitish: z
        .string()
        .optional()
        .describe('Branch or commit SHA to tag (defaults to default branch)'),
    }),
  )
  .output(
    z.object({
      id: z.number(),
      tag_name: z.string(),
      name: z.string().nullable(),
      draft: z.boolean(),
      prerelease: z.boolean(),
      created_at: z.string(),
      published_at: z.string().nullable(),
      html_url: z.string(),
      author_login: z.string(),
    }),
  );

export const listTagsContract = oc
  .route({ summary: 'List tags for a repository' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      per_page: z
        .number()
        .optional()
        .describe('Number of tags to return (max 100, defaults to 30)'),
    }),
  )
  .output(
    z.array(
      z.object({
        name: z.string(),
        commit_sha: z.string(),
        zipball_url: z.string(),
        tarball_url: z.string(),
      }),
    ),
  );

// ============================================================================
// Code & Content
// ============================================================================

export const getFileContentsContract = oc
  .route({
    summary: 'Read a file from a repository (e.g. README, config files)',
  })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      path: z.string().describe('File path within the repository'),
      ref: z
        .string()
        .optional()
        .describe('Branch, tag, or commit SHA (defaults to default branch)'),
    }),
  )
  .output(
    z.object({
      name: z.string(),
      path: z.string(),
      sha: z.string(),
      size: z.number(),
      type: z.string(),
      content: z.string().nullable(),
      encoding: z.string().nullable(),
      html_url: z.string(),
    }),
  );

export const searchCodeContract = oc
  .route({ summary: 'Search code across repositories in an organization' })
  .input(
    z.object({
      query: z.string().describe('Search query (code pattern, keyword, etc.)'),
      org: z
        .string()
        .optional()
        .describe('Scope search to a specific organization'),
      per_page: z
        .number()
        .optional()
        .describe('Number of results to return (max 100, defaults to 30)'),
    }),
  )
  .output(
    z.object({
      total_count: z.number(),
      items: z.array(
        z.object({
          name: z.string(),
          path: z.string(),
          sha: z.string(),
          html_url: z.string(),
          repository_full_name: z.string(),
        }),
      ),
    }),
  );

export const compareCommitsContract = oc
  .route({ summary: 'Compare two branches, tags, or commits' })
  .input(
    z.object({
      owner: z.string().describe('The repository owner (organization or user)'),
      repo: z.string().describe('The repository name'),
      base: z.string().describe('Base branch, tag, or commit SHA'),
      head: z.string().describe('Head branch, tag, or commit SHA'),
    }),
  )
  .output(
    z.object({
      status: z.string(),
      ahead_by: z.number(),
      behind_by: z.number(),
      total_commits: z.number(),
      commits: z.array(
        z.object({
          sha: z.string(),
          message: z.string(),
          author_login: z.string().nullable(),
        }),
      ),
      files: z.array(
        z.object({
          filename: z.string(),
          status: z.string(),
          additions: z.number(),
          deletions: z.number(),
          changes: z.number(),
        }),
      ),
    }),
  );

// ============================================================================
// Org Administration
// ============================================================================

export const updateOrgSettingsContract = oc
  .route({
    summary: 'Update organization settings (profile, default permissions, 2FA)',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
      settings: z
        .object({
          name: z.string().optional().describe('Organization display name'),
          description: z
            .string()
            .optional()
            .describe('Organization description'),
          company: z.string().optional().describe('Company name'),
          location: z.string().optional().describe('Location'),
          email: z.string().optional().describe('Public email'),
          blog: z.string().optional().describe('Blog URL'),
          default_repository_permission: z
            .enum(['read', 'write', 'admin', 'none'])
            .optional()
            .describe('Default repository permission for members'),
          members_can_create_repositories: z
            .boolean()
            .optional()
            .describe('Allow members to create repositories'),
          members_can_create_public_repositories: z
            .boolean()
            .optional()
            .describe('Allow members to create public repositories'),
          members_can_create_private_repositories: z
            .boolean()
            .optional()
            .describe('Allow members to create private repositories'),
          two_factor_requirement_enabled: z
            .boolean()
            .optional()
            .describe('Require 2FA for organization members'),
        })
        .describe('Organization settings to update'),
    }),
  )
  .output(
    z.object({
      login: z.string(),
      updated_settings: z.record(z.string(), z.unknown()),
    }),
  );

export const listBlockedUsersContract = oc
  .route({ summary: 'List users blocked by the organization' })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
    }),
  )
  .output(
    z.array(
      z.object({
        login: z.string(),
        id: z.number(),
        avatar_url: z.string(),
      }),
    ),
  );

export const getOrgBillingContract = oc
  .route({
    summary: 'Get organization billing usage (Actions, Packages, Storage)',
  })
  .input(
    z.object({
      org: z.string().describe('The GitHub organization login name'),
    }),
  )
  .output(
    z.object({
      actions: z.object({
        total_minutes_used: z.number(),
        total_paid_minutes_used: z.number(),
        included_minutes: z.number(),
      }),
      packages: z.object({
        total_gigabytes_bandwidth_used: z.number(),
        total_paid_gigabytes_bandwidth_used: z.number(),
        included_gigabytes_bandwidth: z.number(),
      }),
      shared_storage: z.object({
        days_left_in_billing_cycle: z.number(),
        estimated_paid_storage_for_month: z.number(),
        estimated_storage_for_month: z.number(),
      }),
    }),
  );

// ============================================================================
// Meta Tools
// ============================================================================

// ============================================================================
// Scheduling
// ============================================================================

/**
 * Schedule a non-destructive write tool to execute at a future time.
 * Destructive tools (those in TOOLS_REQUIRING_APPROVAL) are blocked at
 * the execution layer and must be run immediately with real-time approval.
 */
export const scheduleTaskContract = oc
  .route({
    summary:
      'Schedule a non-destructive GitHub administration tool call to execute at a future time. Only tools that do NOT require user approval may be scheduled (e.g. addGitHubTeamsToRepos, createGitHubRepo, createGitHubBranchesOnRepos). Destructive tools (deleteGitHubRepos, removeGitHubTeamsFromRepos, etc.) are rejected — run those immediately instead.',
  })
  .input(
    z.object({
      toolName: z
        .string()
        .describe(
          'Exact name of a non-destructive write tool, e.g. "addGitHubTeamsToRepos". Tools requiring approval (delete, remove, update, copy, synchronize) are not schedulable.',
        ),
      toolInput: z
        .record(z.string(), z.unknown())
        .describe(
          "The complete input parameters for the tool, matching that tool's schema exactly.",
        ),
      scheduledAt: z
        .string()
        .datetime()
        .describe(
          'ISO 8601 UTC datetime when the operation should execute. Must be in the future, e.g. "2025-06-01T09:00:00Z".',
        ),
      title: z
        .string()
        .describe(
          'Concise human-readable description, e.g. "Remove contractors team from payments-api after sprint".',
        ),
    }),
  )
  .output(
    z.object({
      id: z.string().describe('Unique ID of the created scheduled task'),
      title: z.string(),
      toolName: z.string(),
      scheduledAt: z.string(),
      status: z.string(),
    }),
  );

export const listScheduledTasksContract = oc
  .route({ summary: 'List all scheduled tasks for the current user' })
  .input(
    z.object({
      status: z
        .enum(['pending', 'running', 'completed', 'failed', 'cancelled'])
        .optional()
        .describe('Filter by task status. Omit to return all tasks.'),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        taskType: z.string(),
        toolName: z
          .string()
          .optional()
          .describe('Populated when taskType is "tool_call"'),
        scheduledAt: z.string(),
        status: z.string(),
        error: z.string().optional(),
      }),
    ),
  );

export const cancelScheduledTaskContract = oc
  .route({
    summary: 'Cancel a pending scheduled task so it will not execute',
  })
  .input(
    z.object({
      id: z.string().describe('The scheduled task ID to cancel'),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
    }),
  );

export const deleteScheduledTaskContract = oc
  .route({ summary: 'Permanently delete a scheduled task record' })
  .input(
    z.object({ id: z.string().describe('The scheduled task ID to delete') }),
  )
  .output(z.object({ success: z.boolean() }));

export const listAvailableToolsContract = oc
  .route({
    summary:
      'List all available GitHub administration tools with their descriptions, parameters, and confirmation requirements',
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        requiresConfirmation: z.boolean(),
        parameters: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            required: z.boolean(),
            description: z.string().optional(),
          }),
        ),
      }),
    ),
  );
