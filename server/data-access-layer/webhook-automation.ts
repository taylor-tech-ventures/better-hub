import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  webhookLogs,
  webhookRules,
} from '@/server/db/schemas/webhook-automation';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'webhook-automation' });

export type WebhookEventType =
  | 'repository.created'
  | 'repository.deleted'
  | 'branch_protection_rule.deleted'
  | 'member.added'
  | 'member.removed'
  | 'team.created'
  | 'team.deleted'
  | 'push';

export interface WebhookCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'not_equals';
  value: string;
}

export interface WebhookAction {
  type: 'add_labels' | 'add_team' | 'notify' | 'add_branch_protection';
  params: Record<string, unknown>;
}

export interface WebhookRule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  githubOrg: string;
  eventType: WebhookEventType;
  conditions: WebhookCondition[];
  actions: WebhookAction[];
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt: Date | null;
  triggerCount: number;
}

export async function listWebhookRules(
  env: Cloudflare.Env,
  userId: string,
): Promise<WebhookRule[]> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const rules = await db
    .select()
    .from(webhookRules)
    .where(eq(webhookRules.userId, userId))
    .orderBy(desc(webhookRules.createdAt))
    .all();

  return rules.map(parseRule);
}

export async function getWebhookRule(
  env: Cloudflare.Env,
  userId: string,
  ruleId: string,
): Promise<WebhookRule | null> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const rule = await db
    .select()
    .from(webhookRules)
    .where(and(eq(webhookRules.id, ruleId), eq(webhookRules.userId, userId)))
    .get();

  return rule ? parseRule(rule) : null;
}

export async function createWebhookRule(
  env: Cloudflare.Env,
  params: {
    id: string;
    userId: string;
    name: string;
    githubOrg: string;
    eventType: WebhookEventType;
    conditions: WebhookCondition[];
    actions: WebhookAction[];
  },
): Promise<WebhookRule> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const now = new Date();
  await db.insert(webhookRules).values({
    id: params.id,
    userId: params.userId,
    name: params.name,
    githubOrg: params.githubOrg,
    eventType: params.eventType,
    conditions: JSON.stringify(params.conditions),
    actions: JSON.stringify(params.actions),
    createdAt: now,
    updatedAt: now,
  });

  logger.info(
    { ruleId: params.id, userId: params.userId },
    'webhook rule created',
  );

  return {
    id: params.id,
    userId: params.userId,
    name: params.name,
    enabled: true,
    githubOrg: params.githubOrg,
    eventType: params.eventType,
    conditions: params.conditions,
    actions: params.actions,
    createdAt: now,
    updatedAt: now,
    lastTriggeredAt: null,
    triggerCount: 0,
  };
}

export async function updateWebhookRule(
  env: Cloudflare.Env,
  userId: string,
  ruleId: string,
  updates: Partial<{
    name: string;
    enabled: boolean;
    conditions: WebhookCondition[];
    actions: WebhookAction[];
  }>,
): Promise<void> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.enabled !== undefined) values.enabled = updates.enabled;
  if (updates.conditions !== undefined)
    values.conditions = JSON.stringify(updates.conditions);
  if (updates.actions !== undefined)
    values.actions = JSON.stringify(updates.actions);

  await db
    .update(webhookRules)
    .set(values)
    .where(and(eq(webhookRules.id, ruleId), eq(webhookRules.userId, userId)));
}

export async function deleteWebhookRule(
  env: Cloudflare.Env,
  userId: string,
  ruleId: string,
): Promise<void> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  await db
    .delete(webhookRules)
    .where(and(eq(webhookRules.id, ruleId), eq(webhookRules.userId, userId)));

  logger.info({ ruleId, userId }, 'webhook rule deleted');
}

export async function getMatchingRules(
  env: Cloudflare.Env,
  org: string,
  eventType: string,
): Promise<WebhookRule[]> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const rules = await db
    .select()
    .from(webhookRules)
    .where(
      and(
        eq(webhookRules.githubOrg, org),
        eq(webhookRules.eventType, eventType),
        eq(webhookRules.enabled, true),
      ),
    )
    .all();

  return rules.map(parseRule);
}

export async function logWebhookExecution(
  env: Cloudflare.Env,
  params: {
    ruleId: string;
    eventType: string;
    eventPayloadSummary: string;
    actionsTaken: string[];
    status: 'success' | 'error';
    error?: string;
  },
): Promise<void> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  await db.insert(webhookLogs).values({
    id: crypto.randomUUID(),
    ruleId: params.ruleId,
    eventType: params.eventType,
    eventPayloadSummary: params.eventPayloadSummary,
    actionsTaken: JSON.stringify(params.actionsTaken),
    status: params.status,
    error: params.error,
  });

  await db
    .update(webhookRules)
    .set({
      lastTriggeredAt: new Date(),
      triggerCount: 1, // Will be incremented via SQL
    })
    .where(eq(webhookRules.id, params.ruleId));
}

export async function listWebhookLogs(
  env: Cloudflare.Env,
  userId: string,
  _ruleId?: string,
): Promise<
  Array<{
    id: string;
    ruleId: string;
    eventType: string;
    eventPayloadSummary: string;
    actionsTaken: string[];
    status: string;
    error: string | null;
    createdAt: Date;
  }>
> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const query = db
    .select({
      id: webhookLogs.id,
      ruleId: webhookLogs.ruleId,
      eventType: webhookLogs.eventType,
      eventPayloadSummary: webhookLogs.eventPayloadSummary,
      actionsTaken: webhookLogs.actionsTaken,
      status: webhookLogs.status,
      error: webhookLogs.error,
      createdAt: webhookLogs.createdAt,
      userId: webhookRules.userId,
    })
    .from(webhookLogs)
    .innerJoin(webhookRules, eq(webhookLogs.ruleId, webhookRules.id))
    .where(eq(webhookRules.userId, userId))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(100);

  const logs = await query.all();

  return logs.map((l) => ({
    id: l.id,
    ruleId: l.ruleId,
    eventType: l.eventType,
    eventPayloadSummary: l.eventPayloadSummary,
    actionsTaken: JSON.parse(l.actionsTaken) as string[],
    status: l.status ?? 'success',
    error: l.error,
    createdAt: l.createdAt,
  }));
}

function parseRule(row: typeof webhookRules.$inferSelect): WebhookRule {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    enabled: row.enabled,
    githubOrg: row.githubOrg,
    eventType: row.eventType as WebhookEventType,
    conditions: JSON.parse(row.conditions) as WebhookCondition[],
    actions: JSON.parse(row.actions) as WebhookAction[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastTriggeredAt: row.lastTriggeredAt,
    triggerCount: row.triggerCount,
  };
}
