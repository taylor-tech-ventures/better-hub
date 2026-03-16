import { Command, Args } from '@oclif/core';
import chalk from 'chalk';
import ora from 'ora';
import { ensureAuthenticated } from '../../lib/auth.js';
import { formatTable } from '../../lib/formatters.js';
import { getOrpcClient } from '../../lib/orpc-client.js';

export default class OrgRepos extends Command {
  static override description = 'List repositories in an organization';

  static override args = {
    org: Args.string({
      description: 'Organization name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(OrgRepos);
    ensureAuthenticated();

    const spinner = ora(`Fetching repos for ${args.org}...`).start();

    try {
      const client = getOrpcClient();
      const result = await (client as any).github.getOrgRepos({
        org: args.org,
      });
      spinner.stop();

      const repos = Array.isArray(result) ? result : result?.repos ?? [];

      if (repos.length === 0) {
        this.log(chalk.dim('No repositories found.'));
        return;
      }

      this.log(
        formatTable(
          repos.map((repo: any) => ({
            name: repo.name,
            visibility: repo.visibility ?? (repo.private ? 'private' : 'public'),
            description: repo.description ?? '',
            url: repo.html_url ?? `https://github.com/${args.org}/${repo.name}`,
          })),
          [
            { key: 'name', label: 'Repository' },
            { key: 'visibility', label: 'Visibility' },
            { key: 'description', label: 'Description' },
            { key: 'url', label: 'URL' },
          ],
        ),
      );
    } catch (error) {
      spinner.fail('Failed to fetch repositories');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
