/**
 * Shared scheduling types.
 *
 * These types are used by both the server (DAL, oRPC routes) and the client
 * (UI components). The design is intentionally generic so that future
 * scheduling features (releases, workflow dispatches, etc.) can be added
 * by extending `ScheduledTaskType` and adding a matching payload type.
 */

// ── Task discriminants ────────────────────────────────────────────────────────

export type ScheduledTaskType =
  | 'pr_merge'
  | 'release'
  | 'workflow_dispatch'
  | 'tool_call';

export type ScheduledTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Task-type-specific payloads ───────────────────────────────────────────────

export type PrMergePayload = {
  org: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  mergeMethod: 'merge' | 'squash' | 'rebase';
  headSha?: string;
};

export type ReleasePayload = {
  org: string;
  repo: string;
  tagName: string;
  targetCommitish: string;
  releaseName?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  generateReleaseNotes?: boolean;
};

export type WorkflowDispatchPayload = {
  org: string;
  repo: string;
  /** Numeric workflow ID or filename (e.g. "deploy.yml"). */
  workflowId: string | number;
  workflowName: string;
  ref: string;
  inputs?: Record<string, string>;
};

/**
 * Payload for a generic scheduled tool call.
 * The AI agent stores the tool name and its full input so the executor
 * can replay the operation at the scheduled time.
 */
export type ToolCallPayload = {
  /** Exact tool name, e.g. "addGitHubTeamsToRepos". */
  toolName: string;
  /** Parameters that will be forwarded to the tool on execution. */
  toolInput: Record<string, unknown>;
};

/** Union of all payload types keyed by task_type. */
export type ScheduledTaskPayloadMap = {
  pr_merge: PrMergePayload;
  release: ReleasePayload;
  workflow_dispatch: WorkflowDispatchPayload;
  tool_call: ToolCallPayload;
};

// ── Core task type ────────────────────────────────────────────────────────────

export type ScheduledTask<T extends ScheduledTaskType = ScheduledTaskType> = {
  id: string;
  userId: string;
  taskType: T;
  status: ScheduledTaskStatus;
  title: string;
  scheduledAt: Date;
  payload: ScheduledTaskPayloadMap[T];
  createdAt: Date;
  updatedAt: Date;
  executedAt: Date | null;
  error: string | null;
};

/** Convenience alias for PR merge tasks. */
export type ScheduledPrMerge = ScheduledTask<'pr_merge'>;

// ── Input types for create / update ──────────────────────────────────────────

export type CreateScheduledTaskInput<T extends ScheduledTaskType> = {
  taskType: T;
  title: string;
  scheduledAt: Date;
  payload: ScheduledTaskPayloadMap[T];
};

export type UpdateScheduledTaskInput = {
  title?: string;
  scheduledAt?: Date;
  payload?: Record<string, unknown>;
};

// ── Summary used in list views ────────────────────────────────────────────────

export type ScheduledTaskSummary = Omit<ScheduledTask, 'payload'> & {
  payload: Record<string, unknown>;
};
