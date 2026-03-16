import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type CreateReleaseParams = {
  org: string;
  repo: string;
  tagName: string;
  targetCommitish: string;
  releaseName?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  generateReleaseNotes?: boolean;
  accessToken: string | undefined;
};

export type ReleaseResult = {
  id: number;
  tagName: string;
  name: string | null;
  htmlUrl: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string | null;
};

export type RepoTag = {
  name: string;
  commitSha: string;
};

export type ListRepoTagsParams = {
  org: string;
  repo: string;
  accessToken: string | undefined;
};

/**
 * Creates a GitHub release for a repository.
 * @returns A GitHubResult wrapping the created release.
 */
export async function createGitHubRelease(
  params: CreateReleaseParams,
): Promise<GitHubResult<ReleaseResult>> {
  const { accessToken, org, repo, tagName, targetCommitish, ...rest } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is unavailable. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    const response = await octokit.request(
      'POST /repos/{owner}/{repo}/releases',
      {
        owner: org,
        repo,
        tag_name: tagName,
        target_commitish: targetCommitish,
        name: rest.releaseName ?? tagName,
        body: rest.body,
        draft: rest.draft ?? false,
        prerelease: rest.prerelease ?? false,
        generate_release_notes: rest.generateReleaseNotes ?? false,
      },
    );

    return ok({
      id: response.data.id,
      tagName: response.data.tag_name,
      name: response.data.name,
      htmlUrl: response.data.html_url,
      draft: response.data.draft,
      prerelease: response.data.prerelease,
      createdAt: response.data.created_at,
      publishedAt: response.data.published_at,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating release for ${org}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating release for ${org}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Lists all git tags for a repository, following pagination.
 * @returns A GitHubResult wrapping the list of tags.
 */
export async function listRepoTags(
  params: ListRepoTagsParams,
): Promise<GitHubResult<RepoTag[]>> {
  const { accessToken, org, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is unavailable. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    const tags = await octokit.paginate('GET /repos/{owner}/{repo}/tags', {
      owner: org,
      repo,
      per_page: 100,
    });

    return ok(
      tags.map((tag) => ({
        name: tag.name,
        commitSha: tag.commit.sha,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing tags for ${org}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing tags for ${org}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
