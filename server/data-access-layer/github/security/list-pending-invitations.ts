import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type PendingInvitationEntry = {
  id: number;
  login: string | null;
  email: string | null;
  role: string;
  created_at: string;
  inviter_login: string;
};

/**
 * Lists pending organization invitations.
 */
export async function listPendingOrgInvitations(params: {
  accessToken: string | undefined;
  org: string;
}): Promise<GitHubResult<PendingInvitationEntry[]>> {
  const { accessToken, org } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const invitations = await octokit.paginate('GET /orgs/{org}/invitations', {
      org,
      per_page: 100,
    });

    return ok(
      invitations.map((inv) => ({
        id: inv.id,
        login: inv.login ?? null,
        email: inv.email ?? null,
        role: inv.role,
        created_at: inv.created_at,
        inviter_login: inv.inviter?.login ?? 'unknown',
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing pending invitations for ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing pending invitations for ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
