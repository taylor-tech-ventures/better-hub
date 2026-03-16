import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type EnvironmentEntry = {
  id: number;
  name: string;
  html_url: string;
  protection_rules_count: number;
  deployment_branch_policy: {
    protected_branches: boolean;
    custom_branch_policies: boolean;
  } | null;
};

/**
 * Lists deployment environments for a repository.
 */
export async function listEnvironments(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
}): Promise<GitHubResult<EnvironmentEntry[]>> {
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
      'GET /repos/{owner}/{repo}/environments',
      { owner, repo, per_page: 100 },
    );

    const environments = response.data.environments ?? [];
    return ok(
      environments.map((env) => ({
        id: env.id,
        name: env.name,
        html_url:
          env.html_url ??
          `https://github.com/${owner}/${repo}/settings/environments/${env.id}`,
        protection_rules_count: env.protection_rules?.length ?? 0,
        deployment_branch_policy: env.deployment_branch_policy
          ? {
              protected_branches:
                env.deployment_branch_policy.protected_branches,
              custom_branch_policies:
                env.deployment_branch_policy.custom_branch_policies,
            }
          : null,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing environments for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing environments for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
