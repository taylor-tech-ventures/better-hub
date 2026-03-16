export const PLAN_COLORS: Record<string, string> = {
  free: '#94a3b8',
  standard: '#3b82f6',
  unlimited: '#8b5cf6',
  admin: '#f59e0b',
};

export function planColor(plan: string): string {
  return PLAN_COLORS[plan.toLowerCase()] ?? '#6b7280';
}

export function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
