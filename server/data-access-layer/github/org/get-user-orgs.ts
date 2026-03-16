import { RequestError as OctokitError } from '@octokit/request-error';
import type { Endpoints as GitHubApiEndpoints } from '@octokit/types';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type GetUserOrgsResponse =
  GitHubApiEndpoints['GET /user/orgs']['response']['data'];

/**
 * Fetches all organizations the authenticated GitHub user belongs to.
 * @param parameters - An object containing the GitHub OAuth access token.
 * @returns A GitHubResult wrapping the list of user organizations.
 */
export async function getGitHubUserOrgs({
  accessToken,
}: {
  accessToken: string | undefined;
}): Promise<GitHubResult<GetUserOrgsResponse>> {
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }
  try {
    const octokit = getOctokit(accessToken);
    const orgs = await octokit.paginate('GET /user/orgs');
    return ok(orgs as GetUserOrgsResponse);
  } catch (error) {
    if (error instanceof OctokitError) {
      const code = mapStatusToErrorCode(error.status);
      const resetAt =
        error.status === 429
          ? parseRateLimitReset(
              error.response?.headers?.['x-ratelimit-reset'] as
                | string
                | undefined,
            )
          : undefined;
      return fail(
        code,
        `Error listing organizations: ${error.message}`,
        resetAt !== undefined ? { resetAt } : undefined,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing organizations: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Parses the x-ratelimit-reset header (Unix seconds) into milliseconds. */
function parseRateLimitReset(header: string | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}
