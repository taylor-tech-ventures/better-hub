import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { GitHubMcpAgent } from './agent';
import { handleMcpCallback } from './oauth';

/**
 * Creates the MCP route handler that serves `/mcp/*` requests.
 *
 * Uses `@cloudflare/workers-oauth-provider` to provide:
 * - `/mcp/.well-known/oauth-authorization-server` — OAuth metadata discovery
 * - `/mcp/authorize` — OAuth authorization endpoint (redirects to GitHub OAuth)
 * - `/mcp/token` — Token endpoint (issues MCP access tokens)
 * - `/mcp/register` — Dynamic client registration (RFC 7591)
 * - `/mcp` — Streamable HTTP MCP endpoint (authenticated, routed to GitHubMcpAgent)
 *
 * The OAuthProvider wraps the McpAgent.serve() handler as the API handler,
 * ensuring all MCP tool calls have a valid access token.
 */
export function createMcpHandler() {
  return new OAuthProvider({
    apiRoute: '/mcp',
    apiHandler: GitHubMcpAgent.serve('/mcp', {
      binding: 'GitHubMcpAgent',
      corsOptions: {
        allowOrigin: '*',
        allowMethods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
        exposeHeaders: ['mcp-session-id'],
      },
    }),
    defaultHandler: {
      async fetch(request: Request, env: Cloudflare.Env) {
        const url = new URL(request.url);

        // Handle MCP callback after GitHub OAuth
        if (url.pathname === '/mcp/callback') {
          const { getOAuthApi } = await import(
            '@cloudflare/workers-oauth-provider'
          );
          const oauthHelpers = getOAuthApi(mcpOAuthOptions, env);
          return handleMcpCallback(request, env, oauthHelpers);
        }

        return new Response('Not Found', { status: 404 });
      },
    },
    authorizeEndpoint: '/mcp/authorize',
    tokenEndpoint: '/mcp/token',
    clientRegistrationEndpoint: '/mcp/register',
    accessTokenTTL: 3600 * 8, // 8 hours, matching Better Auth session
    scopesSupported: ['github-admin'],
  });
}

// Store options for reuse in callback handler
const mcpOAuthOptions = {
  apiRoute: '/mcp',
  apiHandler: GitHubMcpAgent.serve('/mcp', {
    binding: 'GitHubMcpAgent',
  }),
  defaultHandler: { fetch: async () => new Response('', { status: 404 }) },
  authorizeEndpoint: '/mcp/authorize',
  tokenEndpoint: '/mcp/token',
  clientRegistrationEndpoint: '/mcp/register',
  accessTokenTTL: 3600 * 8,
};
