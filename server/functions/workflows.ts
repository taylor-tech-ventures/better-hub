import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getSession } from '@/server/functions/auth';

const triggerSchema = z.object({
  action: z.string(),
  description: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const approveSchema = z.object({
  instanceId: z.string(),
  approved: z.boolean(),
});

export const triggerAdminAction = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: z.infer<typeof triggerSchema> }) => {
    const parsed = triggerSchema.parse(data);
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const instance = await env.ADMIN_ACTION_WORKFLOW.create({
      params: {
        userId: session.user.id,
        action: parsed.action,
        description: parsed.description,
        payload: parsed.payload,
      },
    });

    return { instanceId: instance.id };
  },
);

export const approveAdminAction = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: z.infer<typeof approveSchema> }) => {
    const parsed = approveSchema.parse(data);
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const row = await env.GH_ADMIN_D1_PRIMARY.prepare(
      'SELECT user_id FROM admin_actions WHERE id = ?',
    )
      .bind(parsed.instanceId)
      .first<{ user_id: string }>();

    if (!row) throw new Error('Admin action not found');
    if (row.user_id !== session.user.id)
      throw new Error('Forbidden: action belongs to another user');

    const instance = await env.ADMIN_ACTION_WORKFLOW.get(parsed.instanceId);
    await instance.sendEvent({
      type: 'human-approval',
      payload: {
        approved: parsed.approved,
        approvedBy: session.user.id,
      },
    });
  },
);
