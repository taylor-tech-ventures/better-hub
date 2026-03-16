import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type WorkflowRunEntry = {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  head_branch: string | null;
};

/**
 * Lists recent workflow runs for a repository, optionally filtered by workflow, status, or branch.
 */
export async function listWorkflowRuns(params: {
  accessToken: string | undefined;
  owner: string;
  repo: string;
  workflow_id?: number | string;
  status?: string;
  branch?: string;
}): Promise<GitHubResult<WorkflowRunEntry[]>> {
  const { accessToken, owner, repo, workflow_id, status, branch } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);

    let runs: Array<{
      id: number;
      name: string | null;
      status: string | null;
      conclusion: string | null;
      html_url: string;
      created_at: string;
      head_branch: string | null;
    }>;

    if (workflow_id) {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
        {
          owner,
          repo,
          workflow_id,
          ...(status
            ? {
                status: status as
                  | 'completed'
                  | 'action_required'
                  | 'cancelled'
                  | 'failure'
                  | 'neutral'
                  | 'skipped'
                  | 'stale'
                  | 'success'
                  | 'timed_out'
                  | 'in_progress'
                  | 'queued'
                  | 'requested'
                  | 'waiting'
                  | 'pending',
              }
            : {}),
          ...(branch ? { branch } : {}),
          per_page: 50,
        },
      );
      runs = response.data.workflow_runs;
    } else {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/runs',
        {
          owner,
          repo,
          ...(status
            ? {
                status: status as
                  | 'completed'
                  | 'action_required'
                  | 'cancelled'
                  | 'failure'
                  | 'neutral'
                  | 'skipped'
                  | 'stale'
                  | 'success'
                  | 'timed_out'
                  | 'in_progress'
                  | 'queued'
                  | 'requested'
                  | 'waiting'
                  | 'pending',
              }
            : {}),
          ...(branch ? { branch } : {}),
          per_page: 50,
        },
      );
      runs = response.data.workflow_runs;
    }

    return ok(
      runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        created_at: run.created_at,
        head_branch: run.head_branch,
      })),
    );
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error listing workflow runs for ${owner}/${repo}: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error listing workflow runs for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
