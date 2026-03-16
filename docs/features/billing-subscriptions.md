# Feature: Billing & Subscriptions

gh-admin uses a usage-based subscription model with three tiers. You pay monthly for a pool of AI tool executions, shared across all surfaces (web chat, MCP server, and CLI). Billing is powered by Stripe.

---

## Plans

| Plan | Price | Monthly Tool Calls | Best For |
|---|---|---|---|
| **Free** | $0/month | 50 | Evaluating gh-admin; occasional one-off tasks |
| **Standard** | $19/month | 500 | Active org admins; daily use; small teams |
| **Unlimited** | $49/month | No limit | Power users; large orgs; automation-heavy workflows |

All plans include:
- Web chat interface
- MCP server access (all 81 tools)
- CLI access
- Full tool confirmation safety system
- Conversation history

Standard and Unlimited plans additionally include:
- Custom prompt templates
- Background entity sync (faster first-response times)

---

## What Counts as a Tool Call

Every execution of a GitHub administration tool counts as one tool call — regardless of which surface initiated it:

- A read-only `listOrgRepos` call: **1 call**
- A `deleteGitHubRepos` call deleting 5 repos at once: **1 call** (one tool invocation)
- A multi-step prompt that runs 4 tools: **4 calls**
- A prompt template with 3 steps that each invoke 2 tools: **6 calls**

Read-only listing commands in the CLI (`gh-admin org list`, `gh-admin org repos`, `gh-admin org teams`) do **not** count — they bypass the AI tool layer.

---

## Billing Page

Navigate to `/dashboard/billing` to see:

- **Current plan** with your next billing date
- **Monthly usage** — tool calls used and remaining this month, with a visual progress bar
- **Plan comparison table** — side-by-side view of all plans
- **Upgrade button** — links to Stripe Checkout for instant upgrade
- **Manage Subscription** — opens the Stripe Customer Portal to update payment method, view invoices, or cancel

---

## Upgrading

### From the billing page

1. Go to `/dashboard/billing`
2. Click **Upgrade to Standard** or **Upgrade to Unlimited**
3. You're taken to Stripe Checkout; enter your payment details
4. After payment, your plan upgrades immediately — no wait
5. Your tool call quota resets to the new limit immediately

### From the CLI

```bash
gh-admin billing upgrade
```

Opens the billing page in your browser.

### From the AI

```
I want to upgrade my plan
```

The agent provides a link to the billing page.

---

## Downgrading and Cancelling

1. Go to `/dashboard/billing` and click **Manage Subscription**
2. The Stripe Customer Portal opens
3. Choose **Change plan** to downgrade or **Cancel subscription** to revert to Free

Changes take effect at the end of the current billing period — you keep your current-tier access until then.

---

## Usage Tracking

Usage is tracked per calendar month. The counter resets on the 1st of each month at 00:00 UTC.

**Where to see usage:**
- **Chat UI footer** — shows current month's calls used and limit in real time
- **Dashboard** — usage card on the command center
- **Billing page** — detailed breakdown with progress bar
- **CLI** — `gh-admin billing usage` for terminal output

**Usage is shared across all surfaces.** A tool call from the MCP server in Claude Code counts against the same pool as tool calls from the web chat or CLI.

---

## Approaching and Hitting Limits

| Usage level | What happens |
|---|---|
| 80% of limit | Warning indicator in chat UI |
| 100% of limit | Tool calls blocked; agent directs user to billing page |
| Over limit after downgrade | Existing usage over limit is not billed; tools blocked until next reset |

When the limit is hit:
- **Web chat:** Agent responds: "You've reached your monthly tool call limit. [Upgrade your plan](https://gh-admin.com/dashboard/billing) to continue."
- **MCP server:** Tool returns error: "Monthly tool execution limit reached. Upgrade at https://gh-admin.com/dashboard/billing"
- **CLI:** `gh-admin chat` prints the same message to stdout

---

## Organization Billing

