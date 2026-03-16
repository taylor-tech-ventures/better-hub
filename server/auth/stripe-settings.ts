import type { stripe } from '@better-auth/stripe';
import { getSubscriptionLimits } from '@/shared/config/subscription-limits';

type StripeOptions = Parameters<typeof stripe>[0];

type PlanTypes = 'standard' | 'unlimited';
type PlanVariations = 'monthly' | 'annual';
type PriceIdMapItem = {
  [K in PlanTypes]: {
    [V in PlanVariations]: string;
  };
};

// Function to create Stripe settings with dynamic limits
export function createStripeSettings(
  env?: Cloudflare.Env,
): Omit<StripeOptions, 'stripeWebhookSecret' | 'stripeClient'> {
  const limits = getSubscriptionLimits(env);

  const priceIdMap: Record<string, PriceIdMapItem> = {
    local: {
      standard: {
        monthly:
          env?.PRICE_ID_STANDARD_MONTHLY ?? 'price_1RxVWgETMKcBlOigaaa44Jjj',
        annual:
          env?.PRICE_ID_STANDARD_ANNUAL ?? 'price_1RxVWgETMKcBlOigJsGDS2Qf',
      },
      unlimited: {
        monthly:
          env?.PRICE_ID_UNLIMITED_MONTHLY ?? 'price_1RxVZpETMKcBlOig82YXi4AF',
        annual:
          env?.PRICE_ID_UNLIMITED_ANNUAL ?? 'price_1RxVZpETMKcBlOigyoDXRQFP',
      },
    },
    prod: {
      standard: {
        monthly:
          env?.PRICE_ID_STANDARD_MONTHLY ?? 'price_1RyxCaErWZ3kGFfJ7idDC4eY',
        annual:
          env?.PRICE_ID_STANDARD_ANNUAL ?? 'price_1RyxCaErWZ3kGFfJPXTOGjjG',
      },
      unlimited: {
        monthly:
          env?.PRICE_ID_UNLIMITED_MONTHLY ?? 'price_1RyxEcErWZ3kGFfJseFLytbw',
        annual:
          env?.PRICE_ID_UNLIMITED_ANNUAL ?? 'price_1RyxEcErWZ3kGFfJ2zdhGjUA',
      },
    },
  };

  return {
    createCustomerOnSignUp: true,
    subscription: {
      enabled: true,
      plans: [
        {
          name: 'standard',
          priceId:
            env?.ENVIRONMENT === 'local'
              ? priceIdMap.local.standard.monthly
              : priceIdMap.prod.standard.monthly,
          annualDiscountPriceId:
            env?.ENVIRONMENT === 'local'
              ? priceIdMap.local.standard.annual
              : priceIdMap.prod.standard.annual,
          limits: { toolExecutions: limits.standard },
        },
        {
          name: 'unlimited',
          priceId:
            env?.ENVIRONMENT === 'local'
              ? priceIdMap.local.unlimited.monthly
              : priceIdMap.prod.unlimited.monthly,
          annualDiscountPriceId:
            env?.ENVIRONMENT === 'local'
              ? priceIdMap.local.unlimited.annual
              : priceIdMap.prod.unlimited.annual,
          limits: { toolExecutions: limits.unlimited },
        },
      ],
      getCheckoutSessionParams: async () => {
        return {
          params: {
            automatic_tax: {
              enabled: true,
            },
          },
        };
      },
    },
  };
}

// Default export using default limits (for backward compatibility)
const stripeSettings = createStripeSettings();

export default stripeSettings;
