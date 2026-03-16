import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  CircleSlashIcon,
  ClockIcon,
  GitMergeIcon,
  Loader2Icon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  Trash2Icon,
  XCircleIcon,
  ZapIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@/server/auth/client';
import type { PullRequest } from '@/server/data-access-layer/github/pr/get-pull-requests';
import type { RepoTag } from '@/server/data-access-layer/github/release/create-release';
import type { WorkflowSummary } from '@/server/data-access-layer/github/workflow/list-workflows';
import type { BillingData } from '@/server/functions/billing';
import { getBillingData } from '@/server/functions/billing';
import type { SubscriptionTier } from '@/shared/config/subscription-limits';
import type {
  PrMergePayload,
  ReleasePayload,
  ScheduledTaskSummary,
  ToolCallPayload,
  WorkflowDispatchPayload,
} from '@/shared/types/scheduling';
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
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/web/components/ui/dropdown-menu';
import { Input } from '@/web/components/ui/input';
import { Label } from '@/web/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/components/ui/select';
import { Skeleton } from '@/web/components/ui/skeleton';
import { Switch } from '@/web/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/web/components/ui/tabs';
import { Textarea } from '@/web/components/ui/textarea';
import { orpcClient } from '@/web/lib/orpc';

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard/scheduling')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/' });
    return { session: context.session as Session };
  },
  loader: () => getBillingData(),
  component: SchedulingPage,
});

// ── Shared helpers ─────────────────────────────────────────────────────────

type MergeMethod = 'merge' | 'squash' | 'rebase';
type OrgEntry = { login: string; id: number; avatar_url: string };

const MERGE_METHOD_LABELS: Record<MergeMethod, string> = {
  merge: 'Merge commit',
  squash: 'Squash and merge',
  rebase: 'Rebase and merge',
};

function formatScheduledAt(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): Date {
  return new Date(value);
}

function oneHourFromNow(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
}

function minScheduleTime(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 5 * 60 * 1000));
}

// ── Payload type guards ────────────────────────────────────────────────────

function isPrMergePayload(p: Record<string, unknown>): p is PrMergePayload {
  return typeof p.prNumber === 'number';
}

function isReleasePayload(p: Record<string, unknown>): p is ReleasePayload {
  return typeof p.tagName === 'string' && typeof p.targetCommitish === 'string';
}

function isWorkflowDispatchPayload(
  p: Record<string, unknown>,
): p is WorkflowDispatchPayload {
  return typeof p.workflowId !== 'undefined' && typeof p.ref === 'string';
}

function isToolCallPayload(p: Record<string, unknown>): p is ToolCallPayload {
  return typeof p.toolName === 'string' && typeof p.toolInput === 'object';
}

// ── Task-type meta ─────────────────────────────────────────────────────────

type TaskTypeMeta = {
  label: string;
  icon: React.ReactNode;
};

const TASK_TYPE_META: Record<string, TaskTypeMeta> = {
  pr_merge: {
    label: 'PR merge',
    icon: <GitMergeIcon className="size-3.5 shrink-0" />,
  },
  release: {
    label: 'Release',
    icon: <RocketIcon className="size-3.5 shrink-0" />,
  },
  workflow_dispatch: {
    label: 'Workflow dispatch',
    icon: <PlayIcon className="size-3.5 shrink-0" />,
  },
  tool_call: {
    label: 'Scheduled action',
    icon: <ZapIcon className="size-3.5 shrink-0" />,
  },
};

// ── Status badge ───────────────────────────────────────────────────────────

type StatusConfig = {
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
};

function statusConfig(status: string): StatusConfig {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        icon: <ClockIcon className="size-3" />,
        variant: 'outline',
      };
    case 'running':
      return {
        label: 'Running',
        icon: <Loader2Icon className="size-3 animate-spin" />,
        variant: 'secondary',
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: <CheckCircle2Icon className="size-3" />,
        variant: 'secondary',
      };
    case 'failed':
      return {
        label: 'Failed',
        icon: <XCircleIcon className="size-3" />,
        variant: 'destructive',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: <CircleSlashIcon className="size-3" />,
        variant: 'outline',
      };
    default:
      return { label: status, icon: null, variant: 'outline' };
  }
}

// ── Shared sub-form: org + repo pickers ────────────────────────────────────

type OrgRepoState = { org: string; repo: string };

type OrgRepoPickerProps = {
  orgs: OrgEntry[];
  repos: string[];
  loadingOrgs: boolean;
  loadingRepos: boolean;
  value: OrgRepoState;
  onChange: (next: OrgRepoState) => void;
  onError: (msg: string) => void;
};

