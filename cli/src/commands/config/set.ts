import { Command, Args } from '@oclif/core';
import chalk from 'chalk';
import { config } from '../../lib/auth.js';

const ALLOWED_KEYS = ['apiUrl'] as const;

export default class ConfigSet extends Command {
  static override description = 'Set a CLI configuration value';

  static override args = {
    key: Args.string({
      description: `Configuration key (${ALLOWED_KEYS.join(', ')})`,
      required: true,
    }),
    value: Args.string({
      description: 'Configuration value',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigSet);

    if (!ALLOWED_KEYS.includes(args.key as any)) {
      this.error(
        `Unknown config key: ${args.key}. Valid keys: ${ALLOWED_KEYS.join(', ')}`,
      );
    }

    config.set(args.key as any, args.value);
    this.log(chalk.green(`Set ${args.key} = ${args.value}`));
  }
}
