// https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/

import handler from '@tanstack/react-start/server-entry';
import { routeAgentRequest } from 'agents';
import { createAuth } from '@/server/auth/index';
import {
  applySecurityHeaders,
  handleCorsPreflightIfNeeded,
} from '@/server/middleware/security-headers';
import {
  isDurableIteratorRequest,
  upgradeGitHubAgentEventsRequest,
} from '@/server/orpc/durable-iterator';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'worker' });

export { GitHubMcpAgent } from '@/mcp/agent';
export { GitHubAgent } from '@/server/durable-objects/github-agent';
export { GitHubAgentEvents } from '@/server/durable-objects/github-agent-events';
export { PromptTemplateDO } from '@/server/durable-objects/prompt-template';
export { AdminActionWorkflow } from '@/server/workflows/admin-action';

/** Returns true for any request the Agents SDK handles (`/agents/**`). */
function isAgentRequest(url: URL): boolean {
  return url.pathname.startsWith('/agents/');
}

/**
 * Extracts the agentId (third path segment) from an agent URL.
 * URL shape: `/agents/{AgentClass}/{agentId}`
 */
function parseAgentId(url: URL): string | null {
  const segments = url.pathname.split('/');
  return segments[3] ?? null;
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    const preflightResponse = handleCorsPreflightIfNeeded(request, env);
    if (preflightResponse) return preflightResponse;

    // Helper to apply security headers to all responses
    const withHeaders = (res: Response) =>
      applySecurityHeaders(res, request, env);

    if (url.pathname.startsWith('/api/auth/')) {
      const auth = createAuth(env);
      return withHeaders(await auth.handler(request));
    }

    // GitHub webhook ingestion for automation rules
    if (url.pathname === '/api/webhooks/github') {
      const { handleGitHubWebhook } = await import(
        '@/server/webhooks/github-webhook-handler'
      );
      return withHeaders(await handleGitHubWebhook(request, env));
    }

    // MCP server — OAuth + Streamable HTTP transport
    if (url.pathname.startsWith('/mcp')) {
      const { createMcpHandler } = await import('@/mcp/handler');
      const mcpHandler = createMcpHandler();
      return withHeaders(await mcpHandler.fetch(request, env, ctx));
    }

    if (isDurableIteratorRequest(url)) {
      return upgradeGitHubAgentEventsRequest(request, env);
    }

    if (isAgentRequest(url)) {
      const agentId = parseAgentId(url);
      if (!agentId) {
        return withHeaders(new Response('Bad Request', { status: 400 }));
      }

      const auth = createAuth(env);

      // Support CLI clients that authenticate via Bearer token.
      // Better Auth uses cookie-based sessions by default. When a
      // Bearer token is present (CLI), convert it to a session cookie
      // header so Better Auth can resolve the session normally.
      let authHeaders = request.headers;
      const bearerToken = request.headers
        .get('Authorization')
        ?.replace(/^Bearer\s+/i, '');
      if (bearerToken && !request.headers.get('cookie')) {
        authHeaders = new Headers(request.headers);
        authHeaders.set('cookie', `better-auth.session_token=${bearerToken}`);
      }

      const sessionData = await auth.api.getSession({
        headers: authHeaders,
      });

      if (!sessionData?.session || !sessionData?.user) {
        return withHeaders(new Response('Unauthorized', { status: 401 }));
      }

      if (sessionData.user.id !== agentId) {
        return withHeaders(new Response('Forbidden', { status: 403 }));
      }
    }

    try {
      const agentResponse = await routeAgentRequest(request, env);
      if (agentResponse) {
        return withHeaders(agentResponse);
      }
    } catch (err) {
      logger.error({ err }, 'routeAgentRequest failed');
      return withHeaders(new Response('Agent unavailable', { status: 503 }));
    }

    const appResponse = await (
      handler.fetch as (
        req: Request,
        env: Cloudflare.Env,
        ctx: ExecutionContext,
      ) => Promise<Response>
    )(request, env, ctx);
    return withHeaders(appResponse);
  },
  // // Handle Queue messages
  // async queue(batch, _env, _ctx) {
  //   for (const message of batch.messages) {
  //     console.log('Processing message:', message.body);
  //     message.ack();
  //   }
  // },

  // // Handle Cron Triggers
  // async scheduled(event, _env, _ctx) {
  //   console.log('Cron triggered:', event.cron);
  // },
};
