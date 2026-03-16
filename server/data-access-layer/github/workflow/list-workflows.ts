import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type WorkflowSummary = {
  id: number;
  name: string;
  path: string;
  state: string;
};

export type WorkflowInput = {
  description: string;
  required: boolean;
  default?: string;
  type: 'string' | 'choice' | 'boolean' | 'number' | 'environment';
  options?: string[];
};

export type ListWorkflowsParams = {
  org: string;
  repo: string;
  accessToken: string | undefined;
};

/**
 * Lists all active workflows for a repository, following pagination.
 * Only returns active (enabled) workflows that can be dispatched.
 */
export async function listRepoWorkflows(
  params: ListWorkflowsParams,
): Promise<GitHubResult<WorkflowSummary[]>> {
  const { accessToken, org, repo } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is unavailable. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    const workflows = await octokit.paginate(
      'GET /repos/{owner}/{repo}/actions/workflows',
      { owner: org, repo, per_page: 100 },
      (response) => response.data.workflows,
    );

    return ok(
      workflows
        .filter((w) => w.state === 'active')
        .map((w) => ({
          id: w.id,
          name: w.name,
          path: w.path,
          state: w.state,
        })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing workflows for ${org}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing workflows for ${org}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
