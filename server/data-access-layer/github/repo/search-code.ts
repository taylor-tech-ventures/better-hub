import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type CodeSearchResult = {
  total_count: number;
  items: Array<{
    name: string;
    path: string;
    sha: string;
    html_url: string;
    repository: { full_name: string };
  }>;
};

/**
 * Searches for code across GitHub repositories.
 */
export async function searchCode(params: {
  accessToken: string | undefined;
  query: string;
  org?: string;
  per_page?: number;
}): Promise<GitHubResult<CodeSearchResult>> {
  const { accessToken, query, org, per_page } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const q = org ? `${query} org:${org}` : query;
    const response = await octokit.request('GET /search/code', {
      q,
      per_page: per_page ?? 30,
    });

    return ok({
      total_count: response.data.total_count,
      items: response.data.items.map((item) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        html_url: item.html_url,
        repository: { full_name: item.repository.full_name },
      })),
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error searching code: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error searching code: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
