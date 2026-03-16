export const DASHBOARD_NAV_SHORTCUTS = {
  chat: '⌘⌥2',
  overview: '⌘⌥1',
  repositories: '⌘⌥3',
  security: '⌘⌥5',
  teams: '⌘⌥4',
} as const;

export type DashboardShortcutAction =
  | { type: 'navigate'; to: '/dashboard' | '/dashboard/chat' }
  | { type: 'toggle-left' | 'toggle-right' }
  | null;

type ShortcutEvent = Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey'
>;

export function getDashboardShortcutAction(
  event: ShortcutEvent,
): DashboardShortcutAction {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) {
    return null;
  }

  if (event.key === 'b') {
    return { type: 'toggle-left' };
  }

  if (event.key === 'j') {
    return { type: 'toggle-right' };
  }

  if (!event.altKey) {
    return null;
  }

  if (event.code === 'Digit1') {
    return { type: 'navigate', to: '/dashboard' };
  }

  if (event.code === 'Digit2') {
    return { type: 'navigate', to: '/dashboard/chat' };
  }

  return null;
}
