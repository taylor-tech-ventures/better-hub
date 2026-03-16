import { z } from 'zod';
import {
  createWebhookRule,
  deleteWebhookRule,
  getWebhookRule,
  listWebhookLogs,
  listWebhookRules,
  updateWebhookRule,
} from '@/server/data-access-layer/webhook-automation';
import { authorized, base } from '@/server/orpc/middleware';

const webhookConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'matches', 'not_equals']),
  value: z.string(),
});

const webhookActionSchema = z.object({
  type: z.enum(['add_labels', 'add_team', 'notify', 'add_branch_protection']),
  params: z.record(z.string(), z.unknown()),
});

export const webhookAutomation = {
  listRules: base
    .use(authorized)
    .handler(async ({ context }) =>
      listWebhookRules(context.env, context.session.userId),
    ),

  getRule: base
    .use(authorized)
    .input(z.object({ ruleId: z.string() }))
    .handler(async ({ input, context }) => {
      const rule = await getWebhookRule(
        context.env,
        context.session.userId,
        input.ruleId,
      );
      if (!rule) throw new Error('Rule not found');
      return rule;
    }),

  createRule: base
    .use(authorized)
    .input(
      z.object({
        name: z.string().min(1).max(200),
        githubOrg: z.string().min(1),
        eventType: z.enum([
          'repository.created',
          'repository.deleted',
          'branch_protection_rule.deleted',
          'member.added',
          'member.removed',
          'team.created',
          'team.deleted',
          'push',
        ]),
        conditions: z.array(webhookConditionSchema),
        actions: z.array(webhookActionSchema).min(1),
      }),
    )
    .handler(async ({ input, context }) =>
      createWebhookRule(context.env, {
        id: crypto.randomUUID(),
        userId: context.session.userId,
        ...input,
      }),
    ),

  updateRule: base
    .use(authorized)
    .input(
      z.object({
        ruleId: z.string(),
        name: z.string().min(1).max(200).optional(),
        enabled: z.boolean().optional(),
        conditions: z.array(webhookConditionSchema).optional(),
        actions: z.array(webhookActionSchema).min(1).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { ruleId, ...updates } = input;
      await updateWebhookRule(
        context.env,
        context.session.userId,
        ruleId,
        updates,
      );
    }),

  deleteRule: base
    .use(authorized)
    .input(z.object({ ruleId: z.string() }))
    .handler(async ({ input, context }) =>
      deleteWebhookRule(context.env, context.session.userId, input.ruleId),
    ),

  logs: base
    .use(authorized)
    .input(z.object({ ruleId: z.string().optional() }))
    .handler(async ({ input, context }) =>
      listWebhookLogs(context.env, context.session.userId, input.ruleId),
    ),
};
