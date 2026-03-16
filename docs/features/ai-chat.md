# Feature: AI Chat Interface

The AI chat interface is the primary way to interact with gh-admin. It provides a real-time, conversational interface to all 81 GitHub administration tools. The AI agent understands natural language, resolves ambiguity automatically, and executes multi-step operations with built-in safety gates for destructive actions.

---

## What It Does

- Accepts natural language requests about GitHub organization management
- Executes the correct sequence of tools automatically, asking follow-up questions only when essential information is missing
- Streams structured results in real time — tables, metrics, and charts render as the AI responds
- Pauses for user confirmation before any destructive or irreversible operation
- Maintains full conversation history across page reloads and WebSocket reconnections

---

## How to Access

| Surface | Location |
|---|---|
| Floating drawer | Click the AI button in the top-right of any dashboard page |
| Full-page | Navigate to `/dashboard/chat` |

The floating drawer is available on every dashboard page for quick questions. The full-page view is better for long multi-step operations.

---

## How to Use It

### Asking a question

Type naturally. The agent understands GitHub terminology and will use the right tools automatically:

```
List all repositories in the acme-corp org that haven't been updated in 90 days
```

```
Who has admin access to the payments-service repo?
```

```
How many GitHub Actions minutes has the engineering org used this month?
```

### Multi-step operations

The agent can chain multiple tools in sequence:

```
Create three repos in the backend-team: api-gateway, auth-service, and payments-service.
Add the platform-team as maintainers on all three.
Set up branch protection on main: require 2 reviewers, require status checks.
```

The agent decomposes this into the correct sequence of tool calls and executes them in order.

### Resolving ambiguity

If you belong to multiple organizations and don't specify one, the agent calls `listUserOrgs` and asks you to choose — or selects automatically if only one matches context. It never guesses incorrectly.

```
User: Show me all repos
Agent: You're a member of 3 organizations: acme-corp, backend-team, side-project.
       Which organization would you like to list repositories for?
```

### The Quick-Ask bar

The dashboard command center has a quick-ask bar that sends a prompt directly to the chat interface via a `?q=` URL parameter. Click a suggestion chip or type your own and press Enter to jump straight to the chat with that prompt pre-submitted.

---

## Confirmation Gates

The agent pauses before executing any of the 40 operations that are destructive, additive, or irreversible. When multiple operations in a single response require confirmation, they are grouped into a single card.

**What happens:**
1. The AI describes what it's about to do, including all affected resources
2. An **Approve / Deny** button pair appears (or a grouped card with individual exclusion checkboxes)
3. On Approve, all approved operations execute; on Deny, the agent acknowledges and stops
4. The conversation continues automatically after approval

**Operations always requiring confirmation:**
- Creating, updating, renaming, transferring, or deleting repositories
- Adding or removing users from repositories
- Adding or removing teams from repositories
- Creating, updating, or deleting teams
- Merging pull requests, creating issues, adding labels
- Triggering workflow dispatches
- Updating repository or organization settings
- Enabling security features (Dependabot, secret scanning, code scanning)
- Creating webhooks, releases, or scheduled tasks
- All copy/sync access operations

**Operations that auto-execute without confirmation:**
- All read-only operations (list, get, search, compare, find)
- Stats and reporting queries
- Audit log queries
- Listing secrets, environments, deploy keys (names only, not values)

---

## Output Rendering

The AI renders results using structured components, not plain text walls.

### Tables

Lists of repositories, teams, users, branches, and pull requests render as interactive sortable tables with clickable GitHub URLs. Example output for `list repos in acme-corp`:

| Name | Visibility | Language | Last Updated | URL |
|---|---|---|---|---|
| api-gateway | private | TypeScript | 2026-03-14 | github.com/acme-corp/api-gateway |
| ...

### Metric cards

Single-value results like usage statistics and counts render as metric cards.

### Charts

Trend data (Actions usage, commit activity) renders as bar or line charts.

### Prose + structured blocks

The AI writes prose context above each structured result — explaining what it found, what it did, and any caveats. Results stream in as the AI works, so large operations show progress in real time.

---

## Usage Limits

Tool executions count against your monthly plan limit:

| Plan | Monthly limit |
|---|---|
| Free | 50 tool calls |
| Standard | 500 tool calls |
| Unlimited | No limit |

