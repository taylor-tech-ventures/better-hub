import { Command } from '@oclif/core';
import chalk from 'chalk';
import { config, getApiUrl, getConfigPath } from '../../lib/auth.js';

export default class ConfigList extends Command {
  static override description = 'List all CLI configuration';

  async run(): Promise<void> {
    this.log(chalk.bold('CLI Configuration\n'));
    this.log(`  Config file:  ${chalk.dim(getConfigPath())}`);
    this.log(`  API URL:      ${getApiUrl()}`);

    const allConfig = config.store;
    const keys = Object.keys(allConfig).filter((k) => k !== 'session');

    if (keys.length > 0) {
      this.log();
      for (const key of keys) {
        this.log(`  ${key}: ${String(allConfig[key as keyof typeof allConfig])}`);
      }
    }
  }
}
