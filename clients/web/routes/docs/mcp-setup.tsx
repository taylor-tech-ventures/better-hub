import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  TerminalIcon,
  ZapIcon,
} from 'lucide-react';
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { Separator } from '@/web/components/ui/separator';

export const Route = createFileRoute('/docs/mcp-setup')({
  component: McpSetupDocs,
});

const MCP_CLIENTS = [
  {
    name: 'Claude Code',
    description: 'Anthropic CLI for Claude',
    config: `claude mcp add gh-admin --transport streamable-http https://gh-admin.com/mcp`,
    configType: 'command' as const,
  },
  {
    name: 'Claude Desktop',
    description: 'Anthropic desktop app',
    config: JSON.stringify(
      {
        mcpServers: {
          'gh-admin': {
            url: 'https://gh-admin.com/mcp',
            transport: 'streamable-http',
          },
        },
      },
      null,
      2,
    ),
    configType: 'json' as const,
  },
  {
    name: 'Cursor',
    description: 'AI-powered code editor',
    config: JSON.stringify(
      {
        mcpServers: {
          'gh-admin': {
            url: 'https://gh-admin.com/mcp',
            transport: 'streamable-http',
          },
        },
      },
      null,
      2,
    ),
    configType: 'json' as const,
  },
  {
    name: 'Windsurf',
    description: 'AI-native IDE',
    config: JSON.stringify(
      {
        mcpServers: {
          'gh-admin': {
            url: 'https://gh-admin.com/mcp',
            transport: 'streamable-http',
          },
        },
      },
      null,
      2,
    ),
    configType: 'json' as const,
  },
];

const TOOL_CATEGORIES = [
  {
    title: 'Organization & User',
    tools: [
      'listUserOrgs',
      'listOrgRepos',
      'listOrgTeams',
      'getGitHubUserInfo',
      'getOrgMembersList',
    ],
  },
  {
    title: 'Repository Management',
    tools: [
      'createGitHubRepo',
      'createGitHubRepoFromTemplate',
      'deleteGitHubRepos',
      'updateGitHubRepos',
      'updateRepoSettings',
      'archiveRepo',
      'renameRepo',
      'transferRepo',
      'setRepoTopics',
    ],
  },
  {
    title: 'Access & Permissions',
    tools: [
      'addGitHubUsersToRepos',
      'removeGitHubUsersFromRepos',
      'getGitHubRepoUsers',
      'listRepoCollaborators',
      'setRepoPermission',
      'removeOutsideCollaborator',
    ],
  },
  {
    title: 'Team Management',
    tools: [
      'createTeam',
      'deleteTeam',
      'updateTeam',
      'listChildTeams',
      'addGitHubTeamsToRepos',
      'removeGitHubTeamsFromRepos',
      'addGitHubUsersToTeams',
      'removeGitHubUsersFromTeams',
      'getGitHubTeamUsers',
      'getGitHubTeamRepos',
    ],
  },
  {
    title: 'Branch Management',
    tools: [
      'getRepoBranches',
      'getGitHubBranchesForRepos',
      'createGitHubBranchesOnRepos',
      'deleteGitHubBranchOnRepo',
    ],
  },
  {
    title: 'Rulesets',
    tools: [
      'getGitHubRepoRulesets',
      'createGitHubRepoRuleset',
      'updateGitHubRepoRuleset',
      'deleteGitHubRepoRuleset',
    ],
  },
  {
    title: 'Settings & Sync',
    tools: [
      'copyGitHubRepoAccess',
      'copyGitHubBranchProtection',
      'synchronizeGitHubRepoAccess',
    ],
  },
  {
    title: 'PR & Issues',
    tools: [
      'listPullRequests',
      'mergePullRequest',
      'listIssues',
      'createIssue',
      'addLabelsToIssue',
    ],
  },
  {
    title: 'Actions & Workflows',
    tools: [
      'listWorkflowRuns',
      'triggerWorkflowDispatch',
      'listRepoSecrets',
      'listEnvironments',
      'getActionsUsage',
    ],
  },
  {
    title: 'Security & Compliance',
    tools: [
      'listSecurityAlerts',
      'enableSecurityFeatures',
      'getAuditLog',
      'listDeployKeys',
      'listPendingOrgInvitations',
    ],
  },
  {
    title: 'Webhooks',
    tools: ['listRepoWebhooks', 'createRepoWebhook', 'listOrgWebhooks'],
  },
  {
    title: 'Releases & Tags',
    tools: ['listReleases', 'createRelease', 'listTags'],
  },
  {
    title: 'Code & Content',
    tools: ['getFileContents', 'searchCode', 'compareCommits'],
  },
  {
    title: 'Insights & Reporting',
    tools: ['getRepoStats', 'listRepoContributors', 'findStaleRepos'],
  },
  {
    title: 'Org Administration',
    tools: ['updateOrgSettings', 'listBlockedUsers', 'getOrgBilling'],
  },
];

