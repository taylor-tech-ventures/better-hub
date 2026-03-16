import { ORPCError } from '@orpc/server';
import type {
  CreateScheduledTaskInput,
  ScheduledTaskStatus,
  ScheduledTaskSummary,
  ScheduledTaskType,
  UpdateScheduledTaskInput,
} from '@/shared/types/scheduling';

// ── Row type returned from D1 ─────────────────────────────────────────────────

type TaskRow = {
  id: string;
  user_id: string;
  task_type: string;
  status: string;
  title: string;
  scheduled_at: number;
  payload: string;
  created_at: number;
  updated_at: number;
  executed_at: number | null;
  error: string | null;
};

function rowToSummary(row: TaskRow): ScheduledTaskSummary {
  return {
    id: row.id,
    userId: row.user_id,
    taskType: row.task_type as ScheduledTaskType,
    status: row.status as ScheduledTaskStatus,
    title: row.title,
    scheduledAt: new Date(row.scheduled_at * 1000),
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
    executedAt:
      row.executed_at != null ? new Date(row.executed_at * 1000) : null,
    error: row.error,
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

// ── DAL functions ─────────────────────────────────────────────────────────────

/**
 * Returns all scheduled tasks for the user, ordered by scheduled_at ascending.
 * Optionally filter by task_type and/or status.
 */
export async function listScheduledTasks(
  env: Cloudflare.Env,
  userId: string,
  filters?: { taskType?: ScheduledTaskType; status?: ScheduledTaskStatus },
): Promise<ScheduledTaskSummary[]> {
  const conditions: string[] = ['user_id = ?'];
  const bindings: (string | number)[] = [userId];

  if (filters?.taskType) {
    conditions.push('task_type = ?');
    bindings.push(filters.taskType);
  }

  if (filters?.status) {
    conditions.push('status = ?');
    bindings.push(filters.status);
  }

  const where = conditions.join(' AND ');

  const result = await env.GH_ADMIN_D1_PRIMARY.prepare(
    `SELECT id, user_id, task_type, status, title, scheduled_at, payload,
            created_at, updated_at, executed_at, error
     FROM scheduled_tasks
     WHERE ${where}
     ORDER BY scheduled_at ASC`,
  )
    .bind(...bindings)
    .all<TaskRow>();

  return (result.results ?? []).map(rowToSummary);
}

/**
 * Returns a single scheduled task by ID, scoped to the user.
 * Throws NOT_FOUND if the task doesn't exist or belongs to another user.
 */
export async function getScheduledTask(
  env: Cloudflare.Env,
  userId: string,
  id: string,
): Promise<ScheduledTaskSummary> {
  const row = await env.GH_ADMIN_D1_PRIMARY.prepare(
    `SELECT id, user_id, task_type, status, title, scheduled_at, payload,
            created_at, updated_at, executed_at, error
     FROM scheduled_tasks
     WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first<TaskRow>();

  if (!row) {
    throw new ORPCError('NOT_FOUND', { message: 'Scheduled task not found.' });
  }

  return rowToSummary(row);
}

/**
 * Creates a new scheduled task for the user.
 * Returns the created task.
 */
export async function createScheduledTask<T extends ScheduledTaskType>(
  env: Cloudflare.Env,
  userId: string,
  input: CreateScheduledTaskInput<T>,
): Promise<ScheduledTaskSummary> {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);
  const scheduledAtUnix = Math.floor(input.scheduledAt.getTime() / 1000);

  await env.GH_ADMIN_D1_PRIMARY.prepare(
    `INSERT INTO scheduled_tasks
       (id, user_id, task_type, status, title, scheduled_at, payload, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      input.taskType,
      input.title,
      scheduledAtUnix,
      JSON.stringify(input.payload),
      now,
      now,
    )
    .run();

  return getScheduledTask(env, userId, id);
}

/**
 * Updates the title, scheduledAt, and/or payload of a pending task.
 * Only pending tasks may be updated; throws BAD_REQUEST otherwise.
 */
export async function updateScheduledTask(
  env: Cloudflare.Env,
  userId: string,
  id: string,
  input: UpdateScheduledTaskInput,
): Promise<ScheduledTaskSummary> {
  const existing = await getScheduledTask(env, userId, id);

  if (existing.status !== 'pending') {
    throw new ORPCError('BAD_REQUEST', {
      message: `Only pending tasks can be updated. This task is '${existing.status}'.`,
    });
  }

  const sets: string[] = ['updated_at = ?'];
  const bindings: (string | number)[] = [Math.floor(Date.now() / 1000)];

  if (input.title !== undefined) {
    sets.push('title = ?');
    bindings.push(input.title);
  }

  if (input.scheduledAt !== undefined) {
    sets.push('scheduled_at = ?');
    bindings.push(Math.floor(input.scheduledAt.getTime() / 1000));
  }

  if (input.payload !== undefined) {
    sets.push('payload = ?');
    bindings.push(JSON.stringify(input.payload));
  }

  bindings.push(id, userId);

  await env.GH_ADMIN_D1_PRIMARY.prepare(
    `UPDATE scheduled_tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  )
    .bind(...bindings)
    .run();

  return getScheduledTask(env, userId, id);
}

/**
 * Cancels a pending task by setting its status to 'cancelled'.
 * Throws BAD_REQUEST if the task is not pending.
 */
export async function cancelScheduledTask(
  env: Cloudflare.Env,
  userId: string,
  id: string,
): Promise<ScheduledTaskSummary> {
  const existing = await getScheduledTask(env, userId, id);

  if (existing.status !== 'pending') {
    throw new ORPCError('BAD_REQUEST', {
      message: `Only pending tasks can be cancelled. This task is '${existing.status}'.`,
    });
  }

  const now = Math.floor(Date.now() / 1000);

  await env.GH_ADMIN_D1_PRIMARY.prepare(
    `UPDATE scheduled_tasks
     SET status = 'cancelled', updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(now, id, userId)
    .run();

  return getScheduledTask(env, userId, id);
}

/**
 * Permanently deletes a scheduled task.
 * Throws NOT_FOUND if the task doesn't exist.
 */
export async function deleteScheduledTask(
  env: Cloudflare.Env,
  userId: string,
  id: string,
): Promise<void> {
  // Verify ownership first
  await getScheduledTask(env, userId, id);

  await env.GH_ADMIN_D1_PRIMARY.prepare(
    'DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .run();
}
