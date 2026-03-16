import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  organizationMembers,
  organizations,
} from '@/server/db/schemas/organizations';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'org-billing' });

export interface OrgBillingInfo {
  id: string;
  name: string;
  githubOrgLogin: string;
  plan: string;
  seatCount: number;
  usedSeats: number;
  status: string;
  ownerUserId: string;
}

export async function getOrgBilling(
  env: Cloudflare.Env,
  orgId: string,
): Promise<OrgBillingInfo | null> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .get();

  if (!org) return null;

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, orgId))
    .all();

  return {
    id: org.id,
    name: org.name,
    githubOrgLogin: org.githubOrgLogin,
    plan: org.plan,
    seatCount: org.seatCount,
    usedSeats: members.length,
    status: org.status,
    ownerUserId: org.ownerUserId,
  };
}

export async function getUserOrganizations(
  env: Cloudflare.Env,
  userId: string,
): Promise<OrgBillingInfo[]> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const memberships = await db
    .select({
      orgId: organizationMembers.organizationId,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .all();

  const results: OrgBillingInfo[] = [];
  for (const membership of memberships) {
    const org = await getOrgBilling(env, membership.orgId);
    if (org) results.push(org);
  }
  return results;
}

export async function createOrganization(
  env: Cloudflare.Env,
  params: {
    id: string;
    name: string;
    githubOrgLogin: string;
    ownerUserId: string;
    seatCount?: number;
  },
): Promise<OrgBillingInfo> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  await db.insert(organizations).values({
    id: params.id,
    name: params.name,
    githubOrgLogin: params.githubOrgLogin,
    ownerUserId: params.ownerUserId,
    seatCount: params.seatCount ?? 5,
  });

  await db.insert(organizationMembers).values({
    id: `${params.id}_${params.ownerUserId}`,
    organizationId: params.id,
    userId: params.ownerUserId,
    role: 'owner',
  });

  logger.info(
    { orgId: params.id, owner: params.ownerUserId },
    'organization created',
  );

  return {
    id: params.id,
    name: params.name,
    githubOrgLogin: params.githubOrgLogin,
    plan: 'free',
    seatCount: params.seatCount ?? 5,
    usedSeats: 1,
    status: 'active',
    ownerUserId: params.ownerUserId,
  };
}

export async function addOrgMember(
  env: Cloudflare.Env,
  orgId: string,
  userId: string,
  role = 'member',
): Promise<void> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const org = await getOrgBilling(env, orgId);
  if (!org) throw new Error('Organization not found');
  if (org.usedSeats >= org.seatCount) {
    throw new Error(
      `No seats available. ${org.usedSeats}/${org.seatCount} seats used. Upgrade to add more seats.`,
    );
  }

  await db.insert(organizationMembers).values({
    id: `${orgId}_${userId}`,
    organizationId: orgId,
    userId,
    role,
  });

  logger.info({ orgId, userId, role }, 'member added to organization');
}

export async function removeOrgMember(
  env: Cloudflare.Env,
  orgId: string,
  userId: string,
): Promise<void> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId),
      ),
    );

  logger.info({ orgId, userId }, 'member removed from organization');
}

export async function listOrgMembers(
  env: Cloudflare.Env,
  orgId: string,
): Promise<Array<{ userId: string; role: string; createdAt: Date }>> {
  const db = drizzle(env.GH_ADMIN_D1_PRIMARY);

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, orgId))
    .all();

  return members.map((m) => ({
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt,
  }));
}
