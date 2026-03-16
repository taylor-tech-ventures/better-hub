import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon, FileTextIcon, TerminalIcon } from 'lucide-react';
import { Button } from '@/web/components/ui/button';
import { Separator } from '@/web/components/ui/separator';

export const Route = createFileRoute('/terms-of-service')({
  component: TermsOfService,
});

function TermsOfService() {
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
          <span className="text-foreground">Terms of Service</span>
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
            <FileTextIcon className="size-7 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: March 13, 2026
          </p>
        </div>

        <Separator />

        <section className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            By accessing or using GH Admin ("the Service"), you agree to be
            bound by these Terms of Service. If you do not agree to these terms,
            do not use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Description of Service</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            GH Admin is a web-based tool for GitHub organization administration
            with AI assistance. The Service allows you to manage repositories,
            teams, members, and other GitHub resources through a conversational
            AI interface and dashboard. The Service operates by accessing the
            GitHub API on your behalf using OAuth tokens you grant during
            sign-in.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Account and Access</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              You must sign in with a valid GitHub account to use the Service.
              By signing in, you authorize GH Admin to access your GitHub
              account within the OAuth scopes you approve.
            </p>
            <p>
              You are responsible for maintaining the security of your GitHub
              account. You may revoke GH Admin's access at any time through your
              GitHub account settings.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Acceptable Use</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>You agree to use the Service only for:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Legitimate GitHub organization administration within the scopes
                you have authorized
              </li>
              <li>
                Actions you are authorized to perform within your GitHub
                organizations
              </li>
            </ul>
            <p>You agree not to:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Use the Service to perform actions that violate GitHub's Terms
                of Service or Acceptable Use Policies
              </li>
              <li>
                Attempt to access GitHub resources beyond your authorized
                permissions
              </li>
              <li>
                Use the Service to automate bulk actions that could be
                considered abusive by GitHub
              </li>
              <li>
                Interfere with or disrupt the Service or its infrastructure
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            4. AI-Assisted Actions and User Responsibility
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              The Service uses AI to assist with GitHub administration tasks.
              AI-generated suggestions and actions are provided as assistance
              only.
            </p>
            <p>
              <strong className="text-foreground">
                You are solely responsible for all actions taken through the
                Service on your GitHub account and organizations.
              </strong>{' '}
              Destructive operations (such as deleting repositories, modifying
              team membership, or creating rulesets) require your explicit
              approval before execution. You should review each action carefully
              before approving it.
            </p>
            <p>
              Read-only operations (such as listing repositories or viewing team
              details) execute automatically without confirmation.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            5. Subscription Plans and Billing
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              The Service offers multiple subscription tiers (Free, Standard,
              and Unlimited), each with different usage limits. Usage limits are
              enforced on a per-billing-period basis.
            </p>
            <p>
              Paid subscriptions are billed through Stripe. You may manage your
              subscription, update payment methods, or cancel through the
              billing portal. Cancellations take effect at the end of the
              current billing period.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            6. Service Availability and Disclaimer
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              The Service is provided on an{' '}
              <strong className="text-foreground">"as-is"</strong> and{' '}
              <strong className="text-foreground">"as-available"</strong> basis.
              We make no warranties, express or implied, regarding the
              reliability, availability, or accuracy of the Service or its AI
              features.
            </p>
            <p>
              We do not guarantee that the Service will be uninterrupted,
              error-free, or that AI-generated suggestions will be accurate or
              appropriate for your use case.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, GH Admin and its operators
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, including but not limited to
            loss of data, loss of access to GitHub resources, or disruption to
            your GitHub organizations, arising from your use of the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Termination</h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              You may stop using the Service and delete your account at any
              time. Upon deletion, all your data is permanently removed.
            </p>
            <p>
              We reserve the right to suspend or terminate access to the Service
              for violations of these Terms or for any other reason at our
              discretion.
            </p>
            <p>
              Free-tier accounts inactive for 28 days are automatically cleaned
              up and all associated data is deleted.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Changes to These Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update these Terms from time to time. We will notify you of
            material changes by posting the revised terms on this page and
            updating the "Last updated" date. Continued use of the Service after
            changes constitutes acceptance of the revised terms.
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
            to="/privacy-policy"
            className="text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