function McpSetupDocs() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <TerminalIcon className="h-8 w-8 text-primary" />
            <h1 className="font-bold text-4xl tracking-tight">
              MCP Server Setup
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Connect gh-admin to your favorite AI coding assistant via the Model
            Context Protocol. Manage your GitHub organizations from Claude Code,
            Cursor, Windsurf, and more.
          </p>
        </div>

        <Separator className="my-8" />

        {/* How it works */}
        <section className="mb-12">
          <h2 className="mb-4 font-semibold text-2xl">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheckIcon className="h-5 w-5 text-green-500" />
                  1. Authenticate
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your MCP client initiates OAuth. You sign in with your GitHub
                account — the same one you use on gh-admin.com.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ZapIcon className="h-5 w-5 text-yellow-500" />
                  2. Connect
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your AI assistant connects to gh-admin's MCP server and
                discovers all 81 GitHub administration tools.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                  3. Use
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Ask your AI to manage repos, teams, branches, rulesets, and
                more. Destructive actions require explicit confirmation.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Client setup */}
        <section className="mb-12">
          <h2 className="mb-4 font-semibold text-2xl">Client setup</h2>
          <div className="space-y-6">
            {MCP_CLIENTS.map((client) => (
              <Card key={client.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {client.name}
                    <Badge variant="secondary" className="text-xs">
                      {client.description}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {client.configType === 'command' ? (
                    <div className="rounded-md bg-muted p-3">
                      <code className="text-sm">{client.config}</code>
                    </div>
                  ) : (
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-sm">
                      {client.config}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Available tools */}
        <section className="mb-12">
          <h2 className="mb-4 font-semibold text-2xl">Available tools</h2>
          <p className="mb-4 text-muted-foreground">
            All 81 GitHub administration tools are available via MCP. Tools
            marked with a badge require explicit confirmation before execution.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {TOOL_CATEGORIES.map((category) => (
              <Card key={category.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{category.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {category.tools.map((tool) => (
                      <li
                        key={tool}
                        className="flex items-center gap-2 text-sm"
                      >
                        <code className="text-xs text-muted-foreground">
                          {tool}
                        </code>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Usage limits */}
        <section className="mb-12">
          <h2 className="mb-4 font-semibold text-2xl">Usage & pricing</h2>
          <p className="mb-4 text-muted-foreground">
            MCP access is included at every tier. Tool executions count against
            your monthly limit, shared between the web dashboard and MCP.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Free</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                50 tool calls/month. Great for trying it out.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Standard — $19/mo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                500 tool calls/month. For regular use.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Unlimited — $49/mo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Unlimited tool calls. For power users.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mb-12">
          <h2 className="mb-4 font-semibold text-2xl">Troubleshooting</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  OAuth flow doesn't complete
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Ensure your MCP client supports OAuth 2.1 with dynamic client
                registration. Try clearing your client's MCP cache and
                reconnecting.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  "Monthly limit reached" error
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your tool execution count (web + MCP combined) has hit your
                tier's limit. Upgrade at{' '}
                <Link
                  to="/dashboard/billing"
                  className="text-primary underline"
                >
                  /dashboard/billing
                </Link>{' '}
                or wait for the monthly reset.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tools not appearing</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Verify the MCP server URL is exactly{' '}
                <code className="text-xs">https://gh-admin.com/mcp</code> with
                no trailing slash. Check your client's MCP logs for connection
                errors.
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
