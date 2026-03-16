import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type SecurityAlertEntry = {
  number: number;
  state: string;
  severity: string;
  summary: string;
  html_url: string;
  created_at: string;
  package_name: string;
};

/**
 * Lists Dependabot alerts for a repository.
 */
export async function listSecurityAlerts(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  state?: string;
  severity?: string;
}): Promise<GitHubResult<SecurityAlertEntry[]>> {
  const { accessToken, owner, repo, state, severity } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request(
      'GET /repos/{owner}/{repo}/dependabot/alerts',
      {
        owner,
        repo,
        ...(state ? { state } : {}),
        ...(severity ? { severity } : {}),
        per_page: 100,
      },
    );

    return ok(
      (
        data as Array<{
          number: number;
          state: string;
          security_advisory: { summary: string; severity: string } | null;
          html_url: string;
          created_at: string;
          dependency: { package: { name: string } | null } | null;
        }>
      ).map((alert) => ({
        number: alert.number,
        state: alert.state,
        severity: alert.security_advisory?.severity ?? 'unknown',
        summary: alert.security_advisory?.summary ?? '',
        html_url: alert.html_url,
        created_at: alert.created_at,
        package_name: alert.dependency?.package?.name ?? 'unknown',
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing security alerts for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing security alerts for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
