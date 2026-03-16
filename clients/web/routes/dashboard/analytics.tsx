import { createFileRoute, redirect } from '@tanstack/react-router';
import { BarChart2Icon, TrendingUpIcon, ZapIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { UserAnalytics } from '@/server/functions/user-analytics';
import { getUserAnalytics } from '@/server/functions/user-analytics';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { MonthNav } from '@/web/components/ui/month-nav';

// ── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard/analytics')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/' });
  },
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === 'string' ? search.month : undefined,
  }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: async ({ deps }) => {
    const yearMonth = deps.month ?? new Date().toISOString().slice(0, 7);
    return getUserAnalytics({ data: yearMonth });
  },
  component: UserAnalyticsDashboard,
});

// ── Colour helpers ─────────────────────────────────────────────────────────

/** Assigns a consistent colour to each tool based on its index. */
const TOOL_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
];

function toolColor(index: number): string {
  return TOOL_COLORS[index % TOOL_COLORS.length] ?? '#6b7280';
}

// ── Custom tooltip for trend chart ─────────────────────────────────────────

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const monthLabel = label
    ? new Date(`${label}-01`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : label;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{monthLabel}</p>
      <p className="text-muted-foreground">
        {(payload[0]?.value ?? 0).toLocaleString()} executions
      </p>
    </div>
  );
}

// ── Page component ─────────────────────────────────────────────────────────

function UserAnalyticsDashboard() {
  const data = Route.useLoaderData() as UserAnalytics | null;
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

  const uniqueTools = data.topTools.length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Usage</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your AI tool execution history
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <ZapIcon className="size-3.5" />
                Tool Executions This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {data.totalExecutions.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                in{' '}
                {new Date(`${yearMonth}-01`).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
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
              <p className="text-3xl font-bold">{uniqueTools}</p>
              <p className="text-xs text-muted-foreground mt-1">
                distinct tool types this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly trend chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUpIcon className="size-4" />
              Monthly Trend
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — last 12 months
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No execution history found.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data.monthlyTotals}
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
                    width={32}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top tools chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Most Used Tools This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topTools.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No tool executions recorded this period.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(180, data.topTools.length * 36)}
              >
                <BarChart
                  data={data.topTools}
                  layout="vertical"
                  margin={{ left: 8, right: 8, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="toolName"
                    type="category"
                    width={170}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      'Executions',
                    ]}
                  />
                  <Bar dataKey="total" radius={[0, 3, 3, 0]}>
                    {data.topTools.map((_, index) => (
                      <Cell
                        key={`cell-${
                          // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for recharts Cell
                          index
                        }`}
                        fill={toolColor(index)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tool breakdown table */}
        {data.topTools.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tool Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left pb-2 pr-4 font-medium">Tool</th>
                      <th className="text-right pb-2 font-medium">
                        Executions
                      </th>
                      <th className="text-right pb-2 pl-4 font-medium">
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topTools.map((tool, index) => {
                      const pct =
                        data.totalExecutions > 0
                          ? (tool.total / data.totalExecutions) * 100
                          : 0;
                      return (
                        <tr key={tool.toolName} className="group">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-sm shrink-0"
                                style={{ background: toolColor(index) }}
                              />
                              <span className="font-mono font-medium">
                                {tool.toolName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-mono font-medium">
                            {tool.total.toLocaleString()}
                          </td>
                          <td className="py-2.5 pl-4 text-right text-muted-foreground">
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
