# Audit Trail & Tool Execution Logging

All tool executions are logged for observability and compliance, with admin actions tracked in D1 for the human-in-the-loop approval workflow.

## Analytics Engine Logging

Every tool execution writes an event to the `GH_AGENT_TOOL_CALLS` Analytics Engine dataset:

| Field | Value |
|-------|-------|
| `blob1` | Tool name |
| `blob2` | Outcome (`success` / `error`) |
| `blob3` | User ID |
| `double1` | Execution duration (ms) |
| `index` | Tool name (for filtering) |

Events are written by `#recordToolExecutions()` in `GitHubAgent` after each tool execution. Analytics Engine writes are fire-and-forget (non-blocking by design).

## Admin Actions (D1)

For tools processed through the `AdminActionWorkflow`, records are stored in the `admin_actions` D1 table:

| Column | Purpose |
|--------|---------|
| `id` | Workflow instance ID |
| `user_id` | User who initiated the action |
| `action` | Tool name |
| `description` | Human-readable summary |
| `payload` | Sanitized parameters (JSON) |
| `status` | `pending` → `approved`/`denied` → `completed`/`failed` |
| `approved_by` | User ID (self-approved in current system) |
| `created_at` / `resolved_at` | Timestamps |

### Admin Action Workflow (`server/workflows/admin-action.ts`)
1. Validate user exists in D1
2. Create pending `admin_actions` record
3. `step.waitForEvent('human-approval')` — pauses up to 24 hours
4. On approval: execute action, update status to `completed`
5. On denial/timeout: update status to `denied`/`timed_out`
6. Cleanup: purge resolved records older than 90 days

### Security
- `approveAdminAction` verifies `admin_actions.user_id === session.user.id` before sending approval events (SEC-001 fix)
- Action payloads are sanitized — no raw tokens or secrets stored
- 90-day retention policy on resolved actions (SEC-007 fix)

## Data Access Layer

All admin action queries go through the DAL:

| Function | File |
|----------|------|
| `getUserAdminActions(env, userId)` | `server/data-access-layer/admin-actions.ts` |
| `insertAdminAction(env, ...)` | `server/data-access-layer/admin-actions.ts` |
| `updateAdminActionStatus(env, ...)` | `server/data-access-layer/admin-actions.ts` |
| `getAdminActionById(env, id)` | `server/data-access-layer/admin-actions.ts` |
| `cleanupResolvedActions(env)` | `server/data-access-layer/admin-actions.ts` |

## Key Files

| File | Purpose |
|------|---------|
| `server/durable-objects/github-agent.ts` | `#recordToolExecutions()` — AE writes |
| `server/workflows/admin-action.ts` | `AdminActionWorkflow` — approval workflow |
| `server/data-access-layer/admin-actions.ts` | Admin actions CRUD |
| `server/functions/admin-actions.ts` | `getAdminActions()` server function |
| `server/functions/workflows.ts` | `triggerAdminAction()`, `approveAdminAction()` |
| `server/lib/analytics-engine.ts` | AE query utility |
