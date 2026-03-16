/// <reference types="vite/client" />

import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { Session } from '@/server/auth/client';
import { getSession } from '@/server/functions/auth';
import type { ConsentValue, Theme } from '@/server/functions/preferences';
import {
  getCookieConsentPreference,
  getThemePreference,
} from '@/server/functions/preferences';
import { CookieConsentBanner } from '@/web/components/ui/cookie-consent-banner';
import { ThemeProvider } from '@/web/providers/theme-provider';
import globalCSS from '@/web/styles/global.css?url';

export const Route = createRootRouteWithContext<{
  session: Session | null;
  theme: Theme;
  cookieConsent: ConsentValue | null;
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GH Admin' },
    ],
    links: [{ rel: 'stylesheet', href: globalCSS }],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    const [theme, cookieConsent] = await Promise.all([
      getThemePreference(),
      getCookieConsentPreference(),
    ]);
    return { session, theme, cookieConsent };
  },
  component: RootComponent,
});

function RootComponent() {
  const { theme, cookieConsent, session } = Route.useRouteContext();
  return (
    <RootDocument
      theme={theme}
      cookieConsent={cookieConsent}
      isAuthenticated={!!session}
    >
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({
  children,
  theme,
  cookieConsent,
  isAuthenticated,
}: Readonly<{
  children: ReactNode;
  theme: Theme;
  cookieConsent: ConsentValue | null;
  isAuthenticated: boolean;
}>) {
  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : undefined}>
      <head>
        <HeadContent />
        {/* For system theme: apply dark class synchronously before paint.
            SAFETY: This script is a static string literal — never interpolate
            user data or dynamic values into dangerouslySetInnerHTML. */}
        {theme === 'system' && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}})()",
            }}
          />
        )}
      </head>
      <body>
        <ThemeProvider initialTheme={theme}>
          {children}
          <CookieConsentBanner
            initialConsent={cookieConsent}
            isAuthenticated={isAuthenticated}
          />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
