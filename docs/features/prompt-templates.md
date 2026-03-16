# Feature: Custom Prompt Templates

Custom prompt templates let you save, organize, and re-run multi-step AI workflows. Instead of typing the same instructions every time, you build a template once — with named steps, reusable parameters, and optional hardcoded values — then run it in seconds with a simple form.

Templates are available to Standard and Unlimited plan users.

---

## What It Does

- Save frequently used AI workflows as named, reusable templates
- Define multi-step sequences where each step is a natural language instruction
- Parameterize steps with dynamic inputs (filled in at run time) or hardcoded values
- Reference output from an earlier step as input to a later step
- Track every execution with a full run history per template
- Run templates from a modal without leaving your current page

---

## How to Access

| Action | Location |
|---|---|
| Template library | `/dashboard/prompt-templates` |
| Create new template | `/dashboard/prompt-templates/new` |
| Edit existing template | `/dashboard/prompt-templates/[id]` |
| Run a template | Click **Run** on any template in the library, or open any template |

---

## Building a Template

### Template metadata

Every template has:
- **Name** — displayed in the template library
- **Description** — explains what the template does and when to use it
- **Tags** — up to 10 free-form labels for organization (e.g., `onboarding`, `security`, `cleanup`)

### Steps

A template is a sequence of steps. Each step is a natural language instruction sent to the AI agent — just like a chat message, but pre-written. Steps run in order, and the AI agent executes the right GitHub tools for each one automatically.

**Step fields:**
- **Name** — short label shown in the run progress UI
- **Instruction** — the full natural language instruction for this step (supports parameter references)

### Parameter bindings

Each step can have parameters that control how the instruction is filled in at run time:

| Binding type | When to use | Example |
|---|---|---|
| **Hardcoded** | Value is always the same | `org: "acme-corp"` |
| **Dynamic** | User fills in at run time | `repo_name: input("Repository name")` |
| **Reference** | Value comes from a previous step's output | `branch: output("step_1", "defaultBranch")` |

**Dynamic parameters** become form fields in the run modal — the user fills them in before launching.

**Reference parameters** are resolved automatically at run time from the structured output of a previous step. This lets you build pipelines: Step 1 discovers data, Step 2 acts on what it found.

---

## Example: Repository Onboarding Template

A 5-step template that provisions a new service repository:

**Step 1: Create repository**
```
Create a private repository called {{repo_name}} in {{org}}.
Use the {{template_repo}} as the template. Set description to "{{description}}".
```
Parameters: `repo_name` (dynamic), `org` (hardcoded: "backend-org"), `template_repo` (dynamic), `description` (dynamic)

**Step 2: Configure team access**
```
Add the {{owner_team}} team as maintainers and the {{contributor_team}} team
as writers on {{repo_name}} in {{org}}.
```
Parameters: `repo_name` (reference: step 1 output), `org` (hardcoded), `owner_team` (dynamic), `contributor_team` (dynamic)

**Step 3: Set up branch protection**
```
On the {{repo_name}} repository in {{org}}, create a main branch ruleset that:
requires 2 pull request approvals, enforces all status checks, and
requires linear history.
```
Parameters: `repo_name` (reference), `org` (hardcoded)

**Step 4: Create initial labels**
```
Add labels to {{repo_name}} in {{org}}: "needs-review", "in-progress", "blocked", "ready-for-merge".
```

**Step 5: Report summary**
```
Summarize what was just set up for {{repo_name}} in {{org}}:
team access, branch protection rules, and labels created.
```

**When run**, the user fills in: repo name, template repo, description, owner team, contributor team. All other values are either hardcoded or resolved from prior steps. The AI executes each step in sequence.

---

## Running a Template

1. Navigate to `/dashboard/prompt-templates`
2. Click **Run** on a template card (or open the template and click **Run**)
3. The **Run Modal** opens with two tabs:
   - **Parameters** — fill in all dynamic inputs; a live preview updates as you type
   - **History** — view previous runs of this template
4. Click **Run Template** to launch
5. The modal shows real-time step progress as the AI works through each step
6. Each completed step shows its output; failed steps show the error

### Run states

| State | Meaning |
|---|---|
| Pending | Step has not yet started |
| Running | AI is currently executing this step |
| Completed | Step finished successfully |
| Failed | Step encountered an error (details shown) |
| Awaiting Approval | Step triggered a destructive tool requiring confirmation |

When a step hits a confirmation gate, the run pauses. The approval UI appears in the modal; after approval, the run resumes automatically.

---

## Template Library

The library at `/dashboard/prompt-templates` shows all your templates as cards with:
- Name and description
- Tag badges
- Step count
- Last run time and status
- Run, Edit, and Delete actions

Templates are sorted by most recently updated by default.

---

## Run History

Every execution is recorded in the template's run history:

