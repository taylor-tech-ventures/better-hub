import {
  createFileRoute,
  Outlet,
  redirect,
  useMatchRoute,
  useNavigate,
} from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@/server/auth/client';
import { AiDrawer } from '@/web/components/layout/ai-drawer';
import { AppMenubar } from '@/web/components/layout/app-menubar';
import { NavDrawer } from '@/web/components/layout/nav-drawer';
import { WelcomeModal } from '@/web/components/onboarding/welcome-modal';
import { getDashboardShortcutAction } from '@/web/lib/dashboard-shortcuts';
import { UsageProvider } from '@/web/providers/usage-provider';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/' });
    }
    return { session: context.session as Session };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isChatRoute = !!matchRoute({ to: '/dashboard/chat', fuzzy: false });
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const toggleLeft = useCallback(() => setLeftOpen((v) => !v), []);
  const toggleRight = useCallback(() => setRightOpen((v) => !v), []);

  // Keyboard shortcuts: ⌘B / Ctrl+B → left panel, ⌘J / Ctrl+J → right panel,
  // ⌘⌥1 / Ctrl+Alt+1 → overview, ⌘⌥2 / Ctrl+Alt+2 → chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const action = getDashboardShortcutAction(e);
      if (!action) {
        return;
      }

      e.preventDefault();

      if (action.type === 'toggle-left') {
        toggleLeft();
        return;
      }

      if (action.type === 'toggle-right') {
        if (!isChatRoute) toggleRight();
        return;
      }

      void navigate({ to: action.to });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, toggleLeft, toggleRight]);

  return (
    <UsageProvider>
      <WelcomeModal />
      <div className="flex flex-col h-screen bg-background">
        <AppMenubar
          session={session}
          onToggleLeft={toggleLeft}
          onToggleRight={isChatRoute ? undefined : toggleRight}
        />
        <div className="flex flex-1 min-h-0">
          <NavDrawer
            open={leftOpen}
            session={session}
            onClose={() => setLeftOpen(false)}
          />
          <main className="flex-1 min-h-0 flex flex-col">
            <Outlet />
          </main>
          {!isChatRoute && (
            <AiDrawer
              open={rightOpen}
              session={session}
              onClose={() => setRightOpen(false)}
            />
          )}
        </div>
      </div>
    </UsageProvider>
  );
}
