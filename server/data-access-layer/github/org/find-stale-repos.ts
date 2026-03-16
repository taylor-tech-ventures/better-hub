import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type StaleRepoEntry = {
  name: string;
  full_name: string;
  html_url: string;
  last_push_at: string | null;
  private: boolean;
  description: string | null;
};

/**
 * Finds repositories in an organization that have no recent push activity.
 */
export async function findStaleRepos(params: {
  accessToken: string | undefined;
  org: string;
  days_inactive: number;
}): Promise<GitHubResult<StaleRepoEntry[]>> {
  const { accessToken, org, days_inactive } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const repos = await octokit.paginate('GET /orgs/{org}/repos', {
      org,
      type: 'all',
      per_page: 100,
    });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days_inactive);
    const cutoffTime = cutoff.getTime();

    const stale = repos.filter((repo) => {
      const pushDate = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
      return pushDate < cutoffTime;
    });

    return ok(
      stale.map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        last_push_at: repo.pushed_at ?? null,
        private: repo.private,
        description: repo.description ?? null,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error finding stale repos for ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error finding stale repos for ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