function OrgRepoPicker({
  orgs,
  repos,
  loadingOrgs,
  loadingRepos,
  value,
  onChange,
  onError: _onError,
}: OrgRepoPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="org">Organization</Label>
        {loadingOrgs ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={value.org}
            onValueChange={(v) => onChange({ org: v, repo: '' })}
          >
            <SelectTrigger id="org" className="w-full">
              <SelectValue placeholder="Select organization…" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.login} value={o.login}>
                  {o.login}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="repo">Repository</Label>
        {loadingRepos ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={value.repo}
            onValueChange={(v) => onChange({ ...value, repo: v })}
            disabled={!value.org}
          >
            <SelectTrigger id="repo" className="w-full">
              <SelectValue
                placeholder={
                  value.org ? 'Select repository…' : 'Select org first'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {repos.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ── Shared: schedule-time + title fields ───────────────────────────────────

type ScheduleFieldsProps = {
  title: string;
  scheduledAt: string;
  onTitleChange: (v: string) => void;
  onScheduledAtChange: (v: string) => void;
  titlePlaceholder?: string;
};

function ScheduleFields({
  title,
  scheduledAt,
  onTitleChange,
  onScheduledAtChange,
  titlePlaceholder = 'Task title',
}: ScheduleFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="scheduledAt">Schedule time</Label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          min={minScheduleTime()}
          onChange={(e) => onScheduledAtChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">
          Task title{' '}
          <span className="text-muted-foreground text-xs">(auto-filled)</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={titlePlaceholder}
          maxLength={255}
        />
      </div>
    </>
  );
}

// ── Form submit / cancel row ───────────────────────────────────────────────

function FormActions({
  submitting,
  disabled,
  submitLabel,
  submitIcon,
  onCancel,
}: {
  submitting: boolean;
  disabled?: boolean;
  submitLabel: string;
  submitIcon: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 justify-end pt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={submitting || disabled}>
        {submitting ? (
          <>
            <Loader2Icon className="size-3.5 mr-1.5 animate-spin" />
            Scheduling…
          </>
        ) : (
          <>
            {submitIcon}
            {submitLabel}
          </>
        )}
      </Button>
    </div>
  );
}

// ── useOrgRepos hook ───────────────────────────────────────────────────────

function useOrgRepos(org: string) {
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) {
      setRepos([]);
      return;
    }
    setLoading(true);
    setError(null);
    orpcClient.github
      .getOrgRepos({ org })
      .then((data) => setRepos((data as { name: string }[]).map((r) => r.name)))
      .catch(() => setError(`Failed to load repositories for ${org}.`))
      .finally(() => setLoading(false));
  }, [org]);

  return { repos, loading, error };
}

// ── Create PR Merge Form ───────────────────────────────────────────────────

type CreatePrMergeFormProps = {
  onSuccess: (task: ScheduledTaskSummary) => void;
  onCancel: () => void;
};

function CreatePrMergeForm({ onSuccess, onCancel }: CreatePrMergeFormProps) {
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingPrs, setLoadingPrs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgRepo, setOrgRepo] = useState({ org: '', repo: '' });
  const { repos, loading: loadingRepos } = useOrgRepos(orgRepo.org);

  const [prNumber, setPrNumber] = useState('');
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('squash');
  const [scheduledAt, setScheduledAt] = useState(oneHourFromNow());
  const [title, setTitle] = useState('');

  useEffect(() => {
    setLoadingOrgs(true);
    orpcClient.github
      .getOrgs({})
      .then(({ orgs: data }) => setOrgs(data as OrgEntry[]))
      .catch(() => setError('Failed to load organizations.'))
      .finally(() => setLoadingOrgs(false));
  }, []);

  // Reset PR list when repo changes
  useEffect(() => {
    if (!orgRepo.org || !orgRepo.repo) {
      setPrs([]);
      setPrNumber('');
      return;
    }
    setLoadingPrs(true);
    setPrNumber('');
    orpcClient.scheduling
      .listPullRequests({ org: orgRepo.org, repo: orgRepo.repo })
      .then((data) => setPrs(data as PullRequest[]))
      .catch(() =>
        setError(
          `Failed to load pull requests for ${orgRepo.org}/${orgRepo.repo}.`,
        ),
      )
      .finally(() => setLoadingPrs(false));
  }, [orgRepo.org, orgRepo.repo]);

  // Auto-fill title when PR selected
  useEffect(() => {
    if (!prNumber) return;
    const pr = prs.find((p) => String(p.number) === prNumber);
    if (pr) setTitle(`Merge PR #${pr.number}: ${pr.title}`);
  }, [prNumber, prs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prNum = Number(prNumber);
    const selectedPr = prs.find((p) => p.number === prNum);
    if (!orgRepo.org || !orgRepo.repo || !prNum || !selectedPr) {
      setError('Please select an organization, repository, and pull request.');
      return;
    }
    const scheduledDate = fromDatetimeLocalValue(scheduledAt);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await orpcClient.scheduling.createPrMergeTask({
        title: title || `Merge PR #${prNum}: ${selectedPr.title}`,
        scheduledAt: scheduledDate.toISOString(),
        payload: {
          org: orgRepo.org,
          repo: orgRepo.repo,
          prNumber: prNum,
          prTitle: selectedPr.title,
          mergeMethod,
          headSha: selectedPr.headSha,
        },
      });
      onSuccess(task as ScheduledTaskSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPr = prs.find((p) => String(p.number) === prNumber);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <OrgRepoPicker
        orgs={orgs}
        repos={repos}
        loadingOrgs={loadingOrgs}
        loadingRepos={loadingRepos}
        value={orgRepo}
        onChange={(next) => {
          setOrgRepo(next);
          setError(null);
        }}
        onError={setError}
      />

      {/* Pull request */}
      <div className="space-y-1.5">
        <Label htmlFor="pr">Pull request</Label>
        {loadingPrs ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={prNumber}
            onValueChange={(v) => {
              setPrNumber(v);
              setError(null);
            }}
            disabled={!orgRepo.repo}
          >
            <SelectTrigger id="pr" className="w-full">
              <SelectValue
                placeholder={
                  orgRepo.repo
                    ? prs.length === 0
                      ? 'No open pull requests'
                      : 'Select pull request…'
                    : 'Select repo first'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {prs.map((pr) => (
                <SelectItem key={pr.number} value={String(pr.number)}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    #{pr.number}
                  </span>
                  {pr.title}
                  {pr.draft && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Draft
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedPr && (
          <p className="text-xs text-muted-foreground">
            {selectedPr.headRef} → {selectedPr.baseRef} · by {selectedPr.author}
          </p>
        )}
      </div>

      {/* Merge method */}
      <div className="space-y-1.5">
        <Label htmlFor="mergeMethod">Merge method</Label>
        <Select
          value={mergeMethod}
          onValueChange={(v) => setMergeMethod(v as MergeMethod)}
        >
          <SelectTrigger id="mergeMethod" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MERGE_METHOD_LABELS) as MergeMethod[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MERGE_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScheduleFields
        title={title}
        scheduledAt={scheduledAt}
        onTitleChange={(v) => {
          setTitle(v);
          setError(null);
        }}
        onScheduledAtChange={(v) => {
          setScheduledAt(v);
          setError(null);
        }}
        titlePlaceholder="e.g. Merge PR #42: Add feature"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <FormActions
        submitting={submitting}
        disabled={!prNumber}
        submitLabel="Schedule merge"
        submitIcon={<GitMergeIcon className="size-3.5 mr-1.5" />}
        onCancel={onCancel}
      />
    </form>
  );
}

// ── Create Release Form ────────────────────────────────────────────────────

type CreateReleaseFormProps = {
  onSuccess: (task: ScheduledTaskSummary) => void;
  onCancel: () => void;
};

function CreateReleaseForm({ onSuccess, onCancel }: CreateReleaseFormProps) {
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [tags, setTags] = useState<RepoTag[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingTags, setLoadingTags] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgRepo, setOrgRepo] = useState({ org: '', repo: '' });
  const { repos, loading: loadingRepos } = useOrgRepos(orgRepo.org);

  const [tagName, setTagName] = useState('');
  const [targetCommitish, setTargetCommitish] = useState('');
  const [releaseName, setReleaseName] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);
  const [generateReleaseNotes, setGenerateReleaseNotes] = useState(true);
  const [scheduledAt, setScheduledAt] = useState(oneHourFromNow());
  const [title, setTitle] = useState('');

  useEffect(() => {
    setLoadingOrgs(true);
    orpcClient.github
      .getOrgs({})
      .then(({ orgs: data }) => setOrgs(data as OrgEntry[]))
      .catch(() => setError('Failed to load organizations.'))
      .finally(() => setLoadingOrgs(false));
  }, []);

  // Load tags when repo changes
  useEffect(() => {
    if (!orgRepo.org || !orgRepo.repo) {
      setTags([]);
      return;
    }
    setLoadingTags(true);
    setTagName('');
    orpcClient.scheduling
      .listRepoTags({ org: orgRepo.org, repo: orgRepo.repo })
      .then((data) => setTags(data as RepoTag[]))
      .catch(() =>
        setError(`Failed to load tags for ${orgRepo.org}/${orgRepo.repo}.`),
      )
      .finally(() => setLoadingTags(false));
  }, [orgRepo.org, orgRepo.repo]);

  // Auto-fill title when tag name changes
  useEffect(() => {
    if (tagName) {
      setTitle(`Release ${tagName} — ${orgRepo.org}/${orgRepo.repo}`);
      setReleaseName(tagName);
    }
  }, [tagName, orgRepo.org, orgRepo.repo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgRepo.org || !orgRepo.repo) {
      setError('Please select an organization and repository.');
      return;
    }
    if (!tagName) {
      setError('Please provide a tag name for the release.');
      return;
    }
    if (!targetCommitish) {
      setError('Please provide a target branch or commit SHA.');
      return;
    }
    const scheduledDate = fromDatetimeLocalValue(scheduledAt);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await orpcClient.scheduling.createReleaseTask({
        title: title || `Release ${tagName} — ${orgRepo.org}/${orgRepo.repo}`,
        scheduledAt: scheduledDate.toISOString(),
        payload: {
          org: orgRepo.org,
          repo: orgRepo.repo,
          tagName,
          targetCommitish,
          releaseName: releaseName || undefined,
          body: body || undefined,
          draft,
          prerelease,
          generateReleaseNotes,
        },
      });
      onSuccess(task as ScheduledTaskSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <OrgRepoPicker
        orgs={orgs}
        repos={repos}
        loadingOrgs={loadingOrgs}
        loadingRepos={loadingRepos}
        value={orgRepo}
        onChange={(next) => {
          setOrgRepo(next);
          setError(null);
        }}
        onError={setError}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tag name */}
        <div className="space-y-1.5">
          <Label htmlFor="tagName">
            Tag name{' '}
            <span className="text-muted-foreground text-xs">
              (new or existing)
            </span>
          </Label>
          {loadingTags ? (
            <Skeleton className="h-9 w-full" />
          ) : tags.length > 0 ? (
            <Select
              value={tagName}
              onValueChange={(v) => {
                setTagName(v);
                setError(null);
              }}
              disabled={!orgRepo.repo}
            >
              <SelectTrigger id="tagName" className="w-full">
                <SelectValue placeholder="Select or type a tag…" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="tagName"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. v1.2.0"
              disabled={!orgRepo.repo}
            />
          )}
        </div>

        {/* Target commitish */}
        <div className="space-y-1.5">
          <Label htmlFor="targetCommitish">Target branch / SHA</Label>
          <Input
            id="targetCommitish"
            value={targetCommitish}
            onChange={(e) => {
              setTargetCommitish(e.target.value);
              setError(null);
            }}
            placeholder="e.g. main or a commit SHA"
            disabled={!orgRepo.repo}
          />
        </div>
      </div>

      {/* Release name */}
      <div className="space-y-1.5">
        <Label htmlFor="releaseName">Release title</Label>
        <Input
          id="releaseName"
          value={releaseName}
          onChange={(e) => setReleaseName(e.target.value)}
          placeholder="e.g. v1.2.0 — Performance improvements"
          maxLength={255}
        />
      </div>

      {/* Release notes body */}
      <div className="space-y-1.5">
        <Label htmlFor="body">
          Release notes{' '}
          <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the changes in this release…"
          className="min-h-24 resize-y"
        />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label
            htmlFor="generateReleaseNotes"
            className="text-sm cursor-pointer"
          >
            Auto release notes
          </Label>
          <Switch
            id="generateReleaseNotes"
            checked={generateReleaseNotes}
            onCheckedChange={setGenerateReleaseNotes}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="prerelease" className="text-sm cursor-pointer">
            Pre-release
          </Label>
          <Switch
            id="prerelease"
            checked={prerelease}
            onCheckedChange={setPrerelease}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="draft" className="text-sm cursor-pointer">
            Draft
          </Label>
          <Switch id="draft" checked={draft} onCheckedChange={setDraft} />
        </div>
      </div>

      <ScheduleFields
        title={title}
        scheduledAt={scheduledAt}
        onTitleChange={(v) => {
          setTitle(v);
          setError(null);
        }}
        onScheduledAtChange={(v) => {
          setScheduledAt(v);
          setError(null);
        }}
        titlePlaceholder="e.g. Release v1.2.0 — my-org/my-repo"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <FormActions
        submitting={submitting}
        disabled={!tagName || !targetCommitish}
        submitLabel="Schedule release"
        submitIcon={<RocketIcon className="size-3.5 mr-1.5" />}
        onCancel={onCancel}
      />
    </form>
  );
}

// ── Create Workflow Dispatch Form ──────────────────────────────────────────

type CreateWorkflowDispatchFormProps = {
  onSuccess: (task: ScheduledTaskSummary) => void;
  onCancel: () => void;
};

function CreateWorkflowDispatchForm({
  onSuccess,
  onCancel,
}: CreateWorkflowDispatchFormProps) {
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgRepo, setOrgRepo] = useState({ org: '', repo: '' });
  const { repos, loading: loadingRepos } = useOrgRepos(orgRepo.org);

  const [workflowId, setWorkflowId] = useState('');
  const [ref, setRef] = useState('');
  // Dynamic key=value inputs for workflow_dispatch inputs
  const [inputRows, setInputRows] = useState<
    { id: string; key: string; value: string }[]
  >([{ id: crypto.randomUUID(), key: '', value: '' }]);
  const [scheduledAt, setScheduledAt] = useState(oneHourFromNow());
  const [title, setTitle] = useState('');

  useEffect(() => {
    setLoadingOrgs(true);
    orpcClient.github
      .getOrgs({})
      .then(({ orgs: data }) => setOrgs(data as OrgEntry[]))
      .catch(() => setError('Failed to load organizations.'))
      .finally(() => setLoadingOrgs(false));
  }, []);

  // Load workflows when repo changes
  useEffect(() => {
    if (!orgRepo.org || !orgRepo.repo) {
      setWorkflows([]);
      setWorkflowId('');
      return;
    }
    setLoadingWorkflows(true);
    setWorkflowId('');
    orpcClient.scheduling
      .listWorkflows({ org: orgRepo.org, repo: orgRepo.repo })
      .then((data) => setWorkflows(data as WorkflowSummary[]))
      .catch(() =>
        setError(
          `Failed to load workflows for ${orgRepo.org}/${orgRepo.repo}.`,
        ),
      )
      .finally(() => setLoadingWorkflows(false));
  }, [orgRepo.org, orgRepo.repo]);

  // Auto-fill title when workflow selected
  useEffect(() => {
    if (!workflowId) return;
    const wf = workflows.find((w) => String(w.id) === workflowId);
    if (wf) setTitle(`Dispatch ${wf.name} — ${orgRepo.org}/${orgRepo.repo}`);
  }, [workflowId, workflows, orgRepo.org, orgRepo.repo]);

  function updateInputRow(idx: number, field: 'key' | 'value', value: string) {
    setInputRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  function addInputRow() {
    setInputRows((rows) => [
      ...rows,
      { id: crypto.randomUUID(), key: '', value: '' },
    ]);
  }

  function removeInputRow(idx: number) {
    setInputRows((rows) => rows.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgRepo.org || !orgRepo.repo || !workflowId) {
      setError('Please select an organization, repository, and workflow.');
      return;
    }
    if (!ref) {
      setError('Please provide a branch or tag to dispatch on.');
      return;
    }
    const scheduledDate = fromDatetimeLocalValue(scheduledAt);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }

    const wf = workflows.find((w) => String(w.id) === workflowId);
    const inputs: Record<string, string> = {};
    for (const row of inputRows) {
      if (row.key.trim()) inputs[row.key.trim()] = row.value;
    }

    setSubmitting(true);
    setError(null);
    try {
      const task = await orpcClient.scheduling.createWorkflowDispatchTask({
        title:
          title ||
          `Dispatch ${wf?.name ?? workflowId} — ${orgRepo.org}/${orgRepo.repo}`,
        scheduledAt: scheduledDate.toISOString(),
        payload: {
          org: orgRepo.org,
          repo: orgRepo.repo,
          workflowId: Number(workflowId),
          workflowName: wf?.name ?? String(workflowId),
          ref,
          inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
        },
      });
      onSuccess(task as ScheduledTaskSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <OrgRepoPicker
        orgs={orgs}
        repos={repos}
        loadingOrgs={loadingOrgs}
        loadingRepos={loadingRepos}
        value={orgRepo}
        onChange={(next) => {
          setOrgRepo(next);
          setError(null);
        }}
        onError={setError}
      />

      {/* Workflow */}
      <div className="space-y-1.5">
        <Label htmlFor="workflow">Workflow</Label>
        {loadingWorkflows ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={workflowId}
            onValueChange={(v) => {
              setWorkflowId(v);
              setError(null);
            }}
            disabled={!orgRepo.repo}
          >
            <SelectTrigger id="workflow" className="w-full">
              <SelectValue
                placeholder={
                  orgRepo.repo
                    ? workflows.length === 0
                      ? 'No active workflows found'
                      : 'Select workflow…'
                    : 'Select repo first'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {workflows.map((wf) => (
                <SelectItem key={wf.id} value={String(wf.id)}>
                  <span>{wf.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {wf.path.replace('.github/workflows/', '')}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Ref */}
      <div className="space-y-1.5">
        <Label htmlFor="ref">Branch or tag</Label>
        <Input
          id="ref"
          value={ref}
          onChange={(e) => {
            setRef(e.target.value);
            setError(null);
          }}
          placeholder="e.g. main"
          disabled={!orgRepo.repo}
        />
      </div>

      {/* Dynamic inputs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Inputs{' '}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={addInputRow}
          >
            <PlusIcon className="size-3 mr-1" />
            Add input
          </Button>
        </div>
        <div className="space-y-2">
          {inputRows.map((row, idx) => (
            <div key={row.id} className="flex gap-2">
              <Input
                value={row.key}
                onChange={(e) => updateInputRow(idx, 'key', e.target.value)}
                placeholder="key"
                className="flex-1"
              />
              <Input
                value={row.value}
                onChange={(e) => updateInputRow(idx, 'value', e.target.value)}
                placeholder="value"
                className="flex-1"
              />
              {inputRows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeInputRow(idx)}
                >
                  <XCircleIcon className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ScheduleFields
        title={title}
        scheduledAt={scheduledAt}
        onTitleChange={(v) => {
          setTitle(v);
          setError(null);
        }}
        onScheduledAtChange={(v) => {
          setScheduledAt(v);
          setError(null);
        }}
        titlePlaceholder="e.g. Dispatch deploy.yml — my-org/my-repo"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <FormActions
        submitting={submitting}
        disabled={!workflowId || !ref}
        submitLabel="Schedule dispatch"
        submitIcon={<PlayIcon className="size-3.5 mr-1.5" />}
        onCancel={onCancel}
      />
    </form>
  );
}

// ── Edit form (generic: reschedule + retitle) ──────────────────────────────

type EditFormProps = {
  task: ScheduledTaskSummary;
  onSuccess: (task: ScheduledTaskSummary) => void;
  onCancel: () => void;
};

function EditScheduledTaskForm({ task, onSuccess, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(task.title);
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeLocalValue(task.scheduledAt),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const scheduledDate = fromDatetimeLocalValue(scheduledAt);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await orpcClient.scheduling.updateTask({
        id: task.id,
        title: title.trim() || task.title,
        scheduledAt: scheduledDate.toISOString(),
      });
      onSuccess(updated as ScheduledTaskSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          maxLength={255}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-scheduledAt">Schedule time</Label>
        <Input
          id="edit-scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          min={minScheduleTime()}
          onChange={(e) => {
            setScheduledAt(e.target.value);
            setError(null);
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <FormActions
        submitting={submitting}
        submitLabel="Save changes"
        submitIcon={<PencilIcon className="size-3.5 mr-1.5" />}
        onCancel={onCancel}
      />
    </form>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────

type TaskRowProps = {
  task: ScheduledTaskSummary;
  onEdit: (t: ScheduledTaskSummary) => void;
  onCancel: (t: ScheduledTaskSummary) => void;
  onDelete: (t: ScheduledTaskSummary) => void;
};

function TaskRow({ task, onEdit, onCancel, onDelete }: TaskRowProps) {
  const sc = statusConfig(task.status);
  const isPending = task.status === 'pending';
  const meta = TASK_TYPE_META[task.taskType] ?? TASK_TYPE_META.pr_merge;
  const p = task.payload;

  let detail = '';
  if (isPrMergePayload(p)) {
    detail = `${p.org}/${p.repo} · PR #${p.prNumber} · ${MERGE_METHOD_LABELS[p.mergeMethod]}`;
  } else if (isReleasePayload(p)) {
    const flags = [p.draft && 'draft', p.prerelease && 'pre-release']
      .filter(Boolean)
      .join(', ');
    detail = `${p.org}/${p.repo} · ${p.tagName} → ${p.targetCommitish}${flags ? ` · ${flags}` : ''}`;
  } else if (isWorkflowDispatchPayload(p)) {
    const inputCount = p.inputs ? Object.keys(p.inputs).length : 0;
    detail = `${p.org}/${p.repo} · ${p.workflowName} @ ${p.ref}${inputCount > 0 ? ` · ${inputCount} input${inputCount > 1 ? 's' : ''}` : ''}`;
  } else if (isToolCallPayload(p)) {
    const inputKeys = Object.keys(p.toolInput).slice(0, 3);
    detail = `${p.toolName}${inputKeys.length > 0 ? ` · ${inputKeys.join(', ')}` : ''}`;
  }

  const timeLabel =
    task.status === 'completed' && task.executedAt
      ? `Executed ${formatScheduledAt(task.executedAt)}`
      : isPending
        ? `Scheduled for ${formatScheduledAt(task.scheduledAt)}`
        : `Was scheduled for ${formatScheduledAt(task.scheduledAt)}`;

  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{meta.icon}</div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{task.title}</span>
          <Badge
            variant={sc.variant}
            className="text-xs flex items-center gap-1 shrink-0"
          >
            {sc.icon}
            {sc.label}
          </Badge>
          <Badge variant="outline" className="text-xs shrink-0">
            {meta.label}
          </Badge>
        </div>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        <p className="text-xs text-muted-foreground">{timeLabel}</p>
        {task.error && (
          <p className="text-xs text-destructive mt-0.5">Error: {task.error}</p>
        )}
      </div>

      {isPending && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            title="Edit"
            onClick={() => onEdit(task)}
          >
            <PencilIcon className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            title="Cancel"
            onClick={() => onCancel(task)}
          >
            <XCircleIcon className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            title="Delete"
            onClick={() => onDelete(task)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      )}

      {!isPending && (
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete"
          onClick={() => onDelete(task)}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ── Rollup stats bar ───────────────────────────────────────────────────────

type StatusCounts = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
};

function RollupStats({ counts }: { counts: StatusCounts }) {
  const items = [
    {
      key: 'pending' as const,
      label: 'Pending',
      icon: <ClockIcon className="size-3.5" />,
      style: 'border-border bg-muted/50 text-foreground',
    },
    {
      key: 'running' as const,
      label: 'Running',
      icon: <Loader2Icon className="size-3.5" />,
      style:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      key: 'completed' as const,
      label: 'Completed',
      icon: <CheckCircle2Icon className="size-3.5" />,
      style:
        'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
    },
    {
      key: 'failed' as const,
      label: 'Failed',
      icon: <XCircleIcon className="size-3.5" />,
      style: 'border-destructive/30 bg-destructive/5 text-destructive',
    },
    {
      key: 'cancelled' as const,
      label: 'Cancelled',
      icon: <CircleSlashIcon className="size-3.5" />,
      style: 'border-border bg-muted/30 text-muted-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map(({ key, label, icon, style }) => (
        <div
          key={key}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${style}`}
        >
          {icon}
          <span className="text-lg font-bold tabular-nums leading-none">
            {counts[key]}
          </span>
          <span className="text-xs leading-none">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <CalendarClockIcon className="size-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type CreateType = 'pr_merge' | 'release' | 'workflow_dispatch';

type DialogState =
  | { type: 'none' }
  | { type: 'create'; createType: CreateType }
  | { type: 'edit'; task: ScheduledTaskSummary }
  | { type: 'cancel'; task: ScheduledTaskSummary }
  | { type: 'delete'; task: ScheduledTaskSummary };

const CREATE_FORM_META: Record<
  CreateType,
  { title: string; icon: React.ReactNode }
> = {
  pr_merge: {
    title: 'Schedule a PR merge',
    icon: <GitMergeIcon className="size-4" />,
  },
  release: {
    title: 'Schedule a release',
    icon: <RocketIcon className="size-4" />,
  },
  workflow_dispatch: {
    title: 'Schedule a workflow dispatch',
    icon: <PlayIcon className="size-4" />,
  },
};

// ── Upsell gate ────────────────────────────────────────────────────────────

function SchedulingUpsell() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-md mx-auto pt-20 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <LockIcon className="size-8 text-muted-foreground" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Task Scheduling</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Automate GitHub operations — schedule PR merges, releases, workflow
            runs, and custom tool calls to execute at any time.
          </p>
        </div>

        <div className="text-left rounded-lg bg-muted/50 p-4 space-y-2">
          <p className="text-sm font-medium">
            Included in Standard &amp; Unlimited plans:
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {[
              'Schedule PR merges for off-hours',
              'Automate release creation and tagging',
              'Trigger workflow dispatches on a schedule',
              'Queue custom AI tool calls for later',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckIcon className="size-4 shrink-0 mt-0.5 text-blue-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link to="/dashboard/billing">Upgrade to Standard — $19/month</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/docs/scheduled-tools">Learn how it works</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page component ──────────────────────────────────────────────────────────

function SchedulingPage() {
  const { session } = Route.useRouteContext();
  const billingData = Route.useLoaderData() as BillingData;
  const currentPlan: SubscriptionTier =
    (billingData.subscription?.plan as SubscriptionTier | undefined) ?? 'free';
  const isAdmin = session.user.role === 'admin';

  if (currentPlan === 'free' && !isAdmin) {
    return <SchedulingUpsell />;
  }

  return <SchedulingPageContent />;
}

function SchedulingPageContent() {
  const [tasks, setTasks] = useState<ScheduledTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [actionLoading, setActionLoading] = useState(false);
  const loadedRef = useRef(false);

  const loadTasks = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await orpcClient.scheduling.listTasks({});
      setTasks(result as ScheduledTaskSummary[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadTasks();
  }, [loadTasks]);

  const pending = tasks.filter((t) => t.status === 'pending');
  const active = tasks.filter((t) => t.status === 'running');
  const history = tasks.filter((t) =>
    ['completed', 'failed', 'cancelled'].includes(t.status),
  );

  // Rollup-view derived data
  const upcoming = [...pending, ...active].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  const recentHistory = [...history]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);
  const counts: StatusCounts = {
    pending: pending.length,
    running: active.length,
    completed: history.filter((t) => t.status === 'completed').length,
    failed: history.filter((t) => t.status === 'failed').length,
    cancelled: history.filter((t) => t.status === 'cancelled').length,
  };

  function handleCreateSuccess(task: ScheduledTaskSummary) {
    setTasks((prev) =>
      [...prev, task].sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
      ),
    );
    setDialog({ type: 'none' });
  }

  function handleEditSuccess(updated: ScheduledTaskSummary) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setDialog({ type: 'none' });
  }

  async function handleConfirmCancel() {
    if (dialog.type !== 'cancel') return;
    setActionLoading(true);
    try {
      const updated = await orpcClient.scheduling.cancelTask({
        id: dialog.task.id,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === dialog.task.id ? (updated as ScheduledTaskSummary) : t,
        ),
      );
    } finally {
      setActionLoading(false);
      setDialog({ type: 'none' });
    }
  }

  async function handleConfirmDelete() {
    if (dialog.type !== 'delete') return;
    setActionLoading(true);
    try {
      await orpcClient.scheduling.deleteTask({ id: dialog.task.id });
      setTasks((prev) => prev.filter((t) => t.id !== dialog.task.id));
    } finally {
      setActionLoading(false);
      setDialog({ type: 'none' });
    }
  }

  const showCreate = dialog.type === 'create';
  const showEdit = dialog.type === 'edit';
  const showForm = showCreate || showEdit;
  const editTask = showEdit ? dialog.task : null;
  const createMeta = showCreate ? CREATE_FORM_META[dialog.createType] : null;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClockIcon className="size-6" />
              Scheduling
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Schedule GitHub operations to run at a future time.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              title="Refresh"
              disabled={loading || refreshing}
              onClick={() => loadTasks(true)}
            >
              <RefreshCwIcon
                className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </Button>

            {!showForm && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <PlusIcon className="size-3.5 mr-1.5" />
                    Schedule
                    <ChevronDownIcon className="size-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setDialog({ type: 'create', createType: 'pr_merge' })
                    }
                  >
                    <GitMergeIcon className="size-4 mr-2" />
                    PR merge
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setDialog({ type: 'create', createType: 'release' })
                    }
                  >
                    <RocketIcon className="size-4 mr-2" />
                    Release
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setDialog({
                        type: 'create',
                        createType: 'workflow_dispatch',
                      })
                    }
                  >
                    <PlayIcon className="size-4 mr-2" />
                    Workflow dispatch
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Create form */}
        {showCreate && createMeta && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {createMeta.icon}
                {createMeta.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dialog.type === 'create' && dialog.createType === 'pr_merge' && (
                <CreatePrMergeForm
                  onSuccess={handleCreateSuccess}
                  onCancel={() => setDialog({ type: 'none' })}
                />
              )}
              {dialog.type === 'create' && dialog.createType === 'release' && (
                <CreateReleaseForm
                  onSuccess={handleCreateSuccess}
                  onCancel={() => setDialog({ type: 'none' })}
                />
              )}
              {dialog.type === 'create' &&
                dialog.createType === 'workflow_dispatch' && (
                  <CreateWorkflowDispatchForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setDialog({ type: 'none' })}
                  />
                )}
            </CardContent>
          </Card>
        )}

        {/* Edit form */}
        {editTask && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PencilIcon className="size-4" />
                Edit scheduled task
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditScheduledTaskForm
                task={editTask}
                onSuccess={handleEditSuccess}
                onCancel={() => setDialog({ type: 'none' })}
              />
            </CardContent>
          </Card>
        )}

        {/* Stats rollup */}
        {!loading && <RollupStats counts={counts} />}

        {/* Task list */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              All
              {tasks.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs px-1.5 py-0"
                >
                  {tasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {pending.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs px-1.5 py-0"
                >
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            {active.length > 0 && (
              <TabsTrigger value="running">
                Running
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs px-1.5 py-0"
                >
                  {active.length}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="space-y-4">
              {/* Upcoming */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
                  Upcoming
                </p>
                <Card>
                  <CardContent className="pt-2 pb-0">
                    {loading ? (
                      <div className="space-y-3 py-3">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-start gap-3 py-2">
                            <Skeleton className="size-4 mt-0.5 rounded" />
                            <div className="flex-1 space-y-1.5">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : upcoming.length === 0 ? (
                      <EmptyState message="No upcoming scheduled tasks. Use the Schedule button to get started." />
                    ) : (
                      <div className="divide-y">
                        {upcoming.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onEdit={(t) => setDialog({ type: 'edit', task: t })}
                            onCancel={(t) =>
                              setDialog({ type: 'cancel', task: t })
                            }
                            onDelete={(t) =>
                              setDialog({ type: 'delete', task: t })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent activity */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
                  Recent activity
                </p>
                <Card>
                  <CardContent className="pt-2 pb-0">
                    {loading ? (
                      <Skeleton className="h-12 w-full rounded my-3" />
                    ) : recentHistory.length === 0 ? (
                      <EmptyState message="No completed tasks yet." />
                    ) : (
                      <div className="divide-y">
                        {recentHistory.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onEdit={() => {}}
                            onCancel={() => {}}
                            onDelete={(t) =>
                              setDialog({ type: 'delete', task: t })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardContent className="pt-2 pb-0">
                {loading ? (
                  <div className="space-y-3 py-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-start gap-3 py-2">
                        <Skeleton className="size-4 mt-0.5 rounded" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pending.length === 0 ? (
                  <EmptyState message="No pending scheduled tasks. Use the Schedule button to get started." />
                ) : (
                  <div className="divide-y">
                    {pending.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onEdit={(t) => setDialog({ type: 'edit', task: t })}
                        onCancel={(t) => setDialog({ type: 'cancel', task: t })}
                        onDelete={(t) => setDialog({ type: 'delete', task: t })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {active.length > 0 && (
            <TabsContent value="running">
              <Card>
                <CardContent className="pt-2 pb-0">
                  <div className="divide-y">
                    {active.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onEdit={() => {}}
                        onCancel={() => {}}
                        onDelete={(t) => setDialog({ type: 'delete', task: t })}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="history">
            <Card>
              <CardContent className="pt-2 pb-0">
                {loading ? (
                  <Skeleton className="h-12 w-full rounded my-3" />
                ) : history.length === 0 ? (
                  <EmptyState message="No completed, failed, or cancelled tasks yet." />
                ) : (
                  <div className="divide-y">
                    {history.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onEdit={() => {}}
                        onCancel={() => {}}
                        onDelete={(t) => setDialog({ type: 'delete', task: t })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog
        open={dialog.type === 'cancel'}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: 'none' });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.type === 'cancel' && (
                <>
                  <strong>{dialog.task.title}</strong> will be cancelled and
                  will not execute.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && (
                <Loader2Icon className="size-3.5 mr-1.5 animate-spin" />
              )}
              Cancel task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={dialog.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: 'none' });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.type === 'delete' && (
                <>
                  <strong>{dialog.task.title}</strong> will be permanently
                  deleted. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && (
                <Loader2Icon className="size-3.5 mr-1.5 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
