import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type OrgMemberEntry = {
  login: string;
  id: number;
  role: string;
  html_url: string;
};

/**
 * Lists all members of an organization, optionally filtered by role.
 */
export async function getOrgMembersList(params: {
  accessToken: string | undefined;
  org: string;
  role?: string;
}): Promise<GitHubResult<OrgMemberEntry[]>> {
  const { accessToken, org, role = 'all' } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const members = await octokit.paginate('GET /orgs/{org}/members', {
      org,
      role: role as 'all' | 'admin' | 'member',
      per_page: 100,
    });

    return ok(
      members.map((member) => ({
        login: member.login ?? '',
        id: member.id ?? 0,
        role: role === 'all' ? 'member' : role,
        html_url: member.html_url ?? `https://github.com/${member.login}`,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing members for ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing members for ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
