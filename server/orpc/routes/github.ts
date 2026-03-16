import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import {
  getGitHubOrgRepos,
  type PartialListOrgReposResponse,
} from '@/server/data-access-layer/github/org/get-org-repos';
import {
  type GetUserOrgsResponse,
  getGitHubUserOrgs,
} from '@/server/data-access-layer/github/org/get-user-orgs';
import {
  type GetUserOrgsWithAccessResponse,
  getGitHubUserOrgsWithAccess,
} from '@/server/data-access-layer/github/org/get-user-orgs-with-access';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import { authorized, base } from '@/server/orpc/middleware';

/** TTL for the per-org access probe cached in agent DO preferences. */
const ORG_ACCESS_CACHE_TTL_MS = 15 * 60 * 1_000;

/** TTL for the cached user-org list stored in agent DO preferences. */
const ORG_CACHE_TTL_MS = 15 * 60 * 1_000;

/** TTL for per-org repo list cached in DO preferences. */
const ORG_REPOS_CACHE_TTL_MS = 15 * 60 * 1_000;

export const github = {
  /**
   * Returns the authenticated user's GitHub organizations.
   * Results are cached in the GitHubAgent DO preferences for 15 minutes.
   * Pass `forceRefresh: true` to bypass the cache and fetch fresh data.
   */
  getOrgs: base
    .use(authorized)
    .input(z.object({ forceRefresh: z.boolean().optional() }))
    .handler(async ({ input, context }) => {
      const stub = await getGitHubAgentStub(
        context.env,
        context.session.userId,
      );
      const accessToken = await stub.getGitHubToken();

      if (!accessToken) {
        throw new ORPCError('UNAUTHORIZED', {
          message:
            'GitHub access token is unavailable. Please sign out and sign in again.',
        });
      }

      if (!input.forceRefresh) {
        const prefs = await stub.getPreferences();
        const cached = prefs.dash_orgs_cache;
        const cachedAtStr = prefs.dash_orgs_cached_at;

        if (cached && cachedAtStr) {
          const cachedAt = Number(cachedAtStr);
          if (Date.now() - cachedAt < ORG_CACHE_TTL_MS) {
            return {
              orgs: JSON.parse(cached) as GetUserOrgsResponse,
              cachedAt,
            };
          }
        }
      }

      const result = await getGitHubUserOrgs({ accessToken });

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error.message,
        });
      }

      const orgs = result.data;
      const now = Date.now();
      await Promise.all([
        stub.setPreference('dash_orgs_cache', JSON.stringify(orgs)),
        stub.setPreference('dash_orgs_cached_at', String(now)),
      ]);

      return { orgs, cachedAt: now };
    }),

  /**
   * Returns the repositories for a GitHub organization.
   * Results are cached in the GitHubAgent DO preferences for 15 minutes.
   * Pass `forceRefresh: true` to bypass the cache.
   */
  getOrgRepos: base
    .use(authorized)
    .input(
      z.object({
        org: z.string().min(1),
        forceRefresh: z.boolean().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const stub = await getGitHubAgentStub(
        context.env,
        context.session.userId,
      );
      const accessToken = await stub.getGitHubToken();

      if (!accessToken) {
        throw new ORPCError('UNAUTHORIZED', {
          message:
            'GitHub access token is unavailable. Please sign out and sign in again.',
        });
      }

      const cacheKey = `dash_org_repos_${input.org}`;
      const cacheAtKey = `dash_org_repos_${input.org}_at`;

      if (!input.forceRefresh) {
        const [cached, cachedAtStr] = await Promise.all([
          stub.getPreference(cacheKey),
          stub.getPreference(cacheAtKey),
        ]);

        if (cached && cachedAtStr) {
          const cachedAt = Number(cachedAtStr);
          if (Date.now() - cachedAt < ORG_REPOS_CACHE_TTL_MS) {
            return JSON.parse(cached) as PartialListOrgReposResponse;
          }
        }
      }

      const result = await getGitHubOrgRepos({ org: input.org, accessToken });

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error.message,
        });
      }

      await Promise.all([
        stub.setPreference(cacheKey, JSON.stringify(result.data)),
        stub.setPreference(cacheAtKey, String(Date.now())),
      ]);

      return result.data;
    }),

  /**
   * Returns the authenticated user's GitHub organizations annotated with
   * whether the OAuth App has been approved for each org.
   *
   * Results are cached in the GitHubAgent DO preferences for 15 minutes.
   * Pass `forceRefresh: true` to bypass the cache.
   */
  getOrgsWithAccess: base
    .use(authorized)
    .input(z.object({ forceRefresh: z.boolean().optional() }))
    .handler(async ({ input, context }) => {
      const stub = await getGitHubAgentStub(
        context.env,
        context.session.userId,
      );
      const accessToken = await stub.getGitHubToken();

      if (!accessToken) {
        throw new ORPCError('UNAUTHORIZED', {
          message:
            'GitHub access token is unavailable. Please sign out and sign in again.',
        });
      }

      if (!input.forceRefresh) {
        const prefs = await stub.getPreferences();
        const cached = prefs.dash_orgs_access_cache;
        const cachedAtStr = prefs.dash_orgs_access_cached_at;

        if (cached && cachedAtStr) {
          const cachedAt = Number(cachedAtStr);
          if (Date.now() - cachedAt < ORG_ACCESS_CACHE_TTL_MS) {
            return {
              orgs: JSON.parse(cached) as GetUserOrgsWithAccessResponse,
              cachedAt,
            };
          }
        }
      }

      const result = await getGitHubUserOrgsWithAccess({ accessToken });

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error.message,
        });
      }

      const now = Date.now();
      await Promise.all([
        stub.setPreference(
          'dash_orgs_access_cache',
          JSON.stringify(result.data),
        ),
        stub.setPreference('dash_orgs_access_cached_at', String(now)),
      ]);

      return { orgs: result.data, cachedAt: now };
    }),
};
