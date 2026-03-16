import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { getRepoPullRequests } from '@/server/data-access-layer/github/pr/get-pull-requests';
import { listRepoTags } from '@/server/data-access-layer/github/release/create-release';
import { listRepoWorkflows } from '@/server/data-access-layer/github/workflow/list-workflows';
import {
  cancelScheduledTask,
  createScheduledTask,
  deleteScheduledTask,
  getScheduledTask,
  listScheduledTasks,
  updateScheduledTask,
} from '@/server/data-access-layer/scheduling/scheduled-tasks';
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';
import { authorized, base } from '@/server/orpc/middleware';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const taskTypeSchema = z.enum(['pr_merge', 'release', 'workflow_dispatch']);

const taskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

const prMergePayloadSchema = z.object({
  org: z.string().min(1),
  repo: z.string().min(1),
  prNumber: z.number().int().positive(),
  prTitle: z.string().min(1),
  mergeMethod: z.enum(['merge', 'squash', 'rebase']),
  headSha: z.string().optional(),
});

const releasePayloadSchema = z.object({
  org: z.string().min(1),
  repo: z.string().min(1),
  tagName: z.string().min(1),
  targetCommitish: z.string().min(1),
  releaseName: z.string().optional(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  generateReleaseNotes: z.boolean().optional(),
});

const workflowDispatchPayloadSchema = z.object({
  org: z.string().min(1),
  repo: z.string().min(1),
  workflowId: z.union([z.string().min(1), z.number().int().positive()]),
  workflowName: z.string().min(1),
  ref: z.string().min(1),
  inputs: z.record(z.string(), z.string()).optional(),
});

// ── Shared helper to resolve a GitHub token ───────────────────────────────────

async function getAccessToken(
  env: Cloudflare.Env,
  userId: string,
): Promise<string> {
  const stub = await getGitHubAgentStub(env, userId);
  const token = await stub.getGitHubToken();

  if (!token) {
    throw new ORPCError('UNAUTHORIZED', {
      message:
        'GitHub access token is unavailable. Please sign out and sign in again.',
    });
  }

  return token;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const scheduling = {
  /**
   * List the authenticated user's scheduled tasks.
   * Optionally filter by task_type and/or status.
   */
  listTasks: base
    .use(authorized)
    .input(
      z.object({
        taskType: taskTypeSchema.optional(),
        status: taskStatusSchema.optional(),
      }),
    )
    .handler(async ({ input, context }) =>
      listScheduledTasks(context.env, context.session.userId, {
        taskType: input.taskType,
        status: input.status,
      }),
    ),

  /**
   * Get a single scheduled task by ID.
   */
  getTask: base
    .use(authorized)
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input, context }) =>
      getScheduledTask(context.env, context.session.userId, input.id),
    ),

  /**
   * Schedule a PR merge.
   */
  createPrMergeTask: base
    .use(authorized)
    .input(
      z.object({
        title: z.string().min(1).max(255),
        scheduledAt: z.string().datetime(),
        payload: prMergePayloadSchema,
      }),
    )
    .handler(async ({ input, context }) =>
      createScheduledTask(context.env, context.session.userId, {
        taskType: 'pr_merge',
        title: input.title,
        scheduledAt: new Date(input.scheduledAt),
        payload: input.payload,
      }),
    ),

  /**
   * Schedule a GitHub release creation.
   */
  createReleaseTask: base
    .use(authorized)
    .input(
      z.object({
        title: z.string().min(1).max(255),
        scheduledAt: z.string().datetime(),
        payload: releasePayloadSchema,
      }),
    )
    .handler(async ({ input, context }) =>
      createScheduledTask(context.env, context.session.userId, {
        taskType: 'release',
        title: input.title,
        scheduledAt: new Date(input.scheduledAt),
        payload: input.payload,
      }),
    ),

  /**
   * Schedule a GitHub Actions workflow_dispatch.
   */
  createWorkflowDispatchTask: base
    .use(authorized)
    .input(
      z.object({
        title: z.string().min(1).max(255),
        scheduledAt: z.string().datetime(),
        payload: workflowDispatchPayloadSchema,
      }),
    )
    .handler(async ({ input, context }) =>
      createScheduledTask(context.env, context.session.userId, {
        taskType: 'workflow_dispatch',
        title: input.title,
        scheduledAt: new Date(input.scheduledAt),
        payload: input.payload,
      }),
    ),

  /**
   * Update the title, scheduled time, or payload of a pending task.
   */
  updateTask: base
    .use(authorized)
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        scheduledAt: z.string().datetime().optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { id, title, scheduledAt, payload } = input;
      return updateScheduledTask(context.env, context.session.userId, id, {
        title,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        payload,
      });
    }),

  /**
   * Cancel a pending task.
   */
  cancelTask: base
    .use(authorized)
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input, context }) =>
      cancelScheduledTask(context.env, context.session.userId, input.id),
    ),

  /**
   * Permanently delete a scheduled task.
   */
  deleteTask: base
    .use(authorized)
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input, context }) => {
      await deleteScheduledTask(context.env, context.session.userId, input.id);
    }),

  /**
   * Fetch open pull requests for a repo.
   */
  listPullRequests: base
    .use(authorized)
    .input(
      z.object({
        org: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .handler(async ({ input, context }) => {
      const accessToken = await getAccessToken(
        context.env,
        context.session.userId,
      );

      const result = await getRepoPullRequests({
        org: input.org,
        repo: input.repo,
        state: 'open',
        accessToken,
      });

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error.message,
        });
      }

      return result.data;
    }),

  /**
   * Fetch git tags for a repo.
   * Used by the scheduling UI to populate the release tag/target pickers.
   */
  listRepoTags: base
    .use(authorized)
    .input(
      z.object({
        org: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .handler(async ({ input, context }) => {
      const accessToken = await getAccessToken(
        context.env,
        context.session.userId,
      );

      const result = await listRepoTags({
        org: input.org,
        repo: input.repo,
        accessToken,
      });

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error.message,
        });
      }

      return result.data;
    }),

  /**
   * Fetch active workflow files for a repo.
   * Used by the scheduling UI to populate the workflow dispatch picker.
   */
  listWorkflows: base
    .use(authorized)
    .input(
      z.object({
        org: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .handler(async ({ input, context }) => {
      const accessToken = await getAccessToken(
        context.env,
        context.session.userId,
      );

      const result = await listRepoWorkflows({
        org: input.org,
        repo: input.repo,
        accessToken,
      });

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error.message,
        });
      }

      return result.data;
    }),
};
