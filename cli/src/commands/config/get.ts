import { Command, Args } from '@oclif/core';
import chalk from 'chalk';
import { config } from '../../lib/auth.js';

export default class ConfigGet extends Command {
  static override description = 'Get a CLI configuration value';

  static override args = {
    key: Args.string({
      description: 'Configuration key',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigGet);
    const value = config.get(args.key as any);

    if (value === undefined) {
      this.log(chalk.dim(`${args.key} is not set`));
    } else {
      this.log(`${args.key} = ${String(value)}`);
    }
  }
}
