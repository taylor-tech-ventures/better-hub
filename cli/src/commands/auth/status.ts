import { Command } from '@oclif/core';
import chalk from 'chalk';
import { getStoredSession, getApiUrl, getConfigPath } from '../../lib/auth.js';

export default class AuthStatus extends Command {
  static override description = 'Show current authentication status';

  async run(): Promise<void> {
    const session = getStoredSession();

    if (!session) {
      this.log(chalk.yellow('Not authenticated.'));
      this.log(chalk.dim('Run `gh-admin auth login` to sign in.'));
      return;
    }

    const expiresIn = session.expiresAt - Date.now();
    const hoursLeft = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)));
    const minutesLeft = Math.max(
      0,
      Math.floor((expiresIn % (1000 * 60 * 60)) / (1000 * 60)),
    );

    this.log(chalk.bold('Authentication Status'));
    this.log();
    this.log(`  User:       ${chalk.green(session.username)}`);
    this.log(`  User ID:    ${chalk.dim(session.userId)}`);
    this.log(
      `  Session:    ${chalk.green('Active')} (${hoursLeft}h ${minutesLeft}m remaining)`,
    );
    this.log(`  API URL:    ${chalk.dim(getApiUrl())}`);
    this.log(`  Config:     ${chalk.dim(getConfigPath())}`);
  }
}
