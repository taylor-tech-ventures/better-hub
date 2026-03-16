# Feature: Webhook Automation

Webhook automation lets you define rules that react to GitHub events automatically. When something happens in your org — a repo is created, a team is deleted, someone pushes to main — gh-admin checks your rules and executes the configured actions without you having to do anything.

This transforms gh-admin from a reactive tool into a proactive governance platform.

---

## What It Does

- Listen for GitHub webhook events forwarded to gh-admin
- Evaluate user-defined rules: each rule has an event type filter and optional field conditions
- Execute configured actions automatically when a rule matches
- Log every event with match status, actions taken, and outcomes

---

## How It Works

```
GitHub Org
    │
    └─ Webhook → https://gh-admin.com/api/webhooks/github
                         │
                         ▼
              Validate HMAC-SHA256 signature
                         │
                         ▼
              Match event against your rules
                         │
              ┌──────────┴──────────┐
          Matches?               No match
              │                     │
              ▼                     ▼
          Execute actions       Log and discard
              │
              ▼
          Log result
```

---

## Setting Up GitHub Webhooks

To use webhook automation, you need to configure a webhook in your GitHub organization pointing to gh-admin's ingestion endpoint:

1. Go to your GitHub organization → **Settings** → **Webhooks** → **Add webhook**
2. Set Payload URL to: `https://gh-admin.com/api/webhooks/github`
3. Content type: `application/json`
4. Secret: generate a secure random string and paste it — you'll use this same value as `GITHUB_WEBHOOK_SECRET` in gh-admin
5. Select events: choose the events you want to react to (or "Send me everything")
6. Click **Add webhook**

---

## Supported Event Types

| Event | Description |
|---|---|
| `repository.created` | A new repository was created in the org |
| `repository.deleted` | A repository was deleted from the org |
| `branch_protection_rule.deleted` | A branch protection rule was deleted |
| `member.added` | A user was added to the org |
| `member.removed` | A user was removed from the org |
| `team.created` | A new team was created |
| `team.deleted` | A team was deleted |
| `push` | A push was made to a branch |

---

## Rule Conditions

Each rule can have zero or more conditions that must all match for the rule to trigger:

| Operator | Meaning | Example |
|---|---|---|
| `equals` | Field value exactly matches | `repository.name equals "payments-service"` |
| `not_equals` | Field value does not match | `repository.visibility not_equals "public"` |
| `contains` | Field value contains substring | `repository.name contains "legacy"` |
| `matches` | Field value matches regex | `repository.name matches "^api-.*"` |

**Field paths** use dot notation to navigate the webhook payload. Common fields:

| Event | Useful fields |
|---|---|
| `repository.*` | `repository.name`, `repository.visibility`, `repository.default_branch` |
| `member.*` | `member.login`, `action` |
| `sender.*` | `sender.login` |
| `team.*` | `team.name`, `team.slug` |
| `push` | `ref`, `pusher.name`, `repository.name` |

---

## Actions

When a rule matches, one or more actions execute automatically:

| Action type | Description | Parameters |
|---|---|---|
| `add_labels` | Add labels to a repository | `labels: string[]` |
| `add_team` | Add a team to a repository | `team: string`, `permission: string` |
| `add_branch_protection` | Apply a branch protection ruleset | `ruleset_id: string` |
| `notify` | Log a notification (audit trail entry) | `message: string` |

Actions execute in parallel. If one action fails, the others still execute. All results are logged.

---

## Example Rules

### Auto-add platform team to new repos
```json
{
  "name": "Platform team on new repos",
  "eventType": "repository.created",
  "conditions": [],
  "actions": [
    {
      "type": "add_team",
      "params": { "team": "platform-team", "permission": "push" }
    }
  ]
}
```
Triggers on every new repository, with no conditions — adds the platform team automatically.

### Alert when branch protection is removed
```json
{
  "name": "Branch protection deleted alert",
  "eventType": "branch_protection_rule.deleted",
  "conditions": [],
  "actions": [
    {
      "type": "notify",
      "params": { "message": "Branch protection rule deleted on {{repository.name}} by {{sender.login}}" }
    }
  ]
}
```

### Label repos created by non-eng teams
```json
{
  "name": "Tag non-engineering repos",
  "eventType": "repository.created",
  "conditions": [
    {
      "field": "sender.login",
      "operator": "not_equals",
      "value": "eng-bot"
    }
  ],
  "actions": [
    {
      "type": "add_labels",
      "params": { "labels": ["needs-review", "new-repo"] }
    }
  ]
}
```

