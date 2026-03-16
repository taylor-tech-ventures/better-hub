import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  XCircleIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { authClient } from '@/server/auth/client';
import type { OrgWithAccess } from '@/server/data-access-layer/github/org/get-user-orgs-with-access';
import type { Theme } from '@/server/functions/preferences';
import type { SettingsData } from '@/server/functions/settings';
import { getSettingsData } from '@/server/functions/settings';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/web/components/ui/alert-dialog';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/web/components/ui/avatar';
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { Input } from '@/web/components/ui/input';
import { Label } from '@/web/components/ui/label';
import { Separator } from '@/web/components/ui/separator';
import { Skeleton } from '@/web/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/web/components/ui/tabs';
import { orpcClient } from '@/web/lib/orpc';
import { cn, userInitials } from '@/web/lib/utils';
import { useTheme } from '@/web/providers/theme-provider';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/' });
  },
  loader: () => getSettingsData(),
  component: SettingsPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] =
  [
    { value: 'light', label: 'Light', icon: <SunIcon className="size-4" /> },
    { value: 'dark', label: 'Dark', icon: <MoonIcon className="size-4" /> },
    {
      value: 'system',
      label: 'System',
      icon: <MonitorIcon className="size-4" />,
    },
  ];

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const data = Route.useLoaderData() as SettingsData;
  const { theme, setTheme } = useTheme();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your account, preferences, and billing
          </p>
        </div>

        <Tabs defaultValue="account">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="account">
              <UserIcon className="size-3.5 mr-1.5" />
              Account
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <MonitorIcon className="size-3.5 mr-1.5" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCardIcon className="size-3.5 mr-1.5" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* ── Account tab ── */}
          <TabsContent value="account" className="space-y-4 mt-4">
            <ProfileCard user={data.user} />
            <OrgsCard
              githubClientId={import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''}
            />
            <DangerZoneCard user={data.user} subscription={data.subscription} />
          </TabsContent>

          {/* ── Preferences tab ── */}
          <TabsContent value="preferences" className="space-y-4 mt-4">
            <ThemeCard theme={theme} setTheme={setTheme} />
          </TabsContent>

          {/* ── Billing tab ── */}
          <TabsContent value="billing" className="space-y-4 mt-4">
            <BillingRedirectCard subscription={data.subscription} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({ user }: { user: SettingsData['user'] }) {
  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Your GitHub account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="text-base">
              {userInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">@{user.login}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="mt-0.5 truncate">{user.email}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Member since
            </Label>
            <p className="mt-0.5">
              {new Date(user.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Orgs card ─────────────────────────────────────────────────────────────────

function OrgsCard({ githubClientId }: { githubClientId: string }) {
  const [orgs, setOrgs] = useState<OrgWithAccess[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrgs = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await orpcClient.github.getOrgsWithAccess({
        forceRefresh,
      });
      setOrgs(result.orgs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load organizations',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOrgs();
  }, []);

  const authorizeUrl = githubClientId
    ? `https://github.com/settings/connections/applications/${githubClientId}`
    : 'https://github.com/settings/applications';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Organizations</CardTitle>
            <CardDescription>
              GitHub organizations you belong to and their app access status
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || refreshing}
            onClick={() => void loadOrgs(true)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-5 w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void loadOrgs()}>
              Retry
            </Button>
          </div>
        ) : orgs && orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No organizations found.
          </p>
        ) : orgs ? (
          <div className="space-y-3">
            {orgs.map((org) => (
              <div key={org.id} className="flex items-center gap-3 py-1">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={org.avatar_url} alt={org.login} />
                  <AvatarFallback className="text-xs">
                    {org.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <a
                  href={`https://github.com/${org.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm hover:underline truncate"
                >
                  {org.login}
                </a>
                {org.authorized ? (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                    <CheckCircle2Icon className="size-3.5" />
                    <span>Connected</span>
                  </div>
                ) : (
                  <a
                    href={authorizeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Authorize the app for this organization"
                  >
                    <XCircleIcon className="size-3.5 text-destructive" />
                    <span className="text-destructive">Not authorized</span>
                    <ExternalLinkIcon className="size-3 ml-0.5" />
                  </a>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              Organizations marked "Not authorized" require an org owner to
              approve the app at{' '}
              <a
                href={authorizeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                GitHub Settings
              </a>
              .
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Danger zone card ──────────────────────────────────────────────────────────

function DangerZoneCard({
  user,
  subscription,
}: {
  user: SettingsData['user'];
  subscription: SettingsData['subscription'];
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await orpcClient.account.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gh-admin-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || confirmValue !== user.login) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await orpcClient.account.delete();
      await authClient.signOut();
      router.navigate({ to: '/' });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete account',
      );
      setDeleting(false);
    }
  };

  const hasActiveSub =
    subscription && ['active', 'trialing'].includes(subscription.status);

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base text-destructive flex items-center gap-2">
          <AlertTriangleIcon className="size-4" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions that affect your account permanently
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export data */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Export your data</p>
            <p className="text-xs text-muted-foreground">
              Download your profile, preferences, and chat history as JSON
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            <DownloadIcon className="size-3.5 mr-1.5" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>

        <Separator />

        {/* Delete account */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground">
              {hasActiveSub
                ? 'Cancel your subscription before deleting your account.'
                : 'Permanently delete your account and all associated data.'}
            </p>
          </div>
          {hasActiveSub ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/dashboard/billing">
                <CreditCardIcon className="size-3.5 mr-1.5" />
                Manage Plan
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-3.5 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setConfirmValue('');
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will wipe all your data including chat history,
                preferences, and usage records. This action cannot be undone.
              </span>
              <span className="block mt-3 text-foreground font-medium">
                Type{' '}
                <span className="font-mono bg-muted px-1 rounded">
                  {user?.login}
                </span>{' '}
                to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            placeholder={user?.login ?? ''}
            className="mt-2"
          />
          {deleteError && (
            <p className="text-sm text-destructive mt-1">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting || confirmValue !== (user?.login ?? '')}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>
          Choose how GH Admin looks. Your preference is saved to your account
          and synced across devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          {THEME_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer',
                theme === value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-border/80 hover:bg-accent/50',
              )}
            >
              {icon}
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Theme changes are persisted to your Durable Object — no localStorage.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Billing redirect card ─────────────────────────────────────────────────────

function BillingRedirectCard({
  subscription,
}: {
  subscription: SettingsData['subscription'];
}) {
  const planLabel = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : 'Free';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing &amp; Subscription</CardTitle>
        <CardDescription>
          Manage your plan, usage limits, and payment details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Current plan</p>
            <p className="text-xs text-muted-foreground">
              {subscription
                ? `${planLabel} — ${subscription.status}`
                : 'Free tier'}
            </p>
          </div>
          <Badge variant="secondary">{planLabel}</Badge>
        </div>
        <Button asChild className="w-full" variant="outline">
          <Link to="/dashboard/billing">
            <CreditCardIcon className="size-4 mr-2" />
            Go to Billing
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
