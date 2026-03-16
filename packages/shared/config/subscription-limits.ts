export type SubscriptionTier = 'free' | 'standard' | 'unlimited';

export interface SubscriptionLimits {
  free: number;
  standard: number;
  unlimited: number;
}

export interface SubscriptionConfig {
  tier: SubscriptionTier;
  toolExecutionLimit: number;
  displayName: string;
  isUnlimited: boolean;
}

// Default fallback limits if environment variables are not set
const DEFAULT_LIMITS: SubscriptionLimits = {
  free: 50,
  standard: 500,
  unlimited: -1,
} as const;

/**
 * Get subscription limits from environment variables with fallbacks
 */
export function getSubscriptionLimits(
  env?: Cloudflare.Env,
): SubscriptionLimits {
  if (!env) {
    return DEFAULT_LIMITS;
  }

  return {
    free: Number(env.SUBSCRIPTION_LIMITS_FREE) || DEFAULT_LIMITS.free,
    standard:
      Number(env.SUBSCRIPTION_LIMITS_STANDARD) || DEFAULT_LIMITS.standard,
    unlimited:
      Number(env.SUBSCRIPTION_LIMITS_UNLIMITED) || DEFAULT_LIMITS.unlimited,
  };
}

/**
 * Get configuration for a specific subscription tier
 */
export function getSubscriptionConfig(
  tier: SubscriptionTier,
  env?: Cloudflare.Env,
): SubscriptionConfig {
  const limits = getSubscriptionLimits(env);
  const toolExecutionLimit = limits[tier];

  return {
    tier,
    toolExecutionLimit,
    displayName: tier.charAt(0).toUpperCase() + tier.slice(1),
    isUnlimited: toolExecutionLimit === -1,
  };
}

/**
 * Get all subscription configurations
 */
export function getAllSubscriptionConfigs(
  env?: Cloudflare.Env,
): Record<SubscriptionTier, SubscriptionConfig> {
  return {
    free: getSubscriptionConfig('free', env),
    standard: getSubscriptionConfig('standard', env),
    unlimited: getSubscriptionConfig('unlimited', env),
  };
}

/**
 * Format tool execution limit for display
 */
export function formatToolExecutionLimit(limit: number): string {
  if (limit === -1) {
    return 'Unlimited';
  }
  return limit.toLocaleString();
}

/**
 * Get the limit for a specific tier (convenience function)
 */
export function getToolExecutionLimit(
  tier: SubscriptionTier,
  env?: Cloudflare.Env,
): number {
  const limits = getSubscriptionLimits(env);
  return limits[tier];
}

/**
 * Client-side subscription configuration (uses default limits)
 * For runtime configuration on server, use getSubscriptionLimits(env)
 */
export const CLIENT_SUBSCRIPTION_CONFIG = {
  free: {
    toolExecutions: DEFAULT_LIMITS.free,
    displayName: 'Free',
    features: [
      `${formatToolExecutionLimit(
        DEFAULT_LIMITS.free,
      )} tool executions per month`,
      'Rate limiting applies',
      'No task scheduling',
      'No support',
      'No customizations',
    ],
  },
  standard: {
    toolExecutions: DEFAULT_LIMITS.standard,
    displayName: 'Standard',
    features: [
      `${formatToolExecutionLimit(
        DEFAULT_LIMITS.standard,
      )} tool executions per month`,
      `${Math.floor(
        DEFAULT_LIMITS.standard / DEFAULT_LIMITS.free,
      )}x more tool executions than Free`,
      'Scheduled task automation',
      'Email support',
      'Customizable prompt templates',
    ],
  },
  unlimited: {
    toolExecutions: DEFAULT_LIMITS.unlimited,
    displayName: 'Unlimited',
    features: [
      'Unlimited tool executions',
      'Scheduled task automation',
      'The ability to submit feature requests',
      'Email support',
      'Customizable prompt templates',
    ],
  },
} as const;
