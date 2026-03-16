# Feature: Scheduled Tasks

Scheduled tasks let you queue GitHub operations to run at a specific future time. Instead of staying online to trigger a merge, cut a release, or dispatch a workflow at exactly the right moment, you tell the AI when you want it done and walk away.

---

## What It Does

- Schedule a pull request merge for a specific date and time
- Schedule a release (with tag, title, and notes) to be created at a chosen time
- Schedule a workflow dispatch with optional inputs
- View and manage all pending scheduled tasks
- Cancel pending tasks before they execute

---

## Supported Task Types

### Pull Request Merge

Merge a specific pull request at a future time, with your choice of merge strategy.

**Parameters:**
- Repository (org/repo)
- Pull request number
- Merge method: `merge`, `squash`, or `rebase`
- Scheduled time (ISO 8601 or natural language)
- Optional: commit title and message (for squash merges)

**Example prompt:**
```
Schedule a squash merge of PR #142 in acme-corp/api-gateway for tonight at 11pm UTC
```

### Release Creation

Create a GitHub release (and optionally tag) at a specific time — useful for coordinated deployment windows.

**Parameters:**
- Repository (org/repo)
- Tag name (new tag or existing)
- Release title
- Release body / notes
- Scheduled time
- Optional: draft flag, prerelease flag, target branch/SHA

**Example prompt:**
```
Create a release v2.4.0 in acme-corp/payments-service next Monday at 9am EST
with the title "Payments v2.4.0" and notes "Adds retry logic and improved logging"
```

### Workflow Dispatch

Trigger a GitHub Actions workflow dispatch event at a future time — useful for scheduling deployments, batch jobs, or maintenance tasks.

**Parameters:**
- Repository (org/repo)
- Workflow name or ID
- Branch or ref
- Scheduled time
- Optional: workflow inputs (key/value pairs)

**Example prompt:**
```
Schedule a dispatch of the deploy-to-production workflow in acme-corp/api-gateway
on the main branch this Friday at 2pm UTC with environment=production
```

---

## How to Schedule a Task

Ask the AI in natural language. Time expressions are interpreted relative to UTC unless you specify a timezone:

```
Merge PR #88 in backend-org/auth-service via squash at 3am UTC on March 20th
```

```
Schedule the nightly-cleanup workflow in ops-team/infra-tools to run every day
at 2am UTC starting tomorrow [note: one-off scheduling; for recurring, use
GitHub's native cron triggers]
```

The agent confirms the schedule and creates the task. A confirmation gate appears because scheduling is an approval-required operation.

**After scheduling**, the agent responds with:
- Task ID
- Exact scheduled time (ISO 8601)
- What will happen
- How to cancel it

---

## Viewing Scheduled Tasks

```
Show me all my scheduled tasks
```

```
List pending scheduled tasks for the acme-corp org
```

The agent calls `listScheduledTasks` and renders a table:

| ID | Type | Target | Scheduled For | Status |
|---|---|---|---|---|
| task_abc | PR Merge | acme-corp/api-gateway #142 | 2026-03-16 23:00 UTC | pending |
| task_def | Release | acme-corp/payments v2.4.0 | 2026-03-20 09:00 EST | pending |
| task_ghi | Workflow | ops-team/infra-tools:deploy | 2026-03-17 02:00 UTC | completed |

---

## Cancelling a Task

```
Cancel scheduled task task_abc
```

```
Cancel the PR merge I scheduled for tonight
```

The agent calls `cancelScheduledTask` — no confirmation gate required for cancellations. The task is marked as cancelled and will not execute.

If the task has already started executing when you attempt to cancel, the cancellation may not take effect. The agent will inform you of the current status.

---

## Task Execution

Tasks execute via **Cloudflare Workflows** (`AdminActionWorkflow`). At the scheduled time:

