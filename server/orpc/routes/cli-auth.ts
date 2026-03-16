import { z } from 'zod';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import { encryptToken } from '@/server/lib/crypto';
import { base } from '@/server/orpc/middleware';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'cli-auth' });

/**
 * CLI authentication routes using GitHub OAuth Device Flow.
 *
 * The device flow is the standard approach for CLI apps that cannot handle
 * redirect-based OAuth. The user receives a code, visits a URL, enters the
 * code, and the CLI polls until authorization is complete.
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */
export const cliAuth = {
  /**
   * Initiate the GitHub OAuth device flow.
   * Returns a user code and verification URI for the user to authorize.
   */
  initDeviceFlow: base.input(z.object({})).handler(async ({ context }) => {
    const clientId = context.env.GITHUB_CLIENT_ID;

    logger.info('initiating device flow');

    const resp = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'read:org repo admin:org',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      logger.error(
        { status: resp.status, body: text },
        'device flow initiation failed',
      );
      throw new Error(`GitHub device flow initiation failed: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
    };
  }),

  /**
   * Poll the GitHub device flow for completion.
   * Returns the session token once the user has authorized.
   */
  pollDeviceFlow: base
    .input(z.object({ deviceCode: z.string() }))
    .handler(async ({ input, context }) => {
      const { env } = context;
      const clientId = env.GITHUB_CLIENT_ID;
      const clientSecret = env.GITHUB_CLIENT_SECRET;

      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          device_code: input.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      if (!resp.ok) {
        throw new Error(`GitHub token exchange failed: ${resp.status}`);
      }

      const data = (await resp.json()) as {
        access_token?: string;
        token_type?: string;
        scope?: string;
        error?: string;
        error_description?: string;
        interval?: number;
      };

      // GitHub returns 200 with error field when still pending
      if (data.error) {
        if (
          data.error === 'authorization_pending' ||
          data.error === 'slow_down'
        ) {
          // Client should keep polling
          return { error: data.error, interval: data.interval };
        }

        throw new Error(data.error_description ?? data.error);
      }

      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      const accessToken = data.access_token;

      // Fetch user info from GitHub
      const userResp = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'gh-admin-cli',
        },
      });

      if (!userResp.ok) {
        throw new Error(`Failed to fetch GitHub user: ${userResp.status}`);
      }

      const ghUser = (await userResp.json()) as {
        id: number;
        login: string;
        name: string;
        email: string;
        avatar_url: string;
      };

      logger.info({ login: ghUser.login }, 'device flow authorized');

      // Create or find user + session in D1 via Better Auth compatible approach.
      // We create the session directly in D1 to match Better Auth's schema.
      const db = env.GH_ADMIN_D1_PRIMARY;
      const authSecret = env.AUTH_SECRET;

      // Generate a session token
      const sessionToken = crypto.randomUUID();
      const sessionExpiresAt = new Date(
        Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      );

      // Upsert user
      const existingUser = await db
        .prepare('SELECT id FROM users WHERE id = ?')
        .bind(String(ghUser.id))
        .first<{ id: string }>();

      const userId = existingUser?.id ?? String(ghUser.id);

      if (!existingUser) {
        await db
          .prepare(
            `INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at, login, role)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 'user')`,
          )
          .bind(
            userId,
            ghUser.name ?? ghUser.login,
            ghUser.email ?? `${ghUser.login}@users.noreply.github.com`,
            1,
            ghUser.avatar_url,
            ghUser.login,
          )
          .run();
      }

      // Upsert account with encrypted tokens
      const encryptedAccessToken = await encryptToken(accessToken, authSecret);

      const existingAccount = await db
        .prepare(
          `SELECT id FROM accounts WHERE user_id = ? AND provider_id = 'github-app'`,
        )
        .bind(userId)
        .first<{ id: string }>();

      if (existingAccount) {
        await db
          .prepare(
            `UPDATE accounts SET access_token = ?, access_token_expires_at = ?, updated_at = datetime('now')
             WHERE user_id = ? AND provider_id = 'github-app'`,
          )
          .bind(
            encryptedAccessToken,
            Math.floor(sessionExpiresAt.getTime() / 1000),
            userId,
          )
          .run();
      } else {
        const accountId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO accounts (id, user_id, account_id, provider_id, access_token, access_token_expires_at, created_at, updated_at)
             VALUES (?, ?, ?, 'github-app', ?, ?, datetime('now'), datetime('now'))`,
          )
          .bind(
            accountId,
            userId,
            String(ghUser.id),
            encryptedAccessToken,
            Math.floor(sessionExpiresAt.getTime() / 1000),
          )
          .run();
      }

      // Create session
      const sessionId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), '', 'gh-admin-cli')`,
        )
        .bind(sessionId, sessionToken, userId, sessionExpiresAt.toISOString())
        .run();

      // Push tokens to GitHubAgent DO
      try {
        const stub = await getGitHubAgentStub(env, userId);
        await stub.setTokens({
          accessToken,
          accessTokenExpiresAt: sessionExpiresAt.getTime(),
        });

        // Push subscription tier
        const subRow = await db
          .prepare(
            `SELECT plan FROM subscriptions
             WHERE reference_id = ? AND (status = 'active' OR status = 'trialing')
             ORDER BY period_end DESC LIMIT 1`,
          )
          .bind(userId)
          .first<{ plan: string | null }>();

        const tier =
          subRow?.plan === 'standard' || subRow?.plan === 'unlimited'
            ? subRow.plan
            : 'free';
        await stub.setSubscriptionTier(tier);

        // Schedule inactivity cleanup
        await stub.scheduleInactivityCleanup();

        // Fire-and-forget background entity sync
        stub.backgroundEntitySync().catch((err) => {
          logger.error({ err }, 'backgroundEntitySync error');
        });

        logger.info({ userId }, 'tokens pushed to GitHubAgent from CLI auth');
      } catch (err) {
        logger.error({ err, userId }, 'failed to push tokens to GitHubAgent');
      }

      return {
        token: sessionToken,
        expiresAt: sessionExpiresAt.getTime(),
        userId,
        username: ghUser.login,
      };
    }),

  /**
   * Refresh/validate an existing session token.
   */
  refreshSession: base
    .input(z.object({ token: z.string() }))
    .handler(async ({ input, context }) => {
      const db = context.env.GH_ADMIN_D1_PRIMARY;

      const session = await db
        .prepare(
          `SELECT s.id, s.user_id, s.expires_at, u.login
           FROM sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.token = ?`,
        )
        .bind(input.token)
        .first<{
          id: string;
          user_id: string;
          expires_at: string;
          login: string;
        }>();

      if (!session) {
        throw new Error('Invalid session token');
      }

      const expiresAt = new Date(session.expires_at).getTime();
      if (Date.now() > expiresAt) {
        throw new Error('Session expired');
      }

      return {
        token: input.token,
        expiresAt,
        userId: session.user_id,
        username: session.login,
      };
    }),
};
