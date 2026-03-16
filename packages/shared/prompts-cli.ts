import { createLogger } from '@/shared/logger';

const promptLogger = createLogger({ module: 'prompts-cli' });

/**
 * CLI-specific OUTPUT FORMATTING section.
 *
 * Replaces the json-render Table instructions with standard markdown tables
 * suitable for terminal rendering. All other sections (identity, methodology,
 * tool usage, scheduling, error handling) come from the shared SYSTEM_PROMPT.
 */
const CLI_OUTPUT_FORMATTING = `## OUTPUT FORMATTING

Always present results in a way that is immediately actionable in a terminal:

- **Markdown tables for lists:** When displaying repositories, teams, users, branches, rulesets, or any list of structured data, use standard markdown table syntax. Never use json-render spec blocks or fenced code blocks for structured data.
- **Full clickable URLs:** Always include the full \`https://github.com/...\` URL for every entity so the user can navigate directly. Construct URLs using the standard GitHub patterns:
  - Repository: \`https://github.com/{owner}/{repo}\`
  - Team: \`https://github.com/orgs/{org}/teams/{team_slug}\`
  - User profile: \`https://github.com/{username}\`
  - Branch: \`https://github.com/{owner}/{repo}/tree/{branch}\`
  - Ruleset: \`https://github.com/{owner}/{repo}/settings/rules/{ruleset_id}\`
  - Organization: \`https://github.com/{org}\`
  - Repository settings: \`https://github.com/{owner}/{repo}/settings\`
- **Table columns by entity type:**
  - Repositories: name, visibility, description, url
  - Teams: name, permission, privacy, url
  - Branches: name, protected, url
  - Users: login, role, url
  - Rulesets: name, target, enforcement, url
- **Operation results:** After executing actions (create, delete, update), display a summary markdown table with a status column showing success or error per item.
- **Compact output:** Keep prose brief and terminal-friendly. Use markdown formatting (bold, inline code) for emphasis.
- **No spec blocks:** Never use json-render spec blocks, \\\`\\\`\\\`spec fences, or JSONL patches. All output must be plain markdown text.
- **Immediate feedback:** Always display the outcome of tool calls immediately after execution — never defer or batch result display.`;

import { BASE_SYSTEM_PROMPT } from '@/shared/prompts';

/**
 * Composes the CLI-specific system prompt.
 *
 * Uses BASE_SYSTEM_PROMPT (shared identity, methodology, error handling,
 * scheduling) and appends CLI_OUTPUT_FORMATTING instead of the web-specific
 * json-render output section. No json-render catalog prompt is included.
 */
export function getCliSystemPrompt(): string {
  promptLogger.debug('composing CLI system prompt');

  return [BASE_SYSTEM_PROMPT, CLI_OUTPUT_FORMATTING].join('\n\n');
}
