import { ORPCError } from '@orpc/server';
import Stripe from 'stripe';

export type SubscriptionRow = {
  id: string;
  plan: string;
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  stripeSubscriptionId: string | null;
};

/**
 * Returns the user's most recent active or trialing subscription, or null if
 * the user is on the free tier (no subscription row).
 */
export async function getSubscription(
  env: Cloudflare.Env,
  userId: string,
): Promise<SubscriptionRow | null> {
  const row = await env.GH_ADMIN_D1_PRIMARY.prepare(
    `SELECT id, plan, status, period_end, cancel_at_period_end, stripe_subscription_id
     FROM subscriptions
     WHERE reference_id = ? AND status IN ('active', 'trialing')
     ORDER BY period_end DESC LIMIT 1`,
  )
    .bind(userId)
    .first<{
      id: string;
      plan: string;
      status: string;
      period_end: number | null;
      cancel_at_period_end: number | null;
      stripe_subscription_id: string | null;
    }>();

  if (!row) return null;

  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    periodEnd: row.period_end != null ? new Date(row.period_end * 1000) : null,
    cancelAtPeriodEnd:
      row.cancel_at_period_end != null
        ? Boolean(row.cancel_at_period_end)
        : null,
    stripeSubscriptionId: row.stripe_subscription_id,
  };
}

/**
 * Retrieves the Stripe customer ID for a user from the users table.
 */
async function getStripeCustomerId(
  env: Cloudflare.Env,
  userId: string,
): Promise<string | null> {
  const row = await env.GH_ADMIN_D1_PRIMARY.prepare(
    'SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1',
  )
    .bind(userId)
    .first<{ stripe_customer_id: string | null }>();

  return row?.stripe_customer_id ?? null;
}

/**
 * Creates a Stripe Billing Portal session for the user and returns the URL.
 * The user is redirected to the portal URL to manage their subscription,
 * payment methods, and billing history.
 */
export async function createBillingPortalSession(
  env: Cloudflare.Env,
  userId: string,
  returnUrl: string,
): Promise<string> {
  const stripeCustomerId = await getStripeCustomerId(env, userId);

  if (!stripeCustomerId) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'No billing account found. Please upgrade your plan first.',
    });
  }

  const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const session = await stripeClient.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}
