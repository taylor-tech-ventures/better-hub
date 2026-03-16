import { RequestError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import fetchGitHubUserEmail from '@/server/data-access-layer/github/fetch-github-user-email';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type GitHubUserInfo = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
};

/**
 * Fetches the authenticated GitHub user's profile information.
 * If the user's email is not publicly set, attempts to fetch it from the `/user/emails` endpoint.
 * @param parameters - An object containing the GitHub OAuth access token.
 * @returns A GitHubResult wrapping the user's id, login, name, and email.
 */
export async function getGitHubUserInfo({
  accessToken,
}: {
  accessToken: string | undefined;
}): Promise<GitHubResult<GitHubUserInfo>> {
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }
  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request('GET /user');
    if (response.data.email === null) {
      response.data.email = await fetchGitHubUserEmail(accessToken);
    }
    return ok({
      id: response.data.id,
      login: response.data.login,
      name: response.data.name,
      email: response.data.email,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error fetching GitHub user info: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error fetching GitHub user info: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
