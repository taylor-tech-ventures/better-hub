import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type TriggerWorkflowResult = {
  success: boolean;
  message: string;
};

/**
 * Triggers a workflow dispatch event for the specified workflow.
 */
export async function triggerWorkflowDispatch(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  workflow_id: string | number;
  ref: string;
  inputs?: Record<string, string>;
}): Promise<GitHubResult<TriggerWorkflowResult>> {
  const { accessToken, owner, repo, workflow_id, ref, inputs } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    await octokit.request(
      'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
      {
        owner,
        repo,
        workflow_id,
        ref,
        inputs: inputs ?? {},
      },
    );

    return ok({
      success: true,
      message: `Workflow dispatch triggered for ${workflow_id} on ref ${ref}`,
    });
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error triggering workflow ${workflow_id} on ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error triggering workflow ${workflow_id} on ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
