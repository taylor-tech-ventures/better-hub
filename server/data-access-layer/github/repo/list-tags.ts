import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type Tag = {
  name: string;
  commit: { sha: string; url: string };
  zipball_url: string;
  tarball_url: string;
};

/**
 * Lists tags for a repository.
 */
export async function listTags(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  per_page?: number;
}): Promise<GitHubResult<Tag[]>> {
  const { accessToken, owner, repo, per_page } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request('GET /repos/{owner}/{repo}/tags', {
      owner,
      repo,
      per_page: per_page ?? 30,
    });

    return ok(
      response.data.map((tag) => ({
        name: tag.name,
        commit: { sha: tag.commit.sha, url: tag.commit.url },
        zipball_url: tag.zipball_url,
        tarball_url: tag.tarball_url,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing tags for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing tags for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