- Timestamp when the run started and completed
- Final status (completed, failed, cancelled)
- Each step's output (stored as structured text)
- Input values used (dynamic parameters)

Run history is accessible from the **History** tab in the run modal.

---

## Template Storage

Templates are stored exclusively in your `PromptTemplateDO` Durable Object — a per-user SQLite database on Cloudflare's edge. They are:
- **Private** — never visible to other users
- **Persistent** — survive page reloads, sessions, and DO hibernation
- **Fast** — served from edge storage with sub-millisecond reads

There is no cross-device sync delay; the DO is the authoritative source.

---

## Plan Requirements

| Feature | Free | Standard | Unlimited |
|---|---|---|---|
| View template library | ✗ | ✓ | ✓ |
| Create templates | ✗ | ✓ | ✓ |
| Run templates | ✗ | ✓ | ✓ |
| Template run history | ✗ | ✓ | ✓ |
| Tool calls from template runs | — | Count toward 500/mo | No limit |

Free-tier users cannot access the prompt templates section. The nav item is hidden and the route redirects to the billing page.

---

## E2E Test Scenarios

### Scenario 1: Create a template with hardcoded and dynamic parameters
1. Navigate to `/dashboard/prompt-templates/new`
2. Enter name: "List Org Repos", description: "Lists repositories for a given org"
3. Add one step: name "List repos", instruction: `List all repositories in {{org}}`
4. Set `org` as a **dynamic** parameter with label "Organization name"
5. Add tags: `reporting`, `repos`
6. Click **Save**
7. **Expect:** Template appears in library; step count shows 1; tags display correctly

### Scenario 2: Run a single-step template
1. Open the template from Scenario 1; click **Run**
2. In the run modal, fill in `org` = `[test org]`
3. Click **Run Template**
4. **Expect:** Progress shows step running → completed; output table renders with repo list

### Scenario 3: Template with a confirmation step
1. Create a template with a step that triggers a destructive tool: `Delete the repo {{repo_name}} in {{org}}`
2. Run the template with a test repo name
3. **Expect:** Step progress shows "Awaiting Approval"; Approve/Deny buttons appear in modal; after Approve, step completes; after Deny, step shows "Denied" state

### Scenario 4: Multi-step template with reference parameters
1. Create a 2-step template:
   - Step 1: `List all repos in {{org}} that have no activity in 180 days` — output includes repo names
   - Step 2: `Archive the following repos in {{org}}: {{stale_repos}}` — `stale_repos` references step 1 output
2. Run with `org` = `[test org]`
3. **Expect:** Step 1 completes with stale repo list; Step 2 uses that output as input; confirmation gate appears with specific repo names; after approval, repos archived

### Scenario 5: Run history
1. Run a template twice with different inputs
2. Open the template and click **History** tab
3. **Expect:** Both runs listed with timestamps, input values, and statuses; clicking a run shows per-step output

### Scenario 6: Edit template
1. Open an existing template
2. Change the description and add a new step
3. Click **Save**
4. **Expect:** Changes persist; step count updates in library card; previous runs are unaffected

### Scenario 7: Delete template
1. Click **Delete** on a template card
2. Confirm deletion in the dialog
3. **Expect:** Template and all associated run history are removed; library list updates immediately

### Scenario 8: Free-tier access gate
1. Log in as a Free-tier user
2. Navigate to `/dashboard/prompt-templates`
3. **Expect:** Redirect to billing page or upgrade prompt; template library is not rendered

### Scenario 9: Parameter preview updates live
1. In the template builder, add a step with `Create a repo called {{repo_name}} in {{org}}`
2. Set both as dynamic parameters
3. In the run modal, start filling in values
4. **Expect:** Preview panel updates in real time showing the resolved instruction as you type

### Scenario 10: Failed step error display
1. Create a template with a step that will fail (e.g., delete a non-existent repo)
2. Run the template
3. **Expect:** Failed step shows error state with the exact error message from the GitHub API; subsequent steps do not run; run record shows "failed" status

---

## Technical Reference

| Component | Location |
|---|---|
| PromptTemplateDO | `server/durable-objects/prompt-template.ts` |
| DO stub factory | `server/durable-objects/prompt-template-stub.ts` |
| DAL functions | `server/data-access-layer/prompt-templates.ts` |
| oRPC procedures | `server/orpc/routes/prompt-templates.ts` |
| Zod schemas | `packages/shared/schemas/prompt-templates.ts` |
| Template library route | `clients/web/routes/dashboard/prompt-templates/index.tsx` |
| New template route | `clients/web/routes/dashboard/prompt-templates/new.tsx` |
| Edit/run route | `clients/web/routes/dashboard/prompt-templates/$templateId.tsx` |
| Template builder component | `clients/web/components/prompt-templates/` |
| Prompt generation | `clients/web/lib/prompt-templates/generate-prompt.ts` |
