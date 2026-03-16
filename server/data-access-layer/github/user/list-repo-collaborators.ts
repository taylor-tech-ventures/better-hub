import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type Collaborator = {
  login: string;
  id: number;
  avatar_url: string;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  role_name: string;
};

/**
 * Lists collaborators for a GitHub repository.
 * @param params - The owner, repo name, optional affiliation filter, and access token.
 * @returns A GitHubResult wrapping the list of collaborators.
 */
export async function listRepoCollaborators(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  affiliation?: 'outside' | 'direct' | 'all';
}): Promise<GitHubResult<Collaborator[]>> {
  const { accessToken, owner, repo, affiliation } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.paginate(
      'GET /repos/{owner}/{repo}/collaborators',
      {
        owner,
        repo,
        ...(affiliation !== undefined ? { affiliation } : {}),
      },
    );

    const collaborators: Collaborator[] = response.map((user) => ({
      login: user.login,
      id: user.id,
      avatar_url: user.avatar_url,
      permissions: {
        admin: user.permissions?.admin ?? false,
        maintain: user.permissions?.maintain ?? false,
        push: user.permissions?.push ?? false,
        triage: user.permissions?.triage ?? false,
        pull: user.permissions?.pull ?? false,
      },
      role_name: user.role_name ?? 'read',
    }));

    return ok(collaborators);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing collaborators for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing collaborators for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
