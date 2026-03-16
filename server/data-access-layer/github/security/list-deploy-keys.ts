import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type DeployKeyEntry = {
  id: number;
  title: string;
  key_preview: string;
  read_only: boolean;
  created_at: string;
};

/**
 * Lists deploy keys for a repository.
 */
export async function listDeployKeys(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
}): Promise<GitHubResult<DeployKeyEntry[]>> {
  const { accessToken, owner, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const keys = await octokit.paginate('GET /repos/{owner}/{repo}/keys', {
      owner,
      repo,
      per_page: 100,
    });

    return ok(
      keys.map((key) => ({
        id: key.id,
        title: key.title,
        key_preview: `${key.key.substring(0, 30)}...`,
        read_only: key.read_only ?? false,
        created_at: key.created_at ?? '',
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing deploy keys for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing deploy keys for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
