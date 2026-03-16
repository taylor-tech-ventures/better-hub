import type { AdminAction } from '@/server/functions/admin-actions';

type AdminActionRow = {
  id: string;
  action: string;
  description: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  resolved_at: string | null;
};

function toAdminAction(row: AdminActionRow): AdminAction {
  return {
    id: row.id,
    action: row.action,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/** Fetch the most recent admin actions for a given user. */
export async function getUserAdminActions(
  db: D1Database,
  userId: string,
): Promise<AdminAction[]> {
  const result = await db
    .prepare(
      `SELECT id, action, description, status, created_at, resolved_at
       FROM admin_actions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .bind(userId)
    .all<AdminActionRow>();

  return (result.results ?? []).map(toAdminAction);
}

/** Insert a new pending admin action record. */
export async function insertAdminAction(
  db: D1Database,
  action: {
    id: string;
    userId: string;
    action: string;
    description: string;
    payload: Record<string, unknown>;
    createdAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_actions (id, user_id, action, description, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(
      action.id,
      action.userId,
      action.action,
      action.description,
      JSON.stringify(action.payload),
      action.createdAt,
    )
    .run();
}

/** Update the status of an admin action after approval or denial. */
export async function updateAdminActionStatus(
  db: D1Database,
  id: string,
  status: string,
  approvedBy: string,
  resolvedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE admin_actions
       SET status = ?, approved_by = ?, resolved_at = ?
       WHERE id = ?`,
    )
    .bind(status, approvedBy, resolvedAt, id)
    .run();
}

/** Delete resolved actions older than the retention period. Returns count deleted. */
export async function cleanupResolvedActions(
  db: D1Database,
  retentionDays: number,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const result = await db
    .prepare(
      `DELETE FROM admin_actions
       WHERE status != 'pending'
         AND resolved_at IS NOT NULL
         AND resolved_at < ?`,
    )
    .bind(cutoff)
    .run();
  return result.meta?.changes ?? 0;
}

/** Fetch a single admin action by ID (useful for ownership checks). */
export async function getAdminActionById(
  db: D1Database,
  id: string,
): Promise<AdminAction | null> {
  const row = await db
    .prepare(
      `SELECT id, action, description, status, created_at, resolved_at
       FROM admin_actions
       WHERE id = ?`,
    )
    .bind(id)
    .first<AdminActionRow>();

  return row ? toAdminAction(row) : null;
}
