import { Link, useRouter } from '@tanstack/react-router';
import {
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SunIcon,
  TerminalIcon,
} from 'lucide-react';
import type { Session } from '@/server/auth/client';
import { authClient } from '@/server/auth/client';
import type { Theme } from '@/server/functions/preferences';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/web/components/ui/avatar';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/web/components/ui/menubar';
import { userInitials } from '@/web/lib/utils';
import { useTheme } from '@/web/providers/theme-provider';

type AppMenubarProps = {
  session: Session;
  onToggleLeft: () => void;
  onToggleRight?: () => void;
};

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <SunIcon className="size-3.5" />,
  dark: <MoonIcon className="size-3.5" />,
  system: <MonitorIcon className="size-3.5" />,
};

export function AppMenubar({
  session,
  onToggleLeft,
  onToggleRight,
}: AppMenubarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.navigate({ to: '/' });
  };

  return (
    <div className="flex h-8 items-center border-b bg-background px-2 gap-1 shrink-0">
      {/* App identity */}
      <Link
        to="/dashboard"
        className="flex items-center gap-1.5 px-2 text-sm font-semibold text-foreground hover:text-foreground/80"
      >
        <TerminalIcon className="size-4 text-primary" />
        GH Admin
      </Link>

      {/* Menus */}
      <Menubar className="border-none shadow-none bg-transparent p-0 h-auto">
        <MenubarMenu>
          <MenubarTrigger className="h-6 px-2 text-xs font-normal cursor-pointer">
            View
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onToggleLeft}>
              Toggle Left Panel
              <MenubarShortcut>⌘B</MenubarShortcut>
            </MenubarItem>
            {onToggleRight && (
              <MenubarItem onClick={onToggleRight}>
                Toggle AI Assistant
                <MenubarShortcut>⌘J</MenubarShortcut>
              </MenubarItem>
            )}
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="h-6 px-2 text-xs font-normal cursor-pointer">
            Settings
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem asChild>
              <Link to="/dashboard/settings">Settings Page</Link>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>
                <span className="mr-2">{THEME_ICONS[theme]}</span>
                Theme
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarRadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as Theme)}
                >
                  <MenubarRadioItem value="light">
                    <SunIcon className="mr-2 size-3.5" />
                    Light
                  </MenubarRadioItem>
                  <MenubarRadioItem value="dark">
                    <MoonIcon className="mr-2 size-3.5" />
                    Dark
                  </MenubarRadioItem>
                  <MenubarRadioItem value="system">
                    <MonitorIcon className="mr-2 size-3.5" />
                    System
                  </MenubarRadioItem>
                </MenubarRadioGroup>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem onClick={handleSignOut}>Sign Out</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Panel toggle icons */}
      <div className="flex items-center gap-0.5 mr-1">
        <button
          type="button"
          onClick={onToggleLeft}
          title="Toggle Left Panel (⌘B)"
          className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <PanelLeftIcon className="size-4" />
        </button>
        {onToggleRight && (
          <button
            type="button"
            onClick={onToggleRight}
            title="Toggle AI Assistant (⌘J)"
            className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <PanelRightIcon className="size-4" />
          </button>
        )}
      </div>

      {/* User avatar */}
      <Avatar className="size-6">
        <AvatarImage
          src={session.user.image ?? undefined}
          alt={session.user.name}
        />
        <AvatarFallback className="text-xs">
          {userInitials(session.user.name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
