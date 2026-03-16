import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  BarChart2Icon,
  CalendarClockIcon,
  CreditCardIcon,
  GitBranchIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShieldIcon,
  TerminalIcon,
  UsersIcon,
} from 'lucide-react';
import type { Session } from '@/server/auth/client';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/web/components/ui/avatar';
import { Separator } from '@/web/components/ui/separator';
import { DASHBOARD_NAV_SHORTCUTS } from '@/web/lib/dashboard-shortcuts';
import { cn, userInitials } from '@/web/lib/utils';

type NavItem = {
  label: string;
  to: string;
  icon: React.ReactNode;
  shortcut: string;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    to: '/dashboard',
    icon: <LayoutDashboardIcon className="size-4" />,
    shortcut: DASHBOARD_NAV_SHORTCUTS.overview,
  },
  {
    label: 'Chat',
    to: '/dashboard/chat',
    icon: <MessageSquareIcon className="size-4" />,
    shortcut: DASHBOARD_NAV_SHORTCUTS.chat,
  },
  {
    label: 'Templates',
    to: '/dashboard/prompt-templates',
    icon: <ListChecksIcon className="size-4" />,
    shortcut: '',
  },
  {
    label: 'My Usage',
    to: '/dashboard/analytics',
    icon: <BarChart2Icon className="size-4" />,
    shortcut: '',
  },
  {
    label: 'Billing',
    to: '/dashboard/billing',
    icon: <CreditCardIcon className="size-4" />,
    shortcut: '',
  },
  {
    label: 'Scheduling',
    to: '/dashboard/scheduling',
    icon: <CalendarClockIcon className="size-4" />,
    shortcut: '',
  },
  {
    label: 'Repositories',
    to: '/dashboard/repositories',
    icon: <GitBranchIcon className="size-4" />,
    shortcut: DASHBOARD_NAV_SHORTCUTS.repositories,
  },
  {
    label: 'Teams',
    to: '/dashboard/teams',
    icon: <UsersIcon className="size-4" />,
    shortcut: DASHBOARD_NAV_SHORTCUTS.teams,
  },
  {
    label: 'Security',
    to: '/dashboard/security',
    icon: <ShieldIcon className="size-4" />,
    shortcut: DASHBOARD_NAV_SHORTCUTS.security,
  },
  {
    label: 'Settings',
    to: '/dashboard/settings',
    icon: <SettingsIcon className="size-4" />,
    shortcut: '',
  },
];

type NavDrawerProps = {
  open: boolean;
  session: Session;
  onClose: () => void;
};

export function NavDrawer({ open, session, onClose }: NavDrawerProps) {
  const matchRoute = useMatchRoute();

  return (
    <div
      className={cn(
        'flex flex-col border-r bg-background overflow-hidden transition-all duration-200 ease-in-out shrink-0',
        open ? 'w-72' : 'w-0',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <TerminalIcon className="size-5 text-primary shrink-0" />
        <span className="text-sm font-semibold whitespace-nowrap">
          GH Admin
        </span>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Avatar className="size-8 shrink-0">
          <AvatarImage
            src={session.user.image ?? undefined}
            alt={session.user.name}
          />
          <AvatarFallback className="text-xs">
            {userInitials(session.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{session.user.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {session.user.email}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              !item.disabled && !!matchRoute({ to: item.to, fuzzy: false });

            if (item.disabled) {
              return (
                <li key={item.to}>
                  <span
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm whitespace-nowrap',
                      'text-muted-foreground/50 cursor-not-allowed',
                    )}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    <span className="text-xs font-mono text-muted-foreground/40">
                      {item.shortcut}
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {item.shortcut}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin-only section */}
        {session.user.role === 'admin' && (
          <>
            <div className="mx-3 my-2 border-t" />
            <ul className="space-y-0.5">
              <li>
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
                  Admin
                </p>
              </li>
              <li>
                <Link
                  to="/dashboard/admin"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap',
                    matchRoute({ to: '/dashboard/admin', fuzzy: false })
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <BarChart2Icon className="size-4" />
                  <span className="flex-1">Analytics</span>
                </Link>
              </li>
            </ul>
          </>
        )}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-2 shrink-0 space-y-1">
        <div className="flex items-center gap-2 px-3">
          <Link
            to="/privacy-policy"
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground whitespace-nowrap"
          >
            Privacy
          </Link>
          <span className="text-xs text-muted-foreground/40">·</span>
          <Link
            to="/terms-of-service"
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground whitespace-nowrap"
          >
            Terms
          </Link>
        </div>
        <p className="px-3 py-1 text-xs text-muted-foreground/60 whitespace-nowrap">
          GH Admin v0.1.0
        </p>
      </div>
    </div>
  );
}
