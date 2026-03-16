import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const webhookRules = sqliteTable('webhook_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  githubOrg: text('github_org').notNull(),
  eventType: text('event_type').notNull(),
  conditions: text('conditions').notNull(),
  actions: text('actions').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  lastTriggeredAt: integer('last_triggered_at', { mode: 'timestamp' }),
  triggerCount: integer('trigger_count').notNull().default(0),
});

export const webhookLogs = sqliteTable('webhook_logs', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => webhookRules.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventPayloadSummary: text('event_payload_summary').notNull(),
  actionsTaken: text('actions_taken').notNull(),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});
