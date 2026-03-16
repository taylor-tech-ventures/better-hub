import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type AuditLogEntry = {
  action: string;
  actor: string;
  created_at: number;
  repo?: string;
  org?: string;
};

/**
 * Queries the organization audit log.
 */
export async function getAuditLog(params: {
  accessToken: string | undefined;
  org: string;
  phrase?: string;
  include?: string;
  after?: string;
  before?: string;
}): Promise<GitHubResult<AuditLogEntry[]>> {
  const { accessToken, org, phrase, include, after, before } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const { data } = await octokit.request('GET /orgs/{org}/audit-log', {
      org,
      ...(phrase ? { phrase } : {}),
      ...(include ? { include: include as 'web' | 'git' | 'all' } : {}),
      ...(after ? { after } : {}),
      ...(before ? { before } : {}),
      per_page: 100,
    });

    return ok(
      (
        data as Array<{
          action?: string;
          actor?: string;
          created_at?: number;
          '@timestamp'?: number;
          repo?: string;
          org?: string;
        }>
      ).map((entry) => ({
        action: entry.action ?? '',
        actor: entry.actor ?? '',
        created_at: entry.created_at ?? entry['@timestamp'] ?? 0,
        repo: entry.repo,
        org: entry.org,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error querying audit log for ${org}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error querying audit log for ${org}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
