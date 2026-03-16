import { createInterface } from 'node:readline';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { ensureAuthenticated } from '../../lib/auth.js';
import { formatMarkdown, formatUsageStats } from '../../lib/formatters.js';
import { StreamRenderer } from '../../lib/stream-renderer.js';
import { promptToolApproval } from '../../lib/tool-approval.js';
import { WsChatClient } from '../../lib/ws-chat-client.js';

export default class Chat extends Command {
  static override description =
    'Start an interactive AI chat session for GitHub administration';

  static override flags = {
    prompt: Flags.string({
      char: 'p',
      description:
        'Single-shot mode: send one message, get response, and exit',
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Auto-approve all tool executions',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Chat);
    const session = ensureAuthenticated();

    const client = new WsChatClient({ autoApprove: flags.yes });
    const renderer = new StreamRenderer();

    // Set up event handlers
    client.on('text-delta', (delta: string) => {
      renderer.writeTextDelta(delta);
    });

    client.on('text', (text: string) => {
      // Full text replacement — typically not used in streaming mode
    });

    client.on('tool-call', async (event) => {
      if (event.state === 'approval-requested') {
        const approved = await promptToolApproval(event, {
          autoApprove: flags.yes,
        });
        await client.approveToolCall(event.toolCallId, approved);

        if (approved) {
          renderer.showToolSpinner(event.toolName);
        } else {
          console.log(chalk.dim(`  ${event.toolName} denied.`));
        }
      } else if (event.state === 'call') {
        renderer.showToolSpinner(event.toolName);
      }
    });

    client.on('tool-result', (event) => {
      renderer.stopToolSpinner(event.toolCallId);
    });

    client.on('message-complete', () => {
      renderer.complete();
    });

    client.on('error', (error: Error) => {
      console.error(chalk.red(`\nConnection error: ${error.message}`));
    });

    client.on('disconnected', () => {
      console.log(chalk.dim('\nDisconnected from server.'));
    });

    // Connect
    try {
      await client.connect();
    } catch (error) {
      this.error(
        `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Single-shot mode
    if (flags.prompt) {
      renderer.reset();
      await client.sendMessage(flags.prompt);

      // Wait for completion
      await new Promise<void>((resolve) => {
        client.on('message-complete', () => {
          resolve();
        });
        // Timeout after 2 minutes
        setTimeout(() => resolve(), 120_000);
      });

      client.disconnect();
      return;
    }

    // Interactive mode
    this.log(chalk.bold('\ngh-admin AI Chat'));
    this.log(
      chalk.dim(
        `Connected as ${session.username}. Type your message and press Enter.`,
      ),
    );
    this.log(chalk.dim('Ctrl+C to interrupt, Ctrl+D to exit.\n'));

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue('> '),
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const message = line.trim();
      if (!message) {
        rl.prompt();
        return;
      }

      renderer.reset();
      console.log(); // blank line before response

      try {
        await client.sendMessage(message);

        // Wait for response to complete before prompting again
        await new Promise<void>((resolve) => {
          const onComplete = () => {
            client.removeListener('message-complete', onComplete);
            resolve();
          };
          client.on('message-complete', onComplete);
          // Timeout after 2 minutes
          setTimeout(() => {
            client.removeListener('message-complete', onComplete);
            resolve();
          }, 120_000);
        });
      } catch (error) {
        console.error(
          chalk.red(
            `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
      }

      console.log(); // blank line after response
      rl.prompt();
    });

    rl.on('close', () => {
      console.log(chalk.dim('\nGoodbye!'));
      client.disconnect();
      process.exit(0);
    });
  }
}
