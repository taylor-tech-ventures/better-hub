import { Command } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { ensureAuthenticated } from '../../lib/auth.js';
import { formatUsageStats } from '../../lib/formatters.js';
import { getOrpcClient } from '../../lib/orpc-client.js';

export default class BillingStatus extends Command {
  static override description = 'Show current billing plan and usage';

  async run(): Promise<void> {
    ensureAuthenticated();

    const spinner = ora('Fetching billing info...').start();

    try {
      const client = getOrpcClient();
      const result = await (client as any).billing.getStatus();
      spinner.stop();

      this.log(chalk.bold('\nBilling Status\n'));

      if (result?.plan) {
        this.log(`  Plan:     ${chalk.bold(result.plan)}`);
      }
      if (result?.status) {
        this.log(`  Status:   ${chalk.green(result.status)}`);
      }
      if (result?.periodEnd) {
        this.log(
          `  Renews:   ${new Date(result.periodEnd).toLocaleDateString()}`,
        );
      }

      if (result?.usage != null && result?.limit != null) {
        this.log();
        this.log(
          `  ${formatUsageStats({
            used: result.usage,
            limit: result.limit,
            tier: result.plan ?? 'free',
          })}`,
        );
      }

      this.log();
    } catch (error) {
      spinner.fail('Failed to fetch billing info');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
