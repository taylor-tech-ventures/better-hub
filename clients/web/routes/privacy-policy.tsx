import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon, ShieldIcon, TerminalIcon } from 'lucide-react';
import { Button } from '@/web/components/ui/button';
import { Separator } from '@/web/components/ui/separator';

export const Route = createFileRoute('/privacy-policy')({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  const { session } = Route.useRouteContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b px-6 py-3 flex items-center gap-4">
        <TerminalIcon className="size-5 text-primary shrink-0" />
        <span className="text-sm font-semibold">GH Admin</span>
        <Separator orientation="vertical" className="h-4" />
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Legal</span>
          <span>/</span>
          <span className="text-foreground">Privacy Policy</span>
        </nav>
        <div className="ml-auto">
          {session ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeftIcon className="size-3.5 mr-1.5" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldIcon className="size-7 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 13, 2026
          </p>
        </div>

        <Separator />

        <section className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            GH Admin ("we", "us", or "our") operates the gh-admin.com website
            and service. This Privacy Policy explains what information we
            collect, how we use it, and your choices regarding your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Information We Collect</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">
                GitHub Profile Information:
              </strong>{' '}
              When you sign in with GitHub, we receive your name, email address,
              avatar URL, and GitHub user ID. This information is provided by
              GitHub through OAuth and is used to identify your account.
            </p>
            <p>
              <strong className="text-foreground">OAuth Tokens:</strong> We
              store your GitHub OAuth access token and refresh token to perform
              GitHub API operations on your behalf. These tokens are encrypted
              at rest using AES-256-GCM encryption.
            </p>
            <p>
              <strong className="text-foreground">Session Data:</strong> We
              maintain session information to keep you authenticated. Sessions
              expire after 8 hours and auto-refresh within a 1-hour window.
            </p>
            <p>
              <strong className="text-foreground">Usage Data:</strong> We track
              tool execution counts and feature usage to enforce subscription
              limits and improve the service. This data is associated with your
              user ID.
            </p>
            <p>
              <strong className="text-foreground">AI Chat History:</strong>{' '}
              Conversations with the AI assistant are stored in your personal
              Durable Object instance to provide conversation continuity. Chat
              history is not shared with other users.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            2. How We Use Your Information
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
            <li>
              To authenticate you and provide access to the GH Admin service
            </li>
            <li>
              To execute GitHub operations (repository management, team
              administration, etc.) on your behalf through the GitHub API
            </li>
            <li>
              To power AI-assisted GitHub administration features using your
              GitHub data
            </li>
            <li>To process billing and manage your subscription</li>
            <li>To enforce usage limits based on your subscription tier</li>
            <li>To improve and maintain the service</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Third-Party Services</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>We use the following third-party services:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong className="text-foreground">GitHub API:</strong> To
                perform organization administration actions on your behalf using
                your delegated OAuth scopes
              </li>
              <li>
                <strong className="text-foreground">Stripe:</strong> To process
                payments and manage subscriptions. Stripe handles all payment
                information directly; we do not store credit card details
              </li>
              <li>
                <strong className="text-foreground">OpenAI:</strong> To power
                AI-assisted features. Your queries and relevant GitHub data may
                be sent to OpenAI's API for processing
              </li>
              <li>
                <strong className="text-foreground">Cloudflare:</strong> Our
                hosting provider. Your data is stored in Cloudflare D1
                (database), Durable Objects (per-user state), and Analytics
                Engine (usage telemetry)
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            4. Data Storage and Security
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              OAuth tokens are encrypted at rest using AES-256-GCM encryption.
              Tokens are stored in a 3-tier caching system within per-user
              Durable Objects for performance and isolation.
            </p>
            <p>
              All data is transmitted over HTTPS. We use Cloudflare Workers for
              request handling, which provides built-in DDoS protection and edge
              security.
            </p>
            <p>
              Each user's data is isolated in their own Durable Object instance,
              preventing cross-user data access.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Data Retention</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Active accounts:</strong> Your
              data is retained for as long as your account is active.
            </p>
            <p>
              <strong className="text-foreground">Inactive accounts:</strong>{' '}
              Free-tier accounts that have been inactive for 28 days are
              automatically cleaned up. All associated data (chat history,
              cached data, tokens) is permanently deleted.
            </p>
            <p>
              <strong className="text-foreground">Account deletion:</strong> You
              may delete your account at any time. Upon deletion, all your data
              is permanently removed from our systems, including tokens, chat
              history, preferences, and cached data.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Your Rights</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>You have the right to:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Access the personal information we hold about you through your
                account settings
              </li>
              <li>Delete your account and all associated data at any time</li>
              <li>
                Revoke GH Admin's access to your GitHub account through your
                GitHub settings
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify
            you of any material changes by posting the new policy on this page
            and updating the "Last updated" date.
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            GH Admin is not affiliated with, endorsed by, or sponsored by
            GitHub, Inc. or Microsoft Corporation. "GitHub" is a trademark of
            GitHub, Inc.
          </p>
        </section>

        <div className="flex gap-3 text-sm">
          <Link
            to="/terms-of-service"
            className="text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
