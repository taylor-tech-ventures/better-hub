import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type SecretEntry = {
  name: string;
  created_at: string;
  updated_at: string;
};

/**
 * Lists repository Actions secret names (not values).
 */
export async function listRepoSecrets(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
}): Promise<GitHubResult<SecretEntry[]>> {
  const { accessToken, owner, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/secrets',
      { owner, repo, per_page: 100 },
    );

    return ok(
      response.data.secrets.map((secret) => ({
        name: secret.name,
        created_at: secret.created_at,
        updated_at: secret.updated_at,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing secrets for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing secrets for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
