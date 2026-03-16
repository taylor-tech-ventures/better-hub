import { Command } from '@oclif/core';
import chalk from 'chalk';
import { clearSession, getStoredSession } from '../../lib/auth.js';

export default class AuthLogout extends Command {
  static override description = 'Sign out of gh-admin';

  async run(): Promise<void> {
    const session = getStoredSession();

    if (!session) {
      this.log(chalk.dim('Not currently logged in.'));
      return;
    }

    clearSession();
    this.log(
      chalk.green(`Logged out${session.username ? ` (was ${session.username})` : ''}.`),
    );
  }
}
