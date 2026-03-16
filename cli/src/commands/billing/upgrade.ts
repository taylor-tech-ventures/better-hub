import { Command } from '@oclif/core';
import chalk from 'chalk';
import open from 'open';
import ora from 'ora';
import { ensureAuthenticated } from '../../lib/auth.js';
import { getOrpcClient } from '../../lib/orpc-client.js';

export default class BillingUpgrade extends Command {
  static override description =
    'Open the billing portal to manage your subscription';

  async run(): Promise<void> {
    ensureAuthenticated();

    const spinner = ora('Opening billing portal...').start();

    try {
      const client = getOrpcClient();
      const result = await (client as any).billing.createPortalSession();

      if (result?.url) {
        spinner.stop();
        this.log(chalk.dim(`Opening: ${result.url}`));
        await open(result.url);
        this.log(chalk.green('Billing portal opened in your browser.'));
      } else {
        spinner.stop();
        this.log(
          chalk.yellow(
            'Could not create billing portal session. Visit https://gh-admin.com/dashboard/billing instead.',
          ),
        );
      }
    } catch (error) {
      spinner.fail('Failed to open billing portal');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
