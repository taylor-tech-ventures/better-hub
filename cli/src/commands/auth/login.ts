import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import open from 'open';
import ora from 'ora';
import { getApiUrl, storeSession } from '../../lib/auth.js';

export default class AuthLogin extends Command {
  static override description = 'Authenticate with gh-admin via GitHub';

  static override flags = {
    'no-browser': Flags.boolean({
      description: 'Do not open the browser automatically',
      default: false,
    }),
    'api-url': Flags.string({
      description: 'Override the API URL',
      env: 'GH_ADMIN_API_URL',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin);
    const apiUrl = flags['api-url'] ?? getApiUrl();

    // Step 1: Initiate device flow
    const spinner = ora('Initiating device authorization...').start();

    let deviceFlow: {
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      interval: number;
      expiresIn: number;
    };

    try {
      const resp = await fetch(`${apiUrl}/api/orpc/cliAuth.initDeviceFlow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}: ${await resp.text()}`);
      }

      deviceFlow = await resp.json() as typeof deviceFlow;
      spinner.stop();
    } catch (error) {
      spinner.fail('Failed to initiate device flow');
      this.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    // Step 2: Display code and open browser
    this.log();
    this.log(
      chalk.bold('  Enter this code at GitHub to authenticate:'),
    );
    this.log();
    this.log(`    ${chalk.bgWhite.black.bold(` ${deviceFlow.userCode} `)}`);
    this.log();
    this.log(
      chalk.dim(`  Verification URL: ${deviceFlow.verificationUri}`),
    );
    this.log();

    if (!flags['no-browser']) {
      try {
        await open(deviceFlow.verificationUri);
        this.log(chalk.dim('  Browser opened automatically.'));
      } catch {
        this.log(
          chalk.dim('  Could not open browser. Please visit the URL above.'),
        );
      }
    }

    // Step 3: Poll for completion
    const pollSpinner = ora('Waiting for authorization...').start();

    const pollInterval = (deviceFlow.interval ?? 5) * 1000;
    const expiresAt = Date.now() + deviceFlow.expiresIn * 1000;

    while (Date.now() < expiresAt) {
      await new Promise((r) => setTimeout(r, pollInterval));

      try {
        const resp = await fetch(
          `${apiUrl}/api/orpc/cliAuth.pollDeviceFlow`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceCode: deviceFlow.deviceCode,
            }),
          },
        );

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
          const error = (body as any).error ?? '';

          if (error === 'authorization_pending') {
            continue; // Keep polling
          }
          if (error === 'slow_down') {
            await new Promise((r) => setTimeout(r, 5000)); // Extra backoff
            continue;
          }
          if (error === 'expired_token') {
            pollSpinner.fail('Device code expired');
            this.error('The device code has expired. Please try again.');
          }

          throw new Error(`Polling failed: ${resp.status}`);
        }

        const result = await resp.json() as {
          token: string;
          expiresAt: number;
          userId: string;
          username: string;
        };

        pollSpinner.succeed('Authenticated!');

        storeSession({
          token: result.token,
          expiresAt: result.expiresAt,
          userId: result.userId,
          username: result.username,
        });

        this.log();
        this.log(
          chalk.green(`  Logged in as ${chalk.bold(result.username)}`),
        );
        this.log();
        return;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('expired')
        ) {
          throw error;
        }
        // Continue polling on transient errors
      }
    }

    pollSpinner.fail('Authorization timed out');
    this.error('The device code has expired. Please try again.');
  }
}
