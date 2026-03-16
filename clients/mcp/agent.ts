import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import type { ToolContext } from '@/server/agent/tools/definitions';
import {
  type McpToolHooks,
  registerMcpTools,
} from '@/server/agent/tools/mcp-adapter';
import { createLogger } from '@/shared/logger';
import { getMcpSystemPrompt } from '@/shared/prompts';

const logger = createLogger({ module: 'GitHubMcpAgent' });

interface McpProps {
  userId: string;
  githubToken: string;
  subscriptionTier: 'free' | 'standard' | 'unlimited' | 'admin';
  monthlyLimit: number;
}

/**
 * GitHubMcpAgent — Durable Object for MCP server sessions.
 *
 * Each instance serves one authenticated user's MCP session, providing
 * all 81 GitHub administration tools via Streamable HTTP transport.
 * The GitHub token and subscription tier are passed in via `props`
 * from the OAuth handler at session creation time.
 */
export class GitHubMcpAgent extends McpAgent<
  Cloudflare.Env,
  unknown,
  McpProps
> {
  server = new McpServer({
    name: 'gh-admin',
    version: '1.0.0',
  });

  private toolCallCount = 0;

  async init(): Promise<void> {
    const agentLogger = logger.child({
      userId: this.props?.userId,
    });

    agentLogger.info('initializing MCP agent');

    // Register system prompt
    this.server.prompt(
      'gh-admin',
      'GitHub Enterprise Cloud administration system prompt',
      () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getMcpSystemPrompt(),
            },
          },
        ],
      }),
    );

    // Build tool context factory
    const contextFactory = (): ToolContext => ({
      getAccessToken: async () => this.props?.githubToken,
      cache: null,
      schedule: null,
    });

    // Build usage hooks
    const hooks: McpToolHooks = {
      checkUsageLimit: async () => {
        if (
          this.props?.subscriptionTier === 'unlimited' ||
          this.props?.subscriptionTier === 'admin'
        ) {
          return true;
        }
        const limit = this.props?.monthlyLimit ?? 50;
        return this.toolCallCount < limit;
      },
      recordExecution: async (toolName: string) => {
        this.toolCallCount++;
        agentLogger.info(
          { tool: toolName, count: this.toolCallCount },
          'MCP tool executed',
        );
      },
    };

    // Register all GitHub tools
    registerMcpTools(this.server, contextFactory, hooks);

    agentLogger.info('MCP agent initialized');
  }
}