### Add branch protection to main on every new private repo
```json
{
  "name": "Auto branch protection on private repos",
  "eventType": "repository.created",
  "conditions": [
    {
      "field": "repository.visibility",
      "operator": "equals",
      "value": "private"
    }
  ],
  "actions": [
    {
      "type": "add_branch_protection",
      "params": { "ruleset_id": "standard-main-protection" }
    }
  ]
}
```

---

## Managing Rules

Webhook rules are managed via the gh-admin dashboard at `/dashboard/webhooks` (or via the AI agent):

```
Show me my webhook automation rules
```

```
Create a rule: whenever a new repo is created in any org, add the devops-team as maintainers
```

```
Disable the "auto branch protection" rule
```

---

## Event Logs

Every webhook event is logged with:
- Event type and timestamp
- Repository and sender
- Which rule(s) matched
- Actions taken and their outcomes (success/failure with details)
- Payload summary

Logs are available in the dashboard and accessible via the AI:
```
Show me webhook events from the last 24 hours
```

```
Show recent events where branch protection was deleted
```

---

## Security

- **Signature verification:** Every incoming webhook is verified with HMAC-SHA256 against your configured `GITHUB_WEBHOOK_SECRET`. Invalid signatures are rejected with 401.
- **Timing-safe comparison:** The signature comparison uses a constant-time algorithm to prevent timing attacks.
- **User isolation:** Rules are stored per-user; the webhook handler matches events against the rules of the org owner who set up the webhook.
- **Non-blocking actions:** Action execution is fire-and-forget — a slow or failing action does not block the webhook response or affect other actions.

---

## E2E Test Scenarios

### Scenario 1: Create a basic rule
1. Navigate to `/dashboard/webhooks` or use the chat
2. Create a rule: event = `repository.created`, no conditions, action = `notify` with message "New repo created: {{repository.name}}"
3. **Expect:** Rule appears in rules list; enabled by default

### Scenario 2: Trigger the rule
1. Create a new repository in your test org (via GitHub or gh-admin)
2. **Expect:** Within seconds, the webhook event is logged; rule matches; notify action recorded in event log

### Scenario 3: Condition filtering — match
1. Create a rule: event = `repository.created`, condition = `repository.visibility equals private`, action = `add_labels` with `["private-repo"]`
2. Create a private repo in the test org
3. **Expect:** Event logged; rule matches; label added to the repo

### Scenario 4: Condition filtering — no match
1. Using the same rule from Scenario 3, create a **public** repo
2. **Expect:** Event logged; rule does NOT match (visibility is public); no label added

### Scenario 5: Multiple conditions (AND)
1. Create a rule with two conditions: `repository.name contains "test"` AND `repository.visibility equals private`
2. Create repos: (a) `test-private` (private), (b) `test-public` (public), (c) `prod-private` (private)
3. **Expect:** Only `test-private` triggers the rule; others do not match

### Scenario 6: Regex match condition
1. Create a rule: `repository.name matches "^(api|svc)-.*"`, action = `add_team` with `api-reviewers` team
2. Create repos: `api-gateway` and `frontend-app`
3. **Expect:** `api-gateway` matches; `frontend-app` does not; team only added to `api-gateway`

### Scenario 7: Multiple actions
1. Create a rule with two actions: `add_team` (platform-team as push) AND `notify` ("Repo {{repository.name}} created")
2. Create a repo
3. **Expect:** Both actions execute; team added AND notification logged

### Scenario 8: Action failure — partial execution
1. Create a rule with `add_team` where the team name doesn't exist
2. Trigger the event
3. **Expect:** Action fails; error logged; other actions in the rule still execute; webhook returns 200 (non-blocking)

### Scenario 9: Invalid signature rejection
1. Send a POST to `/api/webhooks/github` with an invalid or missing `X-Hub-Signature-256` header
2. **Expect:** 401 response; event not processed; error logged

### Scenario 10: Event log query
1. After triggering several events, use the chat: `Show webhook events from the last hour`
2. **Expect:** Table of events with type, timestamp, repo, sender, rule match status, and action outcomes

---

## Technical Reference

| Component | Location |
|---|---|
| Webhook ingestion endpoint | `POST /api/webhooks/github` in `server/webhooks/github-webhook-handler.ts` |
| Signature verification | `verifyWebhookSignature()` in same file |
| Condition evaluation | `evaluateConditions()` + `getNestedValue()` |
| Webhook automation DAL | `server/data-access-layer/webhook-automation.ts` |
| Rule schema | `server/db/schemas/webhook-automation.ts` |
| D1 tables | `webhook_rules`, `webhook_execution_logs` |
| Event types | `WebhookEventType` in `server/data-access-layer/webhook-automation.ts` |
| Condition operators | `equals`, `not_equals`, `contains`, `matches` |
