import { z } from 'zod';
import {
  addOrgMember,
  createOrganization,
  getOrgBilling,
  getUserOrganizations,
  listOrgMembers,
  removeOrgMember,
} from '@/server/data-access-layer/org-billing';
import { authorized, base } from '@/server/orpc/middleware';

export const orgBilling = {
  list: base
    .use(authorized)
    .handler(async ({ context }) =>
      getUserOrganizations(context.env, context.session.userId),
    ),

  get: base
    .use(authorized)
    .input(z.object({ orgId: z.string() }))
    .handler(async ({ input, context }) => {
      const org = await getOrgBilling(context.env, input.orgId);
      if (!org) throw new Error('Organization not found');
      return org;
    }),

  create: base
    .use(authorized)
    .input(
      z.object({
        name: z.string().min(1).max(100),
        githubOrgLogin: z.string().min(1).max(100),
        seatCount: z.number().min(1).max(1000).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const id = crypto.randomUUID();
      return createOrganization(context.env, {
        id,
        name: input.name,
        githubOrgLogin: input.githubOrgLogin,
        ownerUserId: context.session.userId,
        seatCount: input.seatCount,
      });
    }),

  addMember: base
    .use(authorized)
    .input(
      z.object({
        orgId: z.string(),
        userId: z.string(),
        role: z.enum(['member', 'admin']).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const org = await getOrgBilling(context.env, input.orgId);
      if (!org) throw new Error('Organization not found');
      if (org.ownerUserId !== context.session.userId) {
        throw new Error('Only the org owner can add members');
      }
      await addOrgMember(context.env, input.orgId, input.userId, input.role);
    }),

  removeMember: base
    .use(authorized)
    .input(z.object({ orgId: z.string(), userId: z.string() }))
    .handler(async ({ input, context }) => {
      const org = await getOrgBilling(context.env, input.orgId);
      if (!org) throw new Error('Organization not found');
      if (org.ownerUserId !== context.session.userId) {
        throw new Error('Only the org owner can remove members');
      }
      if (input.userId === context.session.userId) {
        throw new Error('Cannot remove yourself from the organization');
      }
      await removeOrgMember(context.env, input.orgId, input.userId);
    }),

  members: base
    .use(authorized)
    .input(z.object({ orgId: z.string() }))
    .handler(async ({ input, context }) => {
      const org = await getOrgBilling(context.env, input.orgId);
      if (!org) throw new Error('Organization not found');
      return listOrgMembers(context.env, input.orgId);
    }),
};
