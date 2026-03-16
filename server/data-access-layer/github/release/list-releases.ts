import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type Release = {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  html_url: string;
  author: { login: string };
};

/**
 * Lists releases for a repository.
 */
export async function listReleases(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  per_page?: number;
}): Promise<GitHubResult<Release[]>> {
  const { accessToken, owner, repo, per_page } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/releases',
      {
        owner,
        repo,
        per_page: per_page ?? 30,
      },
    );

    return ok(
      response.data.map((release) => ({
        id: release.id,
        tag_name: release.tag_name,
        name: release.name,
        draft: release.draft,
        prerelease: release.prerelease,
        created_at: release.created_at,
        published_at: release.published_at,
        html_url: release.html_url,
        author: { login: release.author.login },
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing releases for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing releases for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
