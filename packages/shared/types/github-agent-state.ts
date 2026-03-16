/** Usage statistics for the current user's tool execution budget. */
export type UsageStats = {
  /** Total tool executions consumed in the current billing period. */
  monthly: number;
  /** Tool executions in the current chat session. */
  session: number;
  /** Maximum tool executions allowed per billing period (-1 = unlimited). */
  limit: number;
  /** The user's subscription tier name (e.g. "free", "standard", "unlimited"). */
  tier: string;
  /** ISO-8601 date string for when the usage counter resets. */
  resetDate: string;
  /** True when the user is on the unlimited tier (no limit enforced). */
  isUnlimited: boolean;
};

/** State broadcast by the GitHubAgent Durable Object to connected WebSocket clients. */
export type GitHubAgentState = {
  /** Current usage statistics, or null before first tool execution. */
  usage: UsageStats | null;
};
