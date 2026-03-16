import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_NAV_SHORTCUTS,
  getDashboardShortcutAction,
} from '@/web/lib/dashboard-shortcuts';

describe('getDashboardShortcutAction', () => {
  it('uses shifted digit shortcuts for dashboard navigation', () => {
    expect(DASHBOARD_NAV_SHORTCUTS.overview).toBe('⌘⌥1');
    expect(DASHBOARD_NAV_SHORTCUTS.chat).toBe('⌘⌥2');

    expect(
      getDashboardShortcutAction({
        altKey: true,
        code: 'Digit1',
        ctrlKey: false,
        key: '1',
        metaKey: true,
      }),
    ).toEqual({ type: 'navigate', to: '/dashboard' });

    expect(
      getDashboardShortcutAction({
        altKey: true,
        code: 'Digit2',
        ctrlKey: true,
        key: '2',
        metaKey: false,
      }),
    ).toEqual({ type: 'navigate', to: '/dashboard/chat' });
  });

  it('keeps panel toggle shortcuts unchanged', () => {
    expect(
      getDashboardShortcutAction({
        altKey: false,
        code: 'KeyB',
        ctrlKey: false,
        key: 'b',
        metaKey: true,
      }),
    ).toEqual({ type: 'toggle-left' });

    expect(
      getDashboardShortcutAction({
        altKey: false,
        code: 'KeyJ',
        ctrlKey: true,
        key: 'j',
        metaKey: false,
      }),
    ).toEqual({ type: 'toggle-right' });
  });

  it('ignores shifted digit shortcuts so macOS screen capture bindings are untouched', () => {
    expect(
      getDashboardShortcutAction({
        altKey: false,
        code: 'Digit3',
        ctrlKey: false,
        key: '#',
        metaKey: true,
      }),
    ).toBeNull();
  });
});
