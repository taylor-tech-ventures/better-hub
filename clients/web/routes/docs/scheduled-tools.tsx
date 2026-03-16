import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  GitMergeIcon,
  RocketIcon,
  TerminalIcon,
  ZapIcon,
} from 'lucide-react';
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { Separator } from '@/web/components/ui/separator';

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/docs/scheduled-tools')({
  component: ScheduledToolsDocs,
});

// ── Task type catalogue ─────────────────────────────────────────────────────

const TASK_TYPES = [
  {
    icon: <GitMergeIcon className="size-5" />,
    title: 'PR Merge',
    description:
      'Schedule a pull request to be automatically merged at a chosen time. Set the merge method (merge commit, squash, or rebase) and let GH Admin handle the rest — ideal for off-hours deploys.',
    example: 'Merge PR #42 tomorrow at 2 AM using squash-and-merge.',
  },
  {
    icon: <RocketIcon className="size-5" />,
    title: 'Release',
    description:
      'Create a GitHub release with a new tag at a future date. Specify the tag name, target branch or commit, release notes, and whether it should be a draft or pre-release.',
    example: 'Publish v1.4.0 from main on Friday at 10 AM.',
  },
  {
    icon: <ZapIcon className="size-5" />,
    title: 'Workflow Dispatch',
    description:
      'Trigger any dispatchable GitHub Actions workflow at a scheduled time. Pass custom inputs to the workflow just as you would through the GitHub UI.',
    example: 'Run the nightly-cleanup workflow every weekday at midnight.',
  },
  {
    icon: <TerminalIcon className="size-5" />,
    title: 'Custom Tool Call',
    description:
      'Queue any of the 81 AI tools available in the chat for deferred execution. Useful for bulk operations you want to run outside peak hours.',
    example: 'Delete archived repos in a specific org tonight at 11 PM.',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: '1',
    title: 'Open Scheduling',
    body: 'Navigate to Scheduling in the left sidebar of your dashboard.',
  },
  {
    step: '2',
    title: 'Choose a task type',
    body: 'Select from PR Merge, Release, Workflow Dispatch, or Custom Tool Call.',
  },
  {
    step: '3',
    title: 'Configure the task',
    body: 'Fill in the repository, target, and any task-specific parameters (PR number, tag name, workflow ID, etc.).',
  },
  {
    step: '4',
    title: 'Set a schedule',
    body: 'Pick a future date and time. Tasks execute once at that moment — no recurring schedules yet.',
  },
  {
    step: '5',
    title: 'Review & track',
    body: 'Scheduled tasks appear in the Pending tab. You can edit or cancel them before execution. Completed tasks move to History.',
  },
];

// ── Page component ──────────────────────────────────────────────────────────

function ScheduledToolsDocs() {
  const { session } = Route.useRouteContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b px-6 py-3 flex items-center gap-4">
        <TerminalIcon className="size-5 text-primary shrink-0" />
        <span className="text-sm font-semibold">GH Admin</span>
        <Separator orientation="vertical" className="h-4" />
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Docs</span>
          <span>/</span>
          <span className="text-foreground">Scheduled Task Automation</span>
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
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClockIcon className="size-7 text-blue-500" />
            <Badge variant="secondary">Standard &amp; Unlimited</Badge>
          </div>
          <h1 className="text-3xl font-bold">Scheduled Task Automation</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Schedule GitHub operations to run automatically at a future time —
            without staying logged in or monitoring deployments manually. Merge
            PRs, publish releases, and dispatch workflows on your own timeline.
          </p>
        </div>

        <Separator />

        {/* What you can schedule */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">What you can schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TASK_TYPES.map((t) => (
              <Card key={t.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">{t.icon}</span>
                    {t.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70 italic">
                    e.g. {t.example}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="space-y-4">
            {HOW_IT_WORKS_STEPS.map((s) => (
              <li key={s.step} className="flex gap-4">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {s.step}
                </div>
                <div className="pt-0.5 space-y-0.5">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Separator />

        {/* Plan requirements */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Plan requirements</h2>
          <p className="text-sm text-muted-foreground">
            Task scheduling is available on the <strong>Standard</strong>{' '}
            ($19/month) and <strong>Unlimited</strong> ($49/month) plans. It is
            not available on the Free plan.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                plan: 'Standard',
                price: '$19/mo',
                color: '#3b82f6',
                features: [
                  '500 tool executions / month',
                  'Scheduled task automation',
                  'Email support',
                ],
              },
              {
                plan: 'Unlimited',
                price: '$49/mo',
                color: '#8b5cf6',
                features: [
                  'Unlimited tool executions',
                  'Scheduled task automation',
                  'Feature request priority',
                ],
              },
            ].map((p) => (
              <Card
                key={p.plan}
                className="border-2"
                style={{ borderColor: `${p.color}30` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-baseline justify-between">
                    <CardTitle className="text-sm" style={{ color: p.color }}>
                      {p.plan}
                    </CardTitle>
                    <span className="text-sm font-semibold">{p.price}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <CheckIcon
                          className="size-3.5 mt-0.5 shrink-0"
                          style={{ color: p.color }}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-lg border bg-muted/40 p-6 space-y-4 text-center">
          {session ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ready to automate your GitHub workflows?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild>
                  <Link to="/dashboard/scheduling">
                    <CalendarClockIcon className="size-4 mr-2" />
                    Open Scheduling
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard/billing">View plans</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to get started with GH Admin.
              </p>
              <Button asChild>
                <Link to="/">Sign in with GitHub</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