1. The workflow wakes up and validates the task record still exists and is in `pending` state
2. It retrieves the user's GitHub token from the `GitHubAgent` DO
3. It executes the operation (merge, release creation, or workflow dispatch) via the GitHub API
4. It updates the task status to `completed` or `failed`
5. If the task fails (e.g., PR was already merged, branch was deleted, token expired), the failure is recorded with the error details

You can view completed and failed tasks via `listScheduledTasks`.

---

## Important Constraints

- **Non-destructive only:** Only non-destructive or recoverable operations are schedulable. You cannot schedule a repo deletion or user removal.
- **Token validity:** Your GitHub OAuth token must be valid at execution time. Tokens expire after 8 hours if not refreshed; if your session is inactive when the task runs, the token may be expired. The agent warns you about this.
- **One-off only:** Tasks are one-time executions. For recurring operations, use GitHub Actions native cron scheduling.
- **Time precision:** Tasks execute within ~1 minute of the scheduled time.
- **Timezone:** All times are stored in UTC internally. Specify your timezone in the prompt ("2pm New York time") and the agent converts automatically.

---

## E2E Test Scenarios

### Scenario 1: Schedule a PR merge
1. Create a test PR in the test org
2. Prompt: `Schedule a merge of PR #[number] in [test org]/[repo] for 2 minutes from now, squash merge`
3. **Expect:** Confirmation gate appears with PR number, repo, merge method, and time; after approval, task is created; `listScheduledTasks` shows the task as pending

### Scenario 2: Wait for execution
1. Continue from Scenario 1; wait 2+ minutes
2. Prompt: `Show my scheduled tasks`
3. **Expect:** Task status is `completed`; verify in GitHub that PR was merged with squash

### Scenario 3: Cancel before execution
1. Schedule a task for 10 minutes in the future
2. Immediately after: `Cancel that scheduled task`
3. **Expect:** `cancelScheduledTask` executes without confirmation; task status changes to `cancelled`; task does not execute at scheduled time

### Scenario 4: Schedule a release
1. Prompt: `Create a release v99.0.0-test in [test org]/[test repo] in 3 minutes, title "E2E Test Release", mark as prerelease`
2. **Expect:** Confirmation gate with release details; after approval, task created; after 3 minutes, release appears in GitHub

### Scenario 5: Schedule a workflow dispatch
1. Prompt: `Dispatch the [workflow name] workflow in [test org]/[test repo] on the main branch in 2 minutes`
2. **Expect:** Confirmation gate; task created; after 2 minutes, workflow run appears in GitHub Actions

### Scenario 6: Task failure — PR already merged
1. Schedule a PR merge, then manually merge the PR via GitHub before the scheduled time
2. Wait for the scheduled time to pass
3. Prompt: `Show my recent scheduled tasks`
4. **Expect:** Task status is `failed`; error message indicates PR was already merged

### Scenario 7: List with filter by status
1. Have a mix of pending, completed, and failed tasks
2. Prompt: `Show only my pending scheduled tasks`
3. **Expect:** Only tasks with `pending` status are shown in the table

### Scenario 8: Natural language time parsing
1. Prompt: `Schedule a workflow dispatch tomorrow morning at 8am Pacific time`
2. **Expect:** Agent correctly interprets "tomorrow morning at 8am Pacific" and converts to UTC; confirmation card shows the correct UTC time

---

## Technical Reference

| Component | Location |
|---|---|
| Task type schemas | `server/orpc/routes/scheduling.ts` |
| Task execution workflow | `server/workflows/admin-action.ts` |
| Scheduling tool contract | `server/agent/tools/contracts.ts` → `scheduleTaskContract` |
| D1 schema | `server/db/schemas/` → `scheduled_tasks` table |
| `scheduleTask` tool | Requires confirmation (in `TOOLS_REQUIRING_APPROVAL`) |
| `listScheduledTasks` | Auto-approved |
| `cancelScheduledTask` | Auto-approved |
| `deleteScheduledTask` | Auto-approved |