The chat UI shows your current usage and remaining calls. When you approach the limit, the agent warns you. When the limit is reached, tool calls are blocked and the agent directs you to the billing page.

A single conversational turn can involve many tool calls (e.g., a bulk operation across 20 repos uses 20 tool calls). The agent tells you upfront if an operation will be expensive.

---

## Conversation History

- Full conversation history is stored in the `GitHubAgent` Durable Object SQLite database
- History survives WebSocket disconnects, page reloads, and even DO hibernation
- The conversation context is available to the agent on every turn — no need to repeat context
- Pending tool approvals survive reconnection: if you disconnect mid-approval, the approval buttons reappear after reconnecting

---

## E2E Test Scenarios

### Scenario 1: Read-only query — single org
1. Log in with a GitHub account that belongs to at least one organization
2. Open the AI chat drawer
3. Type: `List all repositories in [org]`
4. **Expect:** No confirmation gate; agent calls `listOrgRepos`, table renders with repo names, visibility, and URLs; no usage warning

### Scenario 2: Read-only query — org auto-selection
1. Log in with an account that belongs to exactly one organization
2. Type: `Show me all teams`
3. **Expect:** Agent auto-resolves the org (no disambiguation prompt); calls `listOrgTeams`; table renders

### Scenario 3: Disambiguation prompt
1. Log in with an account that belongs to multiple organizations
2. Type: `Show me all repos`
3. **Expect:** Agent calls `listUserOrgs` first; responds asking which org; selecting one triggers `listOrgRepos`

### Scenario 4: Destructive operation — single tool
1. Type: `Delete the test-repo repository from [org]`
2. **Expect:** Agent describes the operation; Approve/Deny buttons appear; clicking Deny → agent acknowledges and stops; clicking Approve → `deleteGitHubRepos` executes; agent confirms deletion

### Scenario 5: Grouped confirmation — multiple tools
1. Type: `Remove user john-doe from all repos in the backend-team and remove them from the platform team`
2. **Expect:** Agent calls `listOrgRepos` to enumerate repos; groups all `removeGitHubUsersFromRepos` + `removeGitHubUsersFromTeams` calls into a single confirmation card; individual checkboxes allow excluding specific repos; Approve executes all selected

### Scenario 6: Multi-step operation
1. Type: `Create a repo called test-feature in [org], make it private, and add the devops-team as maintainers`
2. **Expect:** Agent creates confirmation card for `createGitHubRepo` + `addGitHubTeamsToRepos`; after approval, executes sequentially; reports success for each step

### Scenario 7: Usage limit approach
1. Use a Free-tier account with 45/50 tool calls used
2. Type: `List all repos in [org]`
3. **Expect:** Tool executes; usage counter increments; warning appears in UI when ≥80% used

### Scenario 8: Usage limit reached
1. Use a Free-tier account with 50/50 tool calls used
2. Type any tool-requiring prompt
3. **Expect:** Agent responds that the monthly limit is reached; provides link to upgrade; no tool executes

### Scenario 9: Conversation history persistence
1. Have a multi-turn conversation with the agent
2. Reload the page
3. **Expect:** Full conversation history is restored; agent retains context from earlier turns

### Scenario 10: Pending approval survival
1. Start a destructive operation; when confirmation buttons appear, disconnect Wi-Fi
2. Reconnect and reload
3. **Expect:** Approval buttons reappear for the pending operation

---

## Technical Reference

| Component | Location |
|---|---|
| Chat WebSocket connection | `useAgent({ agent: 'GitHubAgent', name: userId })` |
| Message streaming | `useAgentChat` from `@cloudflare/ai-chat/react` |
| AI model | `gpt-5-mini` (configured in `packages/shared/prompts.ts`) |
| Tool contracts | `server/agent/tools/contracts.ts` |
| Tool execution | `server/agent/tools/definitions.ts` + `server/agent/tools/index.ts` |
| System prompt | `getSystemPrompt()` in `packages/shared/prompts.ts` |
| Structured output rendering | `@json-render/react` + `explorerCatalog` in `clients/web/json-render/registry.tsx` |
| Tool confirmation UI | `clients/web/components/ui/chat/tool-group-confirmation.tsx` |
| Full-page chat route | `clients/web/routes/dashboard/chat.tsx` (SSR disabled) |
| Chat drawer | `clients/web/components/layout/AiDrawer.tsx` (lazy-mounted) |
