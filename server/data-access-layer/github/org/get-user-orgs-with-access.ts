import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import { getGitHubUserOrgs } from '@/server/data-access-layer/github/org/get-user-orgs';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  ok,
} from '@/server/data-access-layer/github/types';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'get-user-orgs-with-access' });

export type OrgWithAccess = {
  id: number;
  login: string;
  avatar_url: string;
  /** `true` when the GitHub OAuth App has been approved for this org. */
  authorized: boolean;
};

export type GetUserOrgsWithAccessResponse = OrgWithAccess[];

/**
 * Fetches all GitHub organizations the authenticated user belongs to and
 * probes each one with `GET /orgs/{org}` to determine whether the OAuth App
 * has been approved for that organization.
 *
 * An org is considered **authorized** when the probe returns a 200 response.
 * A 403 ("Resource not accessible by integration") indicates the org owner
 * has restricted third-party OAuth App access and not yet approved this app.
 *
 * Probes run in parallel to minimize latency.
 *
 * @param parameters - An object containing the GitHub OAuth access token.
 * @returns A GitHubResult wrapping the list of orgs annotated with `authorized`.
 */
export async function getGitHubUserOrgsWithAccess({
  accessToken,
}: {
  accessToken: string | undefined;
}): Promise<GitHubResult<GetUserOrgsWithAccessResponse>> {
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  const result = await getGitHubUserOrgs({ accessToken });

  if (!result.success) {
    return result;
  }

  const orgs = result.data;

  const octokit = getOctokit(accessToken);

  const results = await Promise.all(
    orgs.map(async (org) => {
      let authorized = false;
      try {
        await octokit.request('GET /orgs/{org}', { org: org.login });
        authorized = true;
      } catch (err) {
        // 403 = OAuth App not approved for this org; any other status also
        // means we cannot access the org, so treat it as unauthorized.
        if (
          err instanceof OctokitError &&
          err.status !== 403 &&
          err.status !== 404
        ) {
          // Unexpected error — log but treat as unauthorized rather than throw,
          // so one failing org doesn't break the entire list.
          logger.warn(
            { org: org.login, status: err.status },
            'unexpected status probing org access',
          );
        }
        authorized = false;
      }

      return {
        id: org.id,
        login: org.login,
        avatar_url: org.avatar_url,
        authorized,
      };
    }),
  );

  return ok(results);
}
