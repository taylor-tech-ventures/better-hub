import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  ArrowUpRightIcon,
  BarChart2Icon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminAnalytics } from '@/server/functions/admin-analytics';
import { getAdminAnalytics } from '@/server/functions/admin-analytics';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/web/components/ui/avatar';
import { Badge } from '@/web/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { MonthNav } from '@/web/components/ui/month-nav';
import { planColor, planLabel } from '@/web/lib/plan-colors';
import { userInitials } from '@/web/lib/utils';

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard/admin')({
  beforeLoad: ({ context }) => {
    const session = context.session;
    if (!session) throw redirect({ to: '/' });
    if (session.user.role !== 'admin') throw redirect({ to: '/dashboard' });
  },
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === 'string' ? search.month : undefined,
  }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: async ({ deps }) => {
    const yearMonth = deps.month ?? new Date().toISOString().slice(0, 7);
    const data = await getAdminAnalytics({ data: yearMonth });
    return data;
  },
  component: AdminDashboard,
});

// ── Page component ─────────────────────────────────────────────────────────

function AdminDashboard() {
  const data = Route.useLoaderData() as AdminAnalytics | null;
  const { month } = Route.useSearch();
  const navigate = Route.useNavigate();
  const yearMonth = month ?? new Date().toISOString().slice(0, 7);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          No data available for this period.
        </p>
      </div>
    );
  }

  const totalExecutions = data.topTools.reduce((s, t) => s + t.total, 0);
  const totalUsers = data.planCounts.reduce((s, p) => s + p.userCount, 0);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Usage, billing, and engagement rollup
            </p>
          </div>
          <MonthNav
            yearMonth={yearMonth}
            onNavigate={(ym) =>
              navigate({ search: { month: ym }, replace: true })
            }
          />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <ZapIcon className="size-3.5" />
                Tool Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalExecutions.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                across {data.powerUsers.length} active users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <UsersIcon className="size-3.5" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalUsers.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                registered accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <BarChart2Icon className="size-3.5" />
                Unique Tools Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.topTools.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                distinct tool types
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly trend chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUpIcon className="size-4" />
              Execution Trend
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — last 12 months
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyTrends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No execution history found.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data.monthlyTrends}
                  margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) =>
                      new Date(`${v}-01`).toLocaleDateString('en-US', {
                        month: 'short',
                        year: '2-digit',
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      'Executions',
                    ]}
                    labelFormatter={(label: string) =>
                      new Date(`${label}-01`).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })
                    }
                  />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top tools — horizontal bar chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Most Popular Tools</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topTools.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tool executions recorded this period.
                </p>
              ) : (
                (() => {
                  const maxCount = Math.max(
                    ...data.topTools.map((t) => t.total),
                  );
                  return (
                    <ol className="space-y-2.5">
                      {data.topTools.map((tool, i) => (
                        <li
                          key={tool.toolName}
                          className="flex items-center gap-3"
                        >
                          <span className="text-xs text-muted-foreground w-4 text-right shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-mono truncate">
                                {tool.toolName}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {tool.total.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                  width: `${(tool.total / maxCount) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Plan distribution — pie chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Plan Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {data.planCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No users found.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.planCounts}
                        dataKey="userCount"
                        nameKey="plan"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {data.planCounts.map((entry) => (
                          <Cell key={entry.plan} fill={planColor(entry.plan)} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} users`,
                          planLabel(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <ul className="mt-2 space-y-1">
                    {data.planCounts.map((p) => (
                      <li
                        key={p.plan}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full inline-block"
                            style={{ background: planColor(p.plan) }}
                          />
                          {planLabel(p.plan)}
                        </span>
                        <span className="font-medium text-foreground">
                          {p.userCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Power users table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UsersIcon className="size-4" />
              Power Users
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — top by tool executions this period
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.powerUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No usage recorded this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left pb-2 pr-4 font-medium">User</th>
                      <th className="text-left pb-2 pr-4 font-medium">Plan</th>
                      <th className="text-right pb-2 font-medium">
                        Executions
                      </th>
                      <th className="text-right pb-2 pl-4 font-medium">
                        GitHub
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.powerUsers.map((user) => (
                      <tr key={user.userId} className="group">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-7 shrink-0">
                              <AvatarImage
                                src={user.image ?? undefined}
                                alt={user.name}
                              />
                              <AvatarFallback className="text-[10px]">
                                {userInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                            style={{
                              borderColor: planColor(user.plan),
                              color: planColor(user.plan),
                            }}
                          >
                            {user.plan}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right font-mono font-medium">
                          {user.totalExecutions.toLocaleString()}
                        </td>
                        <td className="py-2.5 pl-4 text-right">
                          <a
                            href={`https://github.com/${user.login}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            @{user.login}
                            <ArrowUpRightIcon className="size-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
