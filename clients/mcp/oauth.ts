import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { createAuth } from '@/server/auth/index';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'mcp-oauth' });

/**
 * Handles the `/mcp/authorize` endpoint.
 *
 * The MCP OAuth flow:
 * 1. MCP client sends user to `/mcp/authorize` with OAuth params
 * 2. We parse the OAuth request and store it, then redirect to GitHub OAuth
 * 3. After GitHub OAuth callback, we complete the MCP authorization
 *
 * For simplicity, we redirect to our existing Better Auth GitHub OAuth flow.
 * The callback URL includes the MCP OAuth state so we can complete the flow.
 */
export async function handleMcpAuthorize(
  request: Request,
  env: Cloudflare.Env,
  oauthHelpers: OAuthHelpers,
): Promise<Response> {
  const url = new URL(request.url);

  // Parse the incoming MCP OAuth authorization request
  const authRequest = await oauthHelpers.parseAuthRequest(request);
  if (!authRequest) {
    return new Response('Invalid authorization request', { status: 400 });
  }

  // Check if the user is already authenticated via Better Auth session
  const auth = createAuth(env);
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (sessionData?.session && sessionData?.user) {
    // User is already logged in — complete the MCP authorization immediately
    logger.info(
      { userId: sessionData.user.id },
      'completing MCP authorization for authenticated user',
    );

    const { redirectTo } = await oauthHelpers.completeAuthorization({
      request: authRequest,
      userId: sessionData.user.id,
      metadata: {
        label: `MCP session for ${sessionData.user.name ?? sessionData.user.email}`,
      },
      scope: authRequest.scope,
      props: {
        userId: sessionData.user.id,
        githubToken: '', // Will be populated from DO on token exchange
        subscriptionTier: 'free', // Will be resolved on token exchange
        monthlyLimit: 50,
      },
    });

    return Response.redirect(redirectTo, 302);
  }

  // User is not authenticated — redirect to GitHub OAuth via Better Auth
  // Store the MCP auth request state in a cookie so we can resume after login
  const mcpState = btoa(
    JSON.stringify({
      authRequest,
      returnTo: url.toString(),
    }),
  );

  const loginUrl = new URL('/api/auth/signin/github', url.origin);
  loginUrl.searchParams.set(
    'callbackURL',
    `/mcp/callback?mcp_state=${encodeURIComponent(mcpState)}`,
  );

  return Response.redirect(loginUrl.toString(), 302);
}

/**
 * Handles the `/mcp/callback` endpoint after GitHub OAuth completes.
 * Resumes the MCP authorization flow.
 */
export async function handleMcpCallback(
  request: Request,
  env: Cloudflare.Env,
  oauthHelpers: OAuthHelpers,
): Promise<Response> {
  const url = new URL(request.url);
  const mcpStateParam = url.searchParams.get('mcp_state');

  if (!mcpStateParam) {
    return new Response('Missing MCP state', { status: 400 });
  }

  // Verify the user is now authenticated
  const auth = createAuth(env);
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (!sessionData?.session || !sessionData?.user) {
    return new Response('Authentication failed', { status: 401 });
  }

  // Parse the stored MCP authorization request
  const { authRequest } = JSON.parse(atob(mcpStateParam));

  logger.info(
    { userId: sessionData.user.id },
    'completing MCP authorization after GitHub login',
  );

  const { redirectTo } = await oauthHelpers.completeAuthorization({
    request: authRequest,
    userId: sessionData.user.id,
    metadata: {
      label: `MCP session for ${sessionData.user.name ?? sessionData.user.email}`,
    },
    scope: authRequest.scope,
    props: {
      userId: sessionData.user.id,
      githubToken: '', // Populated on token exchange from DO
      subscriptionTier: 'free',
      monthlyLimit: 50,
    },
  });

  return Response.redirect(redirectTo, 302);
}
