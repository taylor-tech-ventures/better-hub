import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import type { RepoWebhook } from '@/server/data-access-layer/github/repo/list-repo-webhooks';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

/**
 * Creates a webhook for a repository.
 */
export async function createRepoWebhook(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  config: {
    url: string;
    content_type?: string;
    secret?: string;
    insecure_ssl?: string;
  };
  events?: string[];
  active?: boolean;
}): Promise<GitHubResult<RepoWebhook>> {
  const { accessToken, owner, repo, config, events, active } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.request('POST /repos/{owner}/{repo}/hooks', {
      owner,
      repo,
      config,
      events: events ?? ['push'],
      active: active ?? true,
    });

    const hook = response.data;
    return ok({
      id: hook.id,
      name: hook.name,
      active: hook.active,
      events: hook.events,
      config: {
        url: hook.config.url ?? undefined,
        content_type: hook.config.content_type ?? undefined,
        insecure_ssl: hook.config.insecure_ssl as string | undefined,
      },
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating webhook for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating webhook for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
