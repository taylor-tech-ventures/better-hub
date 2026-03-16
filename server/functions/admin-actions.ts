import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import { getUserAdminActions } from '@/server/data-access-layer/admin-actions';
import { getSession } from '@/server/functions/auth';

export type AdminAction = {
  id: string;
  action: string;
  description: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  resolvedAt: string | null;
};

export const getAdminActions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminAction[]> => {
    const session = await getSession();
    if (!session) return [];

    return getUserAdminActions(env.GH_ADMIN_D1_PRIMARY, session.user.id);
  },
);
