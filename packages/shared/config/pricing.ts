import {
  CLIENT_SUBSCRIPTION_CONFIG,
  type SubscriptionTier,
} from './subscription-limits';

/**
 * Pricing configuration for subscription plans
 * This centralizes pricing information alongside the technical limits
 */
export const SUBSCRIPTION_PRICING = {
  free: {
    price: '$0',
    annualPrice: '$0',
    annualMonthlyEquivalent: '$0',
    period: '',
    annualPeriod: '',
    annualSavings: '$0',
    stripeId: null,
  },
  standard: {
    price: '$19',
    annualPrice: '$190',
    annualMonthlyEquivalent: '$15.83',
    period: 'per month',
    annualPeriod: 'per year',
    annualSavings: '$38',
    stripeId: 'standard',
  },
  unlimited: {
    price: '$49',
    annualPrice: '$490',
    annualMonthlyEquivalent: '$40.83',
    period: 'per month',
    annualPeriod: 'per year',
    annualSavings: '$98',
    stripeId: 'unlimited',
  },
} as const;

/**
 * Complete subscription plan configuration combining limits and pricing
 */
export function getCompleteSubscriptionPlan(tier: SubscriptionTier) {
  return {
    ...CLIENT_SUBSCRIPTION_CONFIG[tier],
    ...SUBSCRIPTION_PRICING[tier],
    id: tier,
    name: CLIENT_SUBSCRIPTION_CONFIG[tier].displayName,
  };
}

/**
 * Get all complete subscription plans
 */
export function getAllSubscriptionPlans() {
  return {
    free: getCompleteSubscriptionPlan('free'),
    standard: getCompleteSubscriptionPlan('standard'),
    unlimited: getCompleteSubscriptionPlan('unlimited'),
  };
}
