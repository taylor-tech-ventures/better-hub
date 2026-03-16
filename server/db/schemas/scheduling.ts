import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from '@/server/db/schemas/auth';

/**
 * Generic scheduled task table.
 *
 * Designed to be extensible: task_type discriminates between different
 * scheduling features (PR merges, releases, workflow dispatches, etc.).
 * The `payload` column holds JSON specific to each task_type.
 */
export const scheduledTasks = sqliteTable('scheduled_tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taskType: text('task_type').notNull(),
  status: text('status').notNull().default('pending'),
  title: text('title').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  payload: text('payload').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  executedAt: integer('executed_at', { mode: 'timestamp' }),
  error: text('error'),
});
