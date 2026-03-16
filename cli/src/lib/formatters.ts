import chalk from 'chalk';
import Table from 'cli-table3';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

const marked = new Marked(markedTerminal() as any);

/**
 * Render markdown text for terminal display.
 */
export function formatMarkdown(text: string): string {
  return (marked.parse(text) as string).trim();
}

/**
 * Render an array of objects as a terminal table.
 */
export function formatTable(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[],
): string {
  if (data.length === 0) return chalk.dim('(no results)');

  const table = new Table({
    head: columns.map((c) => chalk.bold(c.label)),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const row of data) {
    table.push(columns.map((c) => String(row[c.key] ?? '')));
  }

  return table.toString();
}

/**
 * Format a tool execution result for display.
 */
export function formatToolResult(toolName: string, result: unknown): string {
  const header = chalk.cyan(`Tool: ${toolName}`);
  const body =
    typeof result === 'string'
      ? result
      : JSON.stringify(result, null, 2);
  return `${header}\n${body}`;
}

/**
 * Format an error message consistently.
 */
export function formatError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error);
  return chalk.red(`Error: ${message}`);
}

/**
 * Format usage stats as a progress bar.
 */
export function formatUsageStats(stats: {
  used: number;
  limit: number;
  tier: string;
}): string {
  const { used, limit, tier } = stats;
  const percentage = limit > 0 ? Math.min(used / limit, 1) : 0;
  const barWidth = 30;
  const filled = Math.round(barWidth * percentage);
  const empty = barWidth - filled;

  const color =
    percentage >= 0.9
      ? chalk.red
      : percentage >= 0.7
        ? chalk.yellow
        : chalk.green;

  const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const label = limit > 0 ? `${used}/${limit}` : `${used}/∞`;

  return `${chalk.bold(tier)} plan  ${bar}  ${label} tool executions`;
}
