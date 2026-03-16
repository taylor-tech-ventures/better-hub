import chalk from 'chalk';
import ora from 'ora';
import { formatMarkdown } from './formatters.js';

/**
 * Renders streaming AI responses in the terminal.
 * Handles incremental text display and tool execution spinners.
 */
export class StreamRenderer {
  private buffer = '';
  private spinner: ReturnType<typeof ora> | null = null;
  private isComplete = false;

  /** Write a text delta to the terminal. */
  writeTextDelta(delta: string): void {
    process.stdout.write(delta);
    this.buffer += delta;
  }

  /** Show a spinner while a tool is executing. */
  showToolSpinner(toolName: string): void {
    this.spinner = ora({
      text: chalk.dim(`Executing ${toolName}...`),
      spinner: 'dots',
    }).start();
  }

  /** Stop the tool spinner. */
  stopToolSpinner(toolName: string, success = true): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(chalk.dim(`${toolName} completed`));
      } else {
        this.spinner.fail(chalk.dim(`${toolName} failed`));
      }
      this.spinner = null;
    }
  }

  /** Mark the response as complete and render any buffered markdown. */
  complete(): void {
    this.isComplete = true;
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    // Ensure we end with a newline
    if (this.buffer && !this.buffer.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }

  /** Get the full buffered response text. */
  getBuffer(): string {
    return this.buffer;
  }

  /** Reset for the next message. */
  reset(): void {
    this.buffer = '';
    this.isComplete = false;
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}
