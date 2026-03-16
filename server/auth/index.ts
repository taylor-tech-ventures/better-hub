import dotenv from 'dotenv';

dotenv.config({ path: `${process.cwd()}/.dev.vars` });

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { stripe } from '@better-auth/stripe';
import type {
  D1Database,
  IncomingRequestCfProperties,
} from '@cloudflare/workers-types';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { admin, openAPI } from 'better-auth/plugins';
import { withCloudflare } from 'better-auth-cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import Stripe from 'stripe';
import { createGithubOAuth } from '@/server/auth/github-oauth';
import { createStripeSettings } from '@/server/auth/stripe-settings';
import { schema } from '@/server/db/schemas';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import { decryptToken, encryptToken } from '@/server/lib/crypto';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'auth' });

/**
 * Default access-token lifetime in milliseconds used when the `accounts` table
 * does not record an expiry.  Matches GitHub's documented default of 8 hours.
 */
const DEFAULT_ACCESS_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1_000;

// Single auth configuration that handles both CLI and runtime scenarios
function createAuth(env?: Cloudflare.Env, cf?: IncomingRequestCfProperties) {
  const stripeKey = env?.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  const stripeClient = stripeKey
    ? new Stripe(stripeKey, {
        apiVersion: '2026-02-25.clover',
        // https://opennext.js.org/cloudflare/howtos/stripeAPI
        httpClient: Stripe.createFetchHttpClient(),
      })
    : null;

  // Use actual DB for runtime, empty object for CLI
  const db = env?.GH_ADMIN_D1_PRIMARY
    ? drizzle(env.GH_ADMIN_D1_PRIMARY, {
        schema,
        logger: false,
      })
    : ({} as any);

  return betterAuth({
    baseURL: env?.AUTH_URL ?? 'http://localhost:8787/api/auth',
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        // Push fresh GitHub OAuth tokens into the GitHubAgent Durable Object
        // whenever a new session is created (i.e. on sign-in or token refresh).
        if (ctx.context.newSession !== null) {
          const session = ctx.context.newSession;
          const userId = session.user.id;

          const log = logger.child({ userId });
          log.info('user signed in, pushing tokens to GitHubAgent');

          try {
            if (env?.GitHubAgent && env?.GH_ADMIN_D1_PRIMARY) {
              // Query the accounts table for the user's GitHub OAuth tokens.
              const row = await env.GH_ADMIN_D1_PRIMARY.prepare(
                `SELECT access_token, access_token_expires_at, refresh_token, refresh_token_expires_at
                 FROM accounts
                 WHERE user_id = ? AND provider_id = 'github-app'
                 LIMIT 1`,
              )
                .bind(userId)
                .first<{
                  access_token: string | null;
                  access_token_expires_at: number | null;
                  refresh_token: string | null;
                  refresh_token_expires_at: number | null;
                }>();

              if (row?.access_token) {
                const authSecret = env.AUTH_SECRET;
                const accessToken = await decryptToken(
                  row.access_token,
                  authSecret,
                );
                const refreshToken = row.refresh_token
                  ? await decryptToken(row.refresh_token, authSecret)
                  : undefined;

                // Encrypt tokens at rest if they were stored in plaintext
                if (
                  !row.access_token.startsWith('enc:') ||
                  (row.refresh_token && !row.refresh_token.startsWith('enc:'))
                ) {
                  const encAccess = await encryptToken(accessToken, authSecret);
                  const encRefresh = refreshToken
                    ? await encryptToken(refreshToken, authSecret)
                    : null;
                  await env.GH_ADMIN_D1_PRIMARY.prepare(
                    `UPDATE accounts SET access_token = ?, refresh_token = ?
                     WHERE user_id = ? AND provider_id = 'github-app'`,
                  )
                    .bind(encAccess, encRefresh, userId)
                    .run();
                }

                const stub = await getGitHubAgentStub(env, userId);

                await stub.setTokens({
                  accessToken,
                  accessTokenExpiresAt:
                    row.access_token_expires_at != null
                      ? row.access_token_expires_at * 1_000
                      : Date.now() + DEFAULT_ACCESS_TOKEN_EXPIRY_MS,
                  refreshToken,
                  refreshTokenExpiresAt:
                    row.refresh_token_expires_at != null
                      ? row.refresh_token_expires_at * 1_000
                      : undefined,
                });

                log.info('tokens pushed to GitHubAgent');

                // Push subscription tier to DO so limit checks use fresh data.
                const subRow = await env.GH_ADMIN_D1_PRIMARY.prepare(
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
                log.info({ tier }, 'subscription tier pushed to GitHubAgent');

                // Push admin status — admins bypass all usage limits.
                const isAdmin = session.user.role === 'admin';
                await stub.setAdminStatus(isAdmin);
                log.info({ isAdmin }, 'admin status pushed to GitHubAgent');

                // Reset the 28-day inactivity cleanup timer on every login.
                // Free-tier non-admin users who don't log in for 28 days
                // will have their DO data destroyed automatically.
                await stub.scheduleInactivityCleanup();
                log.info('inactivity cleanup timer reset');

                // Fire-and-forget background entity sync for paid and admin
                // users.  Failure must not block sign-in.
                stub.backgroundEntitySync().catch((err) => {
                  log.error({ err }, 'backgroundEntitySync error');
                });
              } else {
                log.warn('no GitHub access token found in D1');
              }
            }
          } catch (error) {
            log.error({ err: error }, 'error pushing tokens to GitHubAgent');
          }
        }
      }),
    },
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf ?? {},
        d1: env?.GH_ADMIN_D1_PRIMARY
          ? {
              db,
              options: {
                usePlural: true,
                debugLogs: false,
              },
            }
          : undefined,
        kv: env?.OAUTH_KV as any,
      },
      {
        emailAndPassword: {
          enabled: false,
        },
        plugins: [
          openAPI(),
          createGithubOAuth(
            env?.GITHUB_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID ?? '',
            env?.GITHUB_CLIENT_SECRET ?? process.env.GITHUB_CLIENT_SECRET ?? '',
          ),
          admin(),
          ...(stripeClient
            ? [
                stripe({
                  stripeClient,
                  stripeWebhookSecret:
                    env?.STRIPE_WEBHOOK_SECRET ??
                    process.env.STRIPE_WEBHOOK_SECRET ??
                    '',
                  ...createStripeSettings(env),
                }),
              ]
            : []),
        ],
        session: {
          expiresIn: 60 * 60 * 8, // 8 hours
          updateAge: 60 * 60 * 1, // 1 hour
          cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
          },
        },
        updateAccountOnSignIn: true,
        rateLimit: {
          enabled: true,
        },
        user: {
          additionalFields: {
            login: {
              type: 'string',
              description: "The user's GitHub login",
              required: true,
              input: false,
            },
          },
          deleteUser: {
            enabled: true,
            beforeDelete: async (user) => {
              logger.info(
                { userId: user.id },
                'checking subscription status before deletion',
              );
              try {
                // Check subscription status before allowing deletion
                if (env?.GH_ADMIN_D1_PRIMARY) {
                  // Check if user has active subscriptions using referenceId (user ID)
                  const subscriptionsQuery =
                    await env.GH_ADMIN_D1_PRIMARY.prepare(
                      "SELECT * FROM subscriptions WHERE reference_id = ? AND (status = 'active' OR status = 'trialing')",
                    )
                      .bind(user.id)
                      .all();

                  const activeSubscription = subscriptionsQuery.results?.[0];
                  if (
                    activeSubscription &&
                    (activeSubscription as any).plan !== 'free'
                  ) {
                    throw new APIError('BAD_REQUEST', {
                      message:
                        'You must cancel your subscription before deleting your account',
                    });
                  }
                }
              } catch (error) {
                logger.error(
                  { userId: user.id, err: error },
                  'error checking subscription before deletion',
                );
                throw error; // Re-throw to prevent deletion
              }
            },
            afterDelete: async (user) => {
              logger.info(
                { userId: user.id },
                'cleaning up Durable Object after deletion',
              );
              try {
                if (env?.GitHubAgent) {
                  const stub = await getGitHubAgentStub(env, user.id);
                  await stub.deleteAllData();
                  logger.info(
                    { userId: user.id },
                    'GitHubAgent data cleaned up successfully',
                  );
                } else {
                  logger.warn(
                    'GitHubAgent environment not available for cleanup',
                  );
                }
              } catch (error) {
                logger.error(
                  { userId: user.id, err: error },
                  'error cleaning up GitHubAgent data',
                );
              }
            },
          },
        },
        telemetry: { enabled: false },
      },
    ),
    // Only add database adapter for CLI schema generation
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: 'sqlite',
            usePlural: true,
            debugLogs: false,
          }),
        }),
  });
}

// Export for CLI schema generation
export const auth = createAuth();

// Export for runtime usage
export { createAuth };
