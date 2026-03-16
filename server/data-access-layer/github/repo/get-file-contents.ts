import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type FileContents = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  content: string | null;
  encoding: string | null;
  html_url: string;
};

/**
 * Retrieves the contents of a file in a repository.
 * If the content is base64-encoded, it is decoded to UTF-8 before returning.
 */
export async function getFileContents(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}): Promise<GitHubResult<FileContents>> {
  const { accessToken, owner, repo, path, ref } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/contents/{path}',
      {
        owner,
        repo,
        path,
        ref,
      },
    );

    const data = response.data;

    // The endpoint can return an array for directories; we only handle files
    if (Array.isArray(data)) {
      return fail(
        GitHubErrorCode.VALIDATION_FAILED,
        `The path ${path} is a directory, not a file.`,
      );
    }

    let decodedContent: string | null = null;
    if (
      'content' in data &&
      data.content &&
      'encoding' in data &&
      data.encoding === 'base64'
    ) {
      decodedContent = atob(data.content.replace(/\n/g, ''));
    } else if ('content' in data && data.content) {
      decodedContent = data.content as string;
    }

    return ok({
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      type: data.type,
      content: decodedContent,
      encoding: 'encoding' in data ? (data.encoding as string | null) : null,
      html_url: data.html_url ?? '',
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error getting file contents for ${owner}/${repo}/${path}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error getting file contents for ${owner}/${repo}/${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