For teams with multiple org admins, org-level billing allows a single admin to purchase seats for the whole team:

- Org admin purchases N seats at a volume discount
- Team members are invited via their GitHub org membership
- One invoice, one payment method for the whole team
- Centralized billing portal for the org admin

(Contact us to set up organization billing.)

---

## Stripe Integration

- **Payment processing:** Stripe Checkout for initial subscription; Stripe Customer Portal for management
- **Webhooks:** Stripe webhooks at `/api/stripe/webhooks` handle subscription state changes, payment failures, and cancellations
- **Security:** Stripe webhook signature verified on every event; `returnUrl` for portal sessions is restricted to the same origin
- **Customer creation:** A Stripe customer is created automatically when you sign up

---

## E2E Test Scenarios

### Scenario 1: View billing page — Free tier
1. Log in as a Free-tier user
2. Navigate to `/dashboard/billing`
3. **Expect:** Current plan shown as "Free"; usage shows X/50 calls; Standard and Unlimited upgrade options visible; Manage Subscription button absent (no active subscription)

### Scenario 2: View billing page — Standard tier
1. Log in as a Standard-tier user
2. Navigate to `/dashboard/billing`
3. **Expect:** Current plan shown as "Standard"; usage shows X/500 calls; Unlimited upgrade option; Manage Subscription button present

### Scenario 3: Usage display in chat UI
1. Log in; open the AI chat
2. Look for usage counter in the chat footer
3. **Expect:** Counter shows current month's tool calls used and the limit (e.g., "12 / 50 tools used this month")

### Scenario 4: Usage increments after tool call
1. Note current usage count in chat footer
2. Send a prompt that triggers at least one tool call: `List orgs`
3. **Expect:** Usage counter increments by the number of tools executed

### Scenario 5: Usage warning at 80%
1. Use a Free-tier account with 40/50 calls used
2. Make a tool call to reach ≥40 used
3. **Expect:** Warning indicator appears in chat UI (color change or badge)

### Scenario 6: Usage limit block
1. Use a Free-tier account with 50/50 calls used
2. Send a prompt that would trigger a tool call
3. **Expect:** Agent responds with limit reached message and billing link; no tool executes; usage counter does not increment

### Scenario 7: Usage from MCP counts in web UI
1. Make 5 tool calls via the MCP server in Claude Code
2. Open the web chat UI
3. **Expect:** Usage counter reflects the MCP tool calls; both surfaces share the same pool

### Scenario 8: CLI usage display
1. Run: `gh-admin billing usage`
2. **Expect:** Plan name, tool calls used, tool calls remaining, and reset date displayed in terminal

### Scenario 9: Direct org command doesn't consume quota
1. Note current usage count
2. Run: `gh-admin org list`
3. **Expect:** Usage count unchanged after the command

### Scenario 10: Upgrade flow (non-destructive test — redirect verification)
1. Log in as a Free-tier user
2. Navigate to `/dashboard/billing`; click **Upgrade to Standard**
3. **Expect:** Redirected to Stripe Checkout page; URL is `checkout.stripe.com`; page shows Standard plan pricing

---

## Technical Reference

| Component | Location |
|---|---|
| Billing page | `clients/web/routes/dashboard/billing.tsx` |
| oRPC billing procedures | `server/orpc/routes/billing.ts` |
| Stripe plugin | Better Auth Stripe plugin in `server/auth/index.ts` |
| Stripe webhook handler | `POST /api/stripe/webhooks` |
| Usage tracking | `GitHubAgent` DO: `usage_stats` table, `checkUsageLimit()`, `#recordToolExecutions()` |
| Usage oRPC procedure | `server/orpc/routes/usage.ts` |
| Subscription tier in DO | Cached as `subscription_tier` preference; refreshed on login |
| Analytics Engine | `GH_AGENT_TOOL_CALLS` dataset, `blob1=userId`, `blob2=toolName` |
| Org billing DAL | `server/data-access-layer/org-billing.ts` |
