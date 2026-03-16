import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type DispatchWorkflowParams = {
  org: string;
  repo: string;
  workflowId: string | number;
  ref: string;
  inputs?: Record<string, string>;
  accessToken: string | undefined;
};

/**
 * Triggers a workflow_dispatch event for the specified workflow.
 * Returns a GitHubResult wrapping `true` on success; the GitHub API returns 204 No Content.
 */
export async function dispatchWorkflow(
  params: DispatchWorkflowParams,
): Promise<GitHubResult<true>> {
  const { accessToken, org, repo, workflowId, ref, inputs } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is unavailable. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    await octokit.request(
      'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
      {
        owner: org,
        repo,
        workflow_id: workflowId,
        ref,
        inputs: inputs ?? {},
      },
    );

    return ok(true as const);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error dispatching workflow ${workflowId} on ${org}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error dispatching workflow ${workflowId} on ${org}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
