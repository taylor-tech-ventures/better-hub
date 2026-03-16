import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type RepoWebhook = {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url?: string;
    content_type?: string;
    insecure_ssl?: string;
  };
};

/**
 * Lists webhooks for a repository.
 */
export async function listRepoWebhooks(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
}): Promise<GitHubResult<RepoWebhook[]>> {
  const { accessToken, owner, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const hooks = await octokit.paginate('GET /repos/{owner}/{repo}/hooks', {
      owner,
      repo,
      per_page: 100,
    });

    return ok(
      hooks.map((hook) => ({
        id: hook.id,
        name: hook.name,
        active: hook.active,
        events: hook.events,
        config: {
          url: hook.config.url ?? undefined,
          content_type: hook.config.content_type ?? undefined,
          insecure_ssl: hook.config.insecure_ssl as string | undefined,
        },
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing webhooks for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing webhooks for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
