import { Command } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { ensureAuthenticated } from '../../lib/auth.js';
import { formatUsageStats } from '../../lib/formatters.js';
import { getOrpcClient } from '../../lib/orpc-client.js';

export default class BillingUsage extends Command {
  static override description = 'Show detailed usage statistics';

  async run(): Promise<void> {
    ensureAuthenticated();

    const spinner = ora('Fetching usage stats...').start();

    try {
      const client = getOrpcClient();
      const result = await (client as any).usage.getStats();
      spinner.stop();

      this.log(chalk.bold('\nUsage Statistics\n'));

      if (result?.monthly != null && result?.limit != null) {
        this.log(
          `  ${formatUsageStats({
            used: result.monthly,
            limit: result.limit,
            tier: result.tier ?? 'free',
          })}`,
        );
      }

      if (result?.session != null) {
        this.log(`  Session:  ${result.session} tool executions`);
      }

      if (result?.resetDate) {
        this.log(
          `  Resets:   ${new Date(result.resetDate).toLocaleDateString()}`,
        );
      }

      this.log();
    } catch (error) {
      spinner.fail('Failed to fetch usage stats');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
