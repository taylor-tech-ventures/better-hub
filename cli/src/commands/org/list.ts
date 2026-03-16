import { Command } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { ensureAuthenticated } from '../../lib/auth.js';
import { formatTable } from '../../lib/formatters.js';
import { getOrpcClient } from '../../lib/orpc-client.js';

export default class OrgList extends Command {
  static override description = 'List your GitHub organizations';

  async run(): Promise<void> {
    ensureAuthenticated();

    const spinner = ora('Fetching organizations...').start();

    try {
      const client = getOrpcClient();
      const result = await (client as any).github.getOrgs();
      spinner.stop();

      if (!result || (Array.isArray(result) && result.length === 0)) {
        this.log(chalk.dim('No organizations found.'));
        return;
      }

      const orgs = Array.isArray(result) ? result : [result];

      this.log(
        formatTable(
          orgs.map((org: any) => ({
            name: org.login ?? org.name,
            description: org.description ?? '',
            url: `https://github.com/${org.login ?? org.name}`,
          })),
          [
            { key: 'name', label: 'Organization' },
            { key: 'description', label: 'Description' },
            { key: 'url', label: 'URL' },
          ],
        ),
      );
    } catch (error) {
      spinner.fail('Failed to fetch organizations');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
