import { useEffect, useState } from 'react';
import { Button } from '@/web/components/ui/button';
import { orpcClient } from '@/web/lib/orpc';

const CONSENT_KEY = 'gh-admin-cookie-consent';
const DO_PREF_KEY = 'cookie-consent';

type ConsentValue = 'accepted' | 'declined';

function getLocalConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONSENT_KEY) as ConsentValue | null;
}

function setLocalConsent(value: ConsentValue) {
  localStorage.setItem(CONSENT_KEY, value);
}

function persistToDO(value: ConsentValue) {
  orpcClient.preferences.set({ key: DO_PREF_KEY, value }).catch(() => {});
}

export function CookieConsentBanner({
  initialConsent,
  isAuthenticated,
}: {
  /**
   * Consent value loaded from the Durable Object at SSR time.
   * Non-null means the authenticated user has already responded — skip the banner.
   * Null means either unauthenticated or consent not yet recorded.
   */
  initialConsent: ConsentValue | null;
  /** Whether the user has an active session. */
  isAuthenticated: boolean;
}) {
  // For authenticated users the SSR value is authoritative; visible defaults to
  // false and we never need to run the async check.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Authenticated users: SSR already provided the DO value.
    if (isAuthenticated) {
      if (initialConsent === null) {
        // Logged in but no consent recorded → show the banner.
        setVisible(true);
      }
      // initialConsent !== null → already consented/declined, keep hidden.
      return;
    }

    // Unauthenticated users: fall back to localStorage.
    const local = getLocalConsent();
    if (local) return;

    setVisible(true);
  }, [initialConsent, isAuthenticated]);

  if (!visible) return null;

  const handleAccept = () => {
    setLocalConsent('accepted');
    persistToDO('accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    setLocalConsent('declined');
    persistToDO('declined');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pointer-events-none">
      <div className="max-w-lg mx-auto rounded-lg border bg-background shadow-lg p-4 pointer-events-auto">
        <p className="text-sm text-foreground">
          We use cookies and similar technologies to provide authentication,
          remember your preferences, and analyze usage to improve our service.
        </p>
        <div className="flex items-center gap-3 mt-3">
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline}>
            Decline
          </Button>
          <a
            href="https://gh-admin.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
