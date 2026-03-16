import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  BotIcon,
  BuildingIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CheckIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  UsersIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { OrgWithAccess } from '@/server/data-access-layer/github/org/get-user-orgs-with-access';
import type { AdminAction } from '@/server/functions/admin-actions';
import { getAdminActions } from '@/server/functions/admin-actions';
import { approveAdminAction } from '@/server/functions/workflows';
import {
  AlertDialog,
  AlertDialogAction,
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
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { Input } from '@/web/components/ui/input';
import { Progress } from '@/web/components/ui/progress';
import { Skeleton } from '@/web/components/ui/skeleton';
import { orpcClient } from '@/web/lib/orpc';
import { useUsage } from '@/web/providers/usage-provider';

type OrgsResult = {
  orgs: OrgWithAccess[];
  cachedAt: number;
};

export const Route = createFileRoute('/dashboard/')({
  loader: () => getAdminActions(),
  component: DashboardOverview,
});

function statusBadge(status: AdminAction['status']) {
  if (status === 'pending')
    return { label: 'Requires confirmation', variant: 'destructive' as const };
  if (status === 'approved')
    return { label: 'Approved', variant: 'secondary' as const };
  return { label: 'Denied', variant: 'outline' as const };
}

function formatCacheAge(cachedAt: number): string {
  const ageMs = Date.now() - cachedAt;
  const ageMin = Math.floor(ageMs / 60_000);
  if (ageMin < 1) return 'just now';
  if (ageMin === 1) return '1 min ago';
  return `${ageMin} min ago`;
}

const SCHEDULING_BANNER_PREF = 'schedulingBannerDismissed';

function DashboardOverview() {
  const actions = Route.useLoaderData();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [pendingApproval, setPendingApproval] = useState<AdminAction | null>(
    null,
  );
  const [isApproving, setIsApproving] = useState(false);

  const {
    usage,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsage();

  const [bannerVisible, setBannerVisible] = useState(false);

  const [orgsResult, setOrgsResult] = useState<OrgsResult | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgsRefreshing, setOrgsRefreshing] = useState(false);

  const loadOrgs = async (forceRefresh = false) => {
    if (forceRefresh) {
      setOrgsRefreshing(true);
    } else {
      setOrgsLoading(true);
    }
    setOrgsError(null);
    try {
      const result = await orpcClient.github.getOrgsWithAccess({
        forceRefresh,
      });
      setOrgsResult(result);
    } catch (err) {
      setOrgsError(
        err instanceof Error ? err.message : 'Failed to load organizations',
      );
    } finally {
      setOrgsLoading(false);
      setOrgsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOrgs();
    void orpcClient.preferences
      .get({ key: SCHEDULING_BANNER_PREF })
      .then((val) => {
        if (val !== 'true') setBannerVisible(true);
      })
      .catch(() => {
        setBannerVisible(true);
      });
  }, []);

  const handleDismissBanner = () => {
    setBannerVisible(false);
    void orpcClient.preferences.set({
      key: SCHEDULING_BANNER_PREF,
      value: 'true',
    });
  };

  const handlePromptSubmit = () => {
    if (!prompt.trim()) return;
    void navigate({ to: '/dashboard/chat', search: { q: prompt.trim() } });
  };

  const handleDecision = async (approved: boolean) => {
    if (!pendingApproval) return;
    setIsApproving(true);
    try {
      await approveAdminAction({
        data: { instanceId: pendingApproval.id, approved },
      });
    } finally {
      setIsApproving(false);
      setPendingApproval(null);
    }
  };

  const usagePct =
    usage && !usage.isUnlimited && usage.limit > 0
      ? Math.min((usage.monthly / usage.limit) * 100, 100)
      : 0;

  const suggestions = [
    'List org repos',
    'Show team access',
    'Check branch protection',
    'Review security alerts',
  ];

  return (
    <>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Command Center</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your GitHub enterprise environment
            </p>
          </div>

          {/* Scheduled tools feature banner */}
          {bannerVisible && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950/30">
              <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  New: Scheduled Task Automation
                </p>
                <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                  Schedule PR merges, releases, and workflow runs to execute
                  automatically — available on Standard and Unlimited plans.
                </p>
                <div className="mt-2 flex gap-3">
                  <Link
                    to="/dashboard/scheduling"
                    className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                  >
                    Open Scheduling →
                  </Link>
                  <Link
                    to="/docs/scheduled-tools"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Learn more
                  </Link>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                aria-label="Dismiss"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )}

          {/* AI quick-ask bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <BotIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePromptSubmit();
                }}
                placeholder="What can I help you manage today?"
                className="pl-9"
              />
            </div>
            <Button onClick={handlePromptSubmit} disabled={!prompt.trim()}>
              Ask AI
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 -mt-3">
            <span className="text-xs text-muted-foreground">Try:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  void navigate({ to: '/dashboard/chat', search: { q: s } })
                }
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                "{s}"
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Usage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <ZapIcon className="size-3.5" />
                  AI Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ) : usageError ? (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">{usageError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void refreshUsage()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : usage ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold">
                        {usage.monthly.toLocaleString()}
                      </span>
                      {!usage.isUnlimited && (
                        <span className="text-sm text-muted-foreground">
                          of {usage.limit.toLocaleString()} tools
                        </span>
                      )}
                    </div>
                    {!usage.isUnlimited && (
                      <Progress value={usagePct} className="h-2 mb-2" />
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {usage.tier}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Resets{' '}
                        {new Date(usage.resetDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    {!usage.isUnlimited && usage.monthly >= usage.limit && (
                      <p className="text-xs text-destructive mt-2">
                        Monthly limit reached · upgrade to continue
                      </p>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>

            {/* Organizations */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <BuildingIcon className="size-3.5" />
                    Organizations
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    disabled={orgsLoading || orgsRefreshing}
                    onClick={() => void loadOrgs(true)}
                    title="Refresh organizations"
                  >
                    <RefreshCwIcon
                      className={`size-3 ${orgsRefreshing ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {orgsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-8" />
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    ))}
                  </div>
                ) : orgsError ? (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">{orgsError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadOrgs()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : orgsResult ? (
                  <>
                    <p className="text-3xl font-bold mb-2">
                      {orgsResult.orgs.length}
                    </p>
                    <div className="space-y-1.5 mb-2">
                      {orgsResult.orgs.slice(0, 5).map((org) => (
                        <div key={org.id} className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={org.avatar_url} alt={org.login} />
                            <AvatarFallback className="text-[10px]">
                              {org.login.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <a
                            href={`https://github.com/${org.login}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm hover:underline truncate flex-1"
                          >
                            {org.login}
                          </a>
                          {org.authorized ? (
                            <CheckCircle2Icon
                              className="size-3.5 text-green-600 dark:text-green-400 shrink-0"
                              title="App authorized"
                            />
                          ) : (
                            <a
                              href={`https://github.com/settings/connections/applications/${import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Authorize app for this org"
                              className="flex items-center gap-0.5 shrink-0"
                            >
                              <XCircleIcon className="size-3.5 text-destructive" />
                              <ExternalLinkIcon className="size-2.5 text-muted-foreground" />
                            </a>
                          )}
                        </div>
                      ))}
                      {orgsResult.orgs.length > 5 && (
                        <p className="text-xs text-muted-foreground pl-7">
                          +{orgsResult.orgs.length - 5} more
                        </p>
                      )}
                    </div>
                    {orgsResult.orgs.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No organizations found.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Cached {formatCacheAge(orgsResult.cachedAt)}
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* AI Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BotIcon className="size-4" />
                AI Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No actions yet. Ask the AI assistant to perform an operation.
                </p>
              ) : (
                <div className="space-y-3">
                  {actions.map((item) => {
                    const { label, variant } = statusBadge(item.status);
                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UsersIcon className="size-4 text-muted-foreground shrink-0" />
                          <p className="text-sm truncate">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {item.status === 'pending' ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 px-2 text-xs"
                              onClick={() => setPendingApproval(item)}
                            >
                              Review
                            </Button>
                          ) : (
                            <Badge variant={variant} className="text-xs">
                              {label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval dialog */}
      <AlertDialog
        open={!!pendingApproval}
        onOpenChange={(open) => {
          if (!open) setPendingApproval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingApproval?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isApproving}
              onClick={() => handleDecision(false)}
            >
              <XIcon className="size-4 mr-1" />
              Deny
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isApproving}
              onClick={() => handleDecision(true)}
            >
              <CheckIcon className="size-4 mr-1" />
              {isApproving ? 'Approving…' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
