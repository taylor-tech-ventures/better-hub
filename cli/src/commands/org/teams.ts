import { Command, Args } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { ensureAuthenticated } from '../../lib/auth.js';
import { formatTable } from '../../lib/formatters.js';
import { getOrpcClient } from '../../lib/orpc-client.js';

export default class OrgTeams extends Command {
  static override description = 'List teams in an organization';

  static override args = {
    org: Args.string({
      description: 'Organization name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(OrgTeams);
    ensureAuthenticated();

    const spinner = ora(`Fetching teams for ${args.org}...`).start();

    try {
      const client = getOrpcClient();
      const result = await (client as any).github.getOrgTeams({
        org: args.org,
      });
      spinner.stop();

      const teams = Array.isArray(result) ? result : result?.teams ?? [];

      if (teams.length === 0) {
        this.log(chalk.dim('No teams found.'));
        return;
      }

      this.log(
        formatTable(
          teams.map((team: any) => ({
            name: team.name ?? team.slug,
            privacy: team.privacy ?? '',
            description: team.description ?? '',
            url:
              team.html_url ??
              `https://github.com/orgs/${args.org}/teams/${team.slug}`,
          })),
          [
            { key: 'name', label: 'Team' },
            { key: 'privacy', label: 'Privacy' },
            { key: 'description', label: 'Description' },
            { key: 'url', label: 'URL' },
          ],
        ),
      );
    } catch (error) {
      spinner.fail('Failed to fetch teams');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
