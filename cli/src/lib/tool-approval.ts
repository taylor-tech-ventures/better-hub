import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { toolNeedsApproval } from '../../../shared/config/tool-approval.js';
import type { ToolCallEvent } from './ws-chat-client.js';

/**
 * Destructive tool names that warrant a red warning vs yellow for additive.
 */
const DESTRUCTIVE_TOOLS = new Set([
  'deleteGitHubRepos',
  'removeGitHubUsersFromRepos',
  'removeGitHubTeamsFromRepos',
  'removeGitHubUsersFromTeams',
  'deleteGitHubBranchOnRepo',
  'updateGitHubRepos',
  'updateGitHubRepoRuleset',
  'deleteGitHubRepoRuleset',
]);

/**
 * Prompt the user to approve or deny a tool call.
 * Returns true if approved, false if denied.
 */
export async function promptToolApproval(
  event: ToolCallEvent,
  options: { autoApprove?: boolean } = {},
): Promise<boolean> {
  if (options.autoApprove) return true;
  if (!toolNeedsApproval(event.toolName)) return true;

  const isDestructive = DESTRUCTIVE_TOOLS.has(event.toolName);
  const color = isDestructive ? chalk.red : chalk.yellow;
  const label = isDestructive ? 'DESTRUCTIVE' : 'APPROVAL REQUIRED';

  console.log();
  console.log(color.bold(`  [${label}] ${event.toolName}`));

  // Display tool args in a readable format
  const argsStr = JSON.stringify(event.args, null, 2);
  for (const line of argsStr.split('\n')) {
    console.log(chalk.dim(`    ${line}`));
  }

  console.log();

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = isDestructive
      ? color('  Approve? (y/N): ')
      : color('  Approve? (Y/n): ');

    rl.question(prompt, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();

      if (isDestructive) {
        // Destructive: default to deny
        resolve(normalized === 'y' || normalized === 'yes');
      } else {
        // Additive: default to approve
        resolve(normalized !== 'n' && normalized !== 'no');
      }
    });
  });
}
