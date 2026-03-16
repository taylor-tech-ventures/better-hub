import { createLogger } from '@/shared/logger';

const tokenLogger = createLogger({ module: 'refreshGitHubToken' });

export type GitHubRefreshTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  refresh_token_expires_at?: number;
  scope?: string;
  token_type?: string;
  expires_at?: number;
};

/**
 * Typed error thrown when GitHub's token endpoint returns an OAuth error.
 * GitHub always responds with HTTP 200 on the token endpoint, embedding the
 * error in the response body — this class makes those failures catchable.
 */
export class GitHubOAuthError extends Error {
  readonly code: string;
  constructor(code: string, description?: string) {
    super(description ?? code);
    this.name = 'GitHubOAuthError';
    this.code = code;
  }
}

export type RefreshGitHubTokenOptions = {
  /** GitHub OAuth App client ID */
  clientId: string;
  /** GitHub OAuth App client secret */
  clientSecret: string;
};

export default async function refreshGitHubToken(
  refresh_token: string,
  options?: RefreshGitHubTokenOptions,
): Promise<GitHubRefreshTokenResponse> {
  const clientId = options?.clientId ?? process.env.GITHUB_CLIENT_ID ?? '';
  const clientSecret =
    options?.clientSecret ?? process.env.GITHUB_CLIENT_SECRET ?? '';

  // GitHub's OAuth token endpoint for refreshing tokens
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'gh-admin-app',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    }),
  });

  const tokensOrError = (await response.json()) as Record<string, unknown>;

  // GitHub's token endpoint always returns HTTP 200; OAuth errors are signalled
  // via an `error` field in the JSON body.
  if (!response.ok || typeof tokensOrError.error === 'string') {
    throw new GitHubOAuthError(
      (tokensOrError.error as string) ?? 'unknown_error',
      tokensOrError.error_description as string | undefined,
    );
  }

  const tokens = tokensOrError as unknown as Omit<
    GitHubRefreshTokenResponse,
    'expires_at'
  >;

  // Calculate expires_at based on when GitHub issued the refreshed token
  // Date.now() represents when we received the token from GitHub (closest to issuance time)
  const now = Date.now();
  const expiresAt = now + Math.floor((tokens.expires_in ?? 28800) * 1000);
  const refreshTokenExpiresAt =
    now + Math.floor((tokens.refresh_token_expires_in ?? 28800) * 1000);

  tokenLogger.info(
    {
      issuedAt: new Date(now).toISOString(),
      expiresIn: tokens.expires_in ?? 28800,
      expiresAt: new Date(expiresAt).toISOString(),
    },
    'new token issued',
  );

  return {
    ...tokens,
    expires_at: expiresAt,
    refresh_token_expires_at: refreshTokenExpiresAt,
  };
}
