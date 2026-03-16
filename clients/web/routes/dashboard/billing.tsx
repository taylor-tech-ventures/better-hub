import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  CheckIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  ZapIcon,
} from 'lucide-react';
import { useState } from 'react';
import { authClient } from '@/server/auth/client';
import type { BillingData } from '@/server/functions/billing';
import { getBillingData } from '@/server/functions/billing';
import { SUBSCRIPTION_PRICING } from '@/shared/config/pricing';
import type { SubscriptionTier } from '@/shared/config/subscription-limits';
import {
  CLIENT_SUBSCRIPTION_CONFIG,
  formatToolExecutionLimit,
} from '@/shared/config/subscription-limits';
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { Progress } from '@/web/components/ui/progress';
import { Separator } from '@/web/components/ui/separator';
import { orpcClient } from '@/web/lib/orpc';
import { planColor } from '@/web/lib/plan-colors';

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard/billing')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/' });
  },
  loader: () => getBillingData(),
  component: BillingPage,
});

// ── Constants ──────────────────────────────────────────────────────────────

const TIERS: SubscriptionTier[] = ['free', 'standard', 'unlimited'];

const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 0,
  standard: 1,
  unlimited: 2,
};

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    past_due: 'Past Due',
  };
  return labels[status] ?? status;
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active' || status === 'trialing') return 'secondary';
  if (status === 'canceled' || status === 'past_due') return 'destructive';
  return 'outline';
}

// ── Page component ─────────────────────────────────────────────────────────

function BillingPage() {
  const data = Route.useLoaderData() as BillingData;
  const { subscription, usage } = data;
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<SubscriptionTier | null>(
    null,
  );
  const [isAnnual, setIsAnnual] = useState(false);

  const currentPlan: SubscriptionTier =
    (subscription?.plan as SubscriptionTier | undefined) ?? 'free';
  const currentTierOrder = TIER_ORDER[currentPlan] ?? 0;

  async function handleManageBilling() {
    setIsOpeningPortal(true);
    try {
      const url = await orpcClient.billing.createPortalSession({
        returnUrl: window.location.href,
      });
      window.location.href = url;
    } catch {
      setIsOpeningPortal(false);
    }
  }

  async function handleUpgrade(plan: SubscriptionTier) {
    setUpgradingPlan(plan);
    try {
      const result = await authClient.subscription.upgrade({
        plan,
        annual: isAnnual,
        successUrl: `${window.location.origin}/dashboard/billing`,
        cancelUrl: `${window.location.origin}/dashboard/billing`,
      });
      const url = (result as { data?: { url?: string } } | null)?.data?.url;
      if (url) {
        window.location.href = url;
      }
    } catch {
      setUpgradingPlan(null);
    }
  }

  const usagePercent =
    usage && !usage.isUnlimited && usage.limit > 0
      ? Math.min(100, Math.round((usage.monthly / usage.limit) * 100))
      : 0;

  const isApproachingLimit = !usage?.isUnlimited && usagePercent >= 80;
  const isAtLimit = !usage?.isUnlimited && usagePercent >= 100;

  const renewalDate = subscription?.periodEnd
    ? subscription.periodEnd.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your plan and billing details
          </p>
        </div>

        {/* Current plan + usage row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current plan card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCardIcon className="size-4" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="text-xl font-bold capitalize"
                  style={{ color: planColor(currentPlan) }}
                >
                  {CLIENT_SUBSCRIPTION_CONFIG[currentPlan].displayName}
                </span>
                {subscription && (
                  <Badge variant={statusVariant(subscription.status)}>
                    {statusLabel(subscription.status)}
                  </Badge>
                )}
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                {renewalDate && (
                  <p>
                    {subscription?.cancelAtPeriodEnd
                      ? 'Cancels on'
                      : 'Renews on'}{' '}
                    {renewalDate}
                  </p>
                )}
                {subscription?.cancelAtPeriodEnd && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    Your subscription will not renew after the current period.
                  </p>
                )}
                {!subscription && (
                  <p>{SUBSCRIPTION_PRICING.free.price} · No billing required</p>
                )}
              </div>

              {subscription && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={isOpeningPortal}
                  className="w-full mt-1"
                >
                  <ExternalLinkIcon className="size-3.5 mr-1.5" />
                  {isOpeningPortal ? 'Opening…' : 'Manage Billing'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Usage card */}
          {usage && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ZapIcon className="size-4" />
                  Tool Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {usage.isUnlimited ? (
                  <p className="text-xl font-bold text-violet-500">Unlimited</p>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold">
                        {usage.monthly.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {formatToolExecutionLimit(usage.limit)} executions
                      </span>
                    </div>
                    <Progress
                      value={usagePercent}
                      className="h-2"
                      style={
                        isAtLimit
                          ? ({
                              '--progress-color': '#ef4444',
                            } as React.CSSProperties)
                          : isApproachingLimit
                            ? ({
                                '--progress-color': '#f59e0b',
                              } as React.CSSProperties)
                            : undefined
                      }
                    />
                  </>
                )}

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    Resets{' '}
                    {new Date(usage.resetDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  {isAtLimit && (
                    <p className="text-red-500">
                      Monthly limit reached — upgrade to continue using tools.
                    </p>
                  )}
                  {isApproachingLimit && !isAtLimit && (
                    <p className="text-amber-600 dark:text-amber-400">
                      Approaching monthly limit.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator />

        {/* Plan comparison */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Plans</h2>
            <div className="flex items-center gap-2 text-sm">
              <span
                className={isAnnual ? 'text-muted-foreground' : 'font-medium'}
              >
                Monthly
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isAnnual}
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  isAnnual ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    isAnnual ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={isAnnual ? 'font-medium' : 'text-muted-foreground'}
              >
                Annual
              </span>
              {isAnnual && (
                <Badge variant="secondary" className="text-xs text-green-600">
                  Save up to 17%
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TIERS.map((tier) => {
              const config = CLIENT_SUBSCRIPTION_CONFIG[tier];
              const pricing = SUBSCRIPTION_PRICING[tier];
              const isCurrentPlan = tier === currentPlan;
              const isHigherTier = TIER_ORDER[tier] > currentTierOrder;
              const color = planColor(tier);

              return (
                <Card
                  key={tier}
                  className={isCurrentPlan ? 'ring-2' : undefined}
                  style={isCurrentPlan ? { ringColor: color } : undefined}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">
                        {config.displayName}
                      </CardTitle>
                      {isCurrentPlan && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: color, color }}
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold">
                        {isAnnual && tier !== 'free'
                          ? pricing.annualPrice
                          : pricing.price}
                      </span>
                      {(isAnnual ? pricing.annualPeriod : pricing.period) && (
                        <span className="text-xs text-muted-foreground">
                          {isAnnual && tier !== 'free'
                            ? pricing.annualPeriod
                            : pricing.period}
                        </span>
                      )}
                    </div>
                    {isAnnual && tier !== 'free' && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                        {pricing.annualMonthlyEquivalent}/mo · Save{' '}
                        {pricing.annualSavings}/yr
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1.5">
                      {config.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <CheckIcon
                            className="size-3.5 mt-0.5 shrink-0"
                            style={{ color }}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isHigherTier && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleUpgrade(tier)}
                        disabled={upgradingPlan !== null}
                        style={{ backgroundColor: color, color: '#fff' }}
                      >
                        {upgradingPlan === tier
                          ? 'Redirecting…'
                          : `Upgrade to ${config.displayName}`}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
