import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type ReleaseInfo = {
  id: number;
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  html_url: string;
  author_login: string;
};

/**
 * Creates a GitHub release for a repository.
 */
export async function createRelease(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  tag_name: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  target_commitish?: string;
}): Promise<GitHubResult<ReleaseInfo>> {
  const {
    accessToken,
    owner,
    repo,
    tag_name,
    name,
    body,
    draft,
    prerelease,
    target_commitish,
  } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/releases',
      {
        owner,
        repo,
        tag_name,
        name: name ?? tag_name,
        body,
        draft: draft ?? false,
        prerelease: prerelease ?? false,
        ...(target_commitish ? { target_commitish } : {}),
      },
    );

    return ok({
      id: data.id,
      tag_name: data.tag_name,
      name: data.name,
      draft: data.draft,
      prerelease: data.prerelease,
      created_at: data.created_at,
      published_at: data.published_at,
      html_url: data.html_url,
      author_login: data.author.login,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating release for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating release for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
