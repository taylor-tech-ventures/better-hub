# Custom Prompt Templates

**Status:** Phases 1-3 Implemented (Data Layer, Builder UI, Run Modal)
**Priority:** P2 — Post-Core, Pre-Launch Differentiator
**Supersedes:** `docs/todos/09-post-launch.md` §1 (Custom Prompt Templates FR-5.1/FR-5.2)

---

## Overview

Custom prompt templates let users chain together existing GitHub AI tools into reusable workflows. Instead of typing the same multi-step instructions every time, users build a template once — mixing hardcoded values with dynamic inputs — and run it on demand through a guided modal.

Every template execution is carried out by the AI agent using the available GitHub tools. The user never calls GitHub APIs directly; the AI interprets the filled-in prompt and orchestrates tool calls.

---

## Motivation

Power users of gh-admin.com perform the same multi-step GitHub administration tasks repeatedly:

- Provision a new repository from a template, configure its default branch, copy access and rulesets
- Audit org-wide repo access and flag users assigned directly instead of via teams
- Synchronize branch protection rules across a fleet of repositories

Today each of these requires typing out the full instruction set in the AI chat every time. Custom prompt templates eliminate that friction while keeping the AI agent as the execution engine.

---

## Terminology

| Term | Definition |
|---|---|
| **Prompt Template** | A saved, reusable prompt composed of one or more **steps** that reference AI tools |
| **Step** | A single tool invocation within a template, with some or all parameters bound |
| **Hardcoded Value** | A parameter value baked into the template (e.g., `default-branch: develop`) |
| **Dynamic Value** | A parameter resolved at run time via user input (e.g., `{input}`, `{repo_select}`) |
| **Run** | A single execution of a prompt template with all dynamic values filled in |

---

## User Experience

### 1. Template Builder (CRUD)

The template builder lives at `/dashboard/prompt-templates` and is also accessible from the AI chat drawer via a "Templates" tab.

#### Creating a Template

1. User clicks **"New Template"** — opens a full-page or modal editor
2. **Metadata section:**
   - Template name (required, max 100 chars)
   - Description (optional, max 500 chars)
   - Category / tags (optional, for organization)
3. **Steps section** — an ordered list of tool invocations:
   - User clicks **"Add Step"** → selects a tool from a searchable dropdown of all available GitHub tools (sourced from `listAvailableTools` metadata)
   - For each tool parameter, the user chooses:
     - **Hardcoded** — enters a literal value inline
     - **Dynamic: Text Input** (`{input}`) — free-text field shown at run time
     - **Dynamic: Select** (`{repo_select}`, `{org_select}`, `{team_select}`, `{branch_select}`) — dropdown populated from GitHub data at run time
     - **Dynamic: Multi-Select** — same as select but allows multiple values
     - **Reference** (`{step.N.output.field}`) — references output from a previous step (e.g., the repo name returned by `createGitHubRepoFromTemplate` used in subsequent steps)
   - Each parameter binding shows a preview of how it will appear in the generated prompt
4. **Preview section** — shows the fully rendered prompt text that will be sent to the AI chat, with dynamic placeholders highlighted
5. **Save** — validates and persists the template

#### Editing & Deleting

- Templates are listed in a table with name, description, step count, last-run date
- Inline edit via the same builder UI
- Delete with confirmation modal

#### Sharing (Future)

- Out of scope for v1; noted here for storage schema consideration
- Users may eventually share templates within an org or publicly

### 2. Running a Template

1. User selects a saved template (from the template list, chat drawer, or command palette)
2. A **modal** opens with a TanStack Form containing:
   - **Tab-navigated "ad-lib" style inputs** — one section per dynamic value, ordered by step sequence
   - Each input is labeled with the step name and parameter name (e.g., "Step 1: Create Repo → Repository Name")
   - Input types match the dynamic value type:
     - `{input}` → text input with optional placeholder/hint from the template
     - `{repo_select}` → async select dropdown fetching repos from `listOrgRepos`
     - `{org_select}` → async select fetching orgs from `listUserOrgs`
     - `{team_select}` → async select fetching teams from `listOrgTeams`
     - `{branch_select}` → async select fetching branches from `getRepoBranches`
     - `{multi_repo_select}` → multi-select variant
   - Dependent selects cascade (e.g., selecting an org loads its repos)
   - Form validation ensures all required fields are filled
3. User clicks **"Run"** → the modal closes and the filled-in prompt is sent to the AI chat

### 3. Execution & Progress

Once submitted, the AI chat handles execution. The user sees:

1. **Step-by-step progress** — each tool call is displayed as it executes, with:
   - Tool name and parameters (matching the template step)
   - Status indicator: pending → running → success / failed
   - Collapsible output for each step
2. **Tool approval gates** — tools in `TOOLS_REQUIRING_APPROVAL` pause for user confirmation as usual; the template does not bypass approval
3. **Error handling:**
   - If a step fails, the AI reports the error and asks the user how to proceed (retry, skip, abort)
   - The AI has full context of the template intent, so it can suggest fixes
   - Partial results from completed steps are preserved
4. **Completion summary** — after all steps finish, the AI produces a summary of what was done, with links to created/modified resources

### 4. Example Workflow

**Template: "Provision Repository from Template"**

| Step | Tool | Parameters |
|---|---|---|
| 1 | `createGitHubRepoFromTemplate` | `template_owner`: hardcoded `"my-org"`, `template_repo`: `{repo_select}`, `name`: `{input}`, `owner`: hardcoded `"my-org"`, `private`: hardcoded `true` |
| 2 | `createGitHubBranchesOnRepos` | `org`: hardcoded `"my-org"`, `repos`: `{step.1.output.name}`, `branch`: hardcoded `"develop"`, `from_branch`: hardcoded `"main"` |
| 3 | `updateGitHubRepos` | `org`: hardcoded `"my-org"`, `repos`: `{step.1.output.name}`, `settings`: hardcoded `{ default_branch: "develop" }` |
| 4 | `copyGitHubRepoAccess` | `source_owner`: hardcoded `"my-org"`, `source_repo`: `{repo_select}`, `target_owner`: hardcoded `"my-org"`, `target_repo`: `{step.1.output.name}` |
| 5 | `copyGitHubBranchProtection` | `source_owner`: hardcoded `"my-org"`, `source_repo`: `{repo_select}`, `target_owner`: hardcoded `"my-org"`, `target_repo`: `{step.1.output.name}` |

**Run-time modal shows:**
- Tab 1: "Source Template Repo" → repo select dropdown (filtered to `my-org`)
- Tab 2: "New Repository Name" → text input

**Generated prompt sent to AI:**
```
Execute the following workflow step by step:

1. Create a new private repository "my-org/{user-typed-name}" from the template "my-org/{selected-repo}"
2. Create a "develop" branch from "main" on "my-org/{user-typed-name}"
3. Set the default branch of "my-org/{user-typed-name}" to "develop"
4. Copy all team and user access from "my-org/{selected-repo}" to "my-org/{user-typed-name}"
5. Copy branch protection rules from "my-org/{selected-repo}" to "my-org/{user-typed-name}"

Report the result of each step as you go.
```

---

## Data Model

### Template Schema

```typescript
interface PromptTemplate {
  id: string;                    // ULID or UUID
  userId: string;                // Owner
  name: string;                  // Display name
  description: string;           // Optional description
  tags: string[];                // For filtering/organization
  steps: PromptTemplateStep[];   // Ordered tool invocations
  createdAt: number;             // Unix ms
  updatedAt: number;             // Unix ms
}

interface PromptTemplateStep {
  id: string;                    // Step identifier (for cross-step references)
  toolName: string;              // Must match a registered AI tool name
  label: string;                 // Human-readable step description
  parameters: Record<string, ParameterBinding>;
}

type ParameterBinding =
  | { type: 'hardcoded'; value: unknown }
  | { type: 'input'; label: string; placeholder?: string; required?: boolean }
  | { type: 'org_select'; label: string; required?: boolean }
  | { type: 'repo_select'; label: string; orgParam?: string; required?: boolean }
  | { type: 'team_select'; label: string; orgParam?: string; required?: boolean }
  | { type: 'branch_select'; label: string; orgParam?: string; repoParam?: string; required?: boolean }
  | { type: 'multi_repo_select'; label: string; orgParam?: string; required?: boolean }
  | { type: 'step_reference'; stepId: string; outputPath: string };
```

### Run History Schema (Optional, for dashboard display)

```typescript
interface PromptTemplateRun {
  id: string;
  templateId: string;
  userId: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  inputs: Record<string, unknown>;  // Resolved dynamic values
  startedAt: number;
  completedAt?: number;
  stepResults: StepResult[];
}

interface StepResult {
  stepId: string;
  toolName: string;
  status: 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
}
```

---

## Storage Architecture

### Primary Storage: Dedicated Per-User Durable Object (PromptTemplateDO)

A new `PromptTemplateDO` class (separate from `GitHubAgent`) stores the full template definitions — steps, parameter bindings, and all metadata — in its own SQLite database. One instance per user, keyed by `userId` (same naming convention as `GitHubAgent`).

**Why a dedicated DO from day one:**

- **Isolation** — template storage is fully decoupled from chat, tokens, and preferences. A bug, migration, or reset in `GitHubAgent` cannot destroy templates, and vice versa.
- **Dedicated SQLite** — the full 10 GB per-DO budget is available for templates alone. Schema evolves independently without touching the chat DO's migration tags.
- **Query capability** — SQLite enables filtering by name/tag, sorting by `updated_at`, and full-text search — all server-side without shipping every template to the client.
- **Clean separation of concerns** — `GitHubAgent` owns chat + tokens + preferences. `PromptTemplateDO` owns templates + run history + (future) schedules.
- **Scheduling-ready** — when background/scheduled runs ship, the dedicated DO already owns the data. No migration from `GitHubAgent` required. Scheduled executions can read templates from `PromptTemplateDO` and dispatch work to `GitHubAgent` or a Workflow without cross-DO entanglement.
- **Independent lifecycle** — template-heavy users don't bloat the chat DO. The chat DO can hibernate without affecting template CRUD, and template schema changes don't require redeploying the chat DO migration.

**Trade-offs accepted:**

- **More upfront infrastructure** — new DO class, `wrangler.jsonc` migration tag, stub factory, DAL module, and RPC methods. This is more work than adding a table to `GitHubAgent`, but eliminates the migration cost later.
- **Cross-DO reads** — when the AI agent (running in `GitHubAgent`) needs to read a template (e.g., for scheduled runs), it must call into `PromptTemplateDO` via RPC, adding one network hop (~1–5ms within the same colo). This is negligible and only applies to background execution — interactive runs are driven from the client, which calls `PromptTemplateDO` directly.
- **More DO instances per user** — 3 DOs per user (GitHubAgent, GitHubAgentEvents, PromptTemplateDO) instead of 2. Cost is negligible (Cloudflare charges per-request, not per-instance).

### Template Index: Where to Store the Lightweight Listing

The template list page (`/dashboard/prompt-templates`) needs to display a table of templates (name, description, tags, step count, last-run date) without loading every full template definition. Three options were evaluated for this index/mapping:

#### Index Option 1: GitHubAgent Durable Object

Store a lightweight index (id, name, description, stepCount, tags, updatedAt) in the existing `GitHubAgent` DO's `user_preferences` table or a new `prompt_template_index` table.

**Pros:**
- Already exists — no new bindings or infrastructure
- Co-located with the user session context that every authenticated request already touches
- Sub-millisecond reads when the DO is warm

**Cons:**
- **Re-couples the systems** — the whole point of a dedicated `PromptTemplateDO` is isolation. Putting the index in `GitHubAgent` means template listing breaks if the chat DO has issues, and creates a consistency problem (two DOs must agree on the template list)
- **Dual-write complexity** — every template save/delete must update both `PromptTemplateDO` (source of truth) and `GitHubAgent` (index). If one write fails, they drift.
- **No query advantages over the dedicated DO** — `PromptTemplateDO` already has SQLite; querying the index there is equally fast

**Verdict:** Not recommended. Adds coupling without meaningful benefit.

#### Index Option 2: D1 Table (Separate from Auth Schema)

A new `prompt_template_index` table in the existing `GH_ADMIN_D1_PRIMARY` database, alongside (but separate from) the Better Auth tables.

**Pros:**
- **SQL query power** — `WHERE user_id = ? ORDER BY updated_at DESC`, full-text search, join with `users` table for future admin views
- **Dashboard-friendly** — D1 is already in the authenticated request path (sessions, subscriptions); adding a lightweight table is trivial
- **Cross-user queries** — an admin could query "all templates across all users" without touching per-user DOs (useful for analytics, support, future marketplace)
- **Durable and independent** — survives DO evictions; backed by Cloudflare's D1 infrastructure with automatic backups
- **Run history co-location** — `prompt_template_runs` (future) naturally belongs in D1 alongside the index, enabling dashboard queries like "last 10 runs across all templates"

**Cons:**
- **Dual-write consistency** — template saves must update both `PromptTemplateDO` (full template) and D1 (index row). Requires careful ordering (write DO first, then D1; on D1 failure, retry or mark stale)
- **Migration required** — new Drizzle migration file for the table
- **Slightly higher latency** — D1 reads are 1–5ms vs. sub-ms for DO SQLite (negligible for a list page)
- **Schema maintenance** — two places define template metadata (DO schema + D1 migration); must stay in sync

**Verdict:** Strong option for cross-user queries and dashboard features, but dual-write adds complexity.

#### Index Option 3: New KV Namespace

A new `PROMPT_TEMPLATE_INDEX` KV binding, with keys like `user:{userId}:templates` mapping to a JSON array of template summaries.

**Pros:**
- **Globally fast reads** — KV is optimized for read-heavy workloads with edge caching
- **Simple key-value model** — one key per user, one JSON blob

**Cons:**
- **No query capability** — cannot filter, sort, or search server-side. The entire list must be fetched and processed client-side.
- **Eventually consistent** — KV writes may take up to 60 seconds to propagate globally. A user who saves a template and immediately refreshes the list page might not see it.
- **Atomic update problem** — updating one template requires read-modify-write of the entire JSON array. Concurrent saves (e.g., two browser tabs) can lose data without optimistic locking.
- **No relational joins** — cannot correlate with user data, run history, or subscriptions
- **New binding** — requires a new KV namespace in `wrangler.jsonc` for all environments

**Verdict:** Not recommended. The eventual consistency and lack of query capability make it a poor fit for a list that users expect to update immediately.

### Recommendation: PromptTemplateDO as Single Source of Truth (No Separate Index)

**The dedicated `PromptTemplateDO` serves as both the full template store AND the listing index.** No separate index in D1, KV, or `GitHubAgent` is needed for v1.

**Why this works:**

1. **`PromptTemplateDO` already has SQLite** — a single `SELECT id, name, description, tags, step_count, updated_at FROM prompt_templates ORDER BY updated_at DESC` query returns the listing data in sub-milliseconds. There is no performance reason to duplicate this elsewhere.
2. **Single write path** — every save/delete touches exactly one storage system. No dual-write consistency problems, no retry logic, no drift between index and source of truth.
3. **The DO is warm when needed** — listing templates happens on the `/dashboard/prompt-templates` page. The first request wakes the DO (~50ms cold start); subsequent requests are sub-ms. This matches the `GitHubAgent` pattern users already experience.
4. **Step count is a derived column** — store `step_count INTEGER` alongside the full `steps` JSON to avoid parsing JSON for the list view.

**When to add D1 index (future):**

A D1 `prompt_template_index` table becomes valuable when:
- **Scheduled runs** ship and the dashboard needs to query "all recent runs across all templates" (D1 joins with `prompt_template_runs`)
- **Template sharing / marketplace** ships and cross-user queries are needed
- **Admin tooling** needs to inspect templates across all users without waking every DO

At that point, add D1 as a **read-optimized projection** — writes go to `PromptTemplateDO` first, then async-replicate to D1 (via the DO's `save` method or a queue). The DO remains the source of truth.

### Storage Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
├──────────────┬──────────────────────┬───────────────────┤
│   oRPC       │    oRPC              │   WebSocket       │
│   /prompt-   │    /prompt-          │   (AI Chat)       │
│   templates  │    templates         │                   │
│   .list()    │    .save()           │                   │
├──────────────┴──────────────────────┤                   │
│          DAL: prompt-templates.ts    │                   │
├──────────────────────────────────────┤                   │
│         PromptTemplateDO             │   GitHubAgent     │
│  ┌────────────────────────────┐     │  ┌─────────────┐ │
│  │  prompt_templates table    │     │  │ AI chat     │ │
│  │  (full definitions)        │     │  │ tokens      │ │
│  │                            │     │  │ preferences │ │
│  │  prompt_template_runs      │     │  └─────────────┘ │
│  │  (execution history)       │     │                   │
│  └────────────────────────────┘     │                   │
├──────────────────────────────────────┴───────────────────┤
│                  D1 (future: index + runs projection)    │
└─────────────────────────────────────────────────────────┘
```

---

## Authentication & Per-User Isolation

Every `PromptTemplateDO` instance is scoped to a single user. The auth guard chain ensures a user can only ever access their own templates — there is no path through the API that allows cross-user access.

### Auth Guard Chain

```
Browser request
  │
  ▼
oRPC HTTP handler (client/routes/api/orpc.$.ts)
  │  passes { headers, env } as initial context
  ▼
base middleware (server/orpc/middleware.ts)
  │  extracts headers + Cloudflare env
  ▼
authorized middleware (server/orpc/middleware.ts)
  │  calls Better Auth → getSession({ headers })
  │  rejects with UNAUTHORIZED if no valid session
  │  injects context.session.userId + context.user
  ▼
oRPC procedure handler (server/orpc/routes/prompt-templates.ts)
  │  passes context.session.userId to DAL function
  │  (userId comes from the server-side session — NEVER from client input)
  ▼
DAL function (server/data-access-layer/prompt-templates.ts)
  │  calls getPromptTemplateDOStub(env, userId)
  ▼
Stub factory (server/durable-objects/prompt-template-stub.ts)
  │  env.PromptTemplateDO.idFromName(userId)
  │  → deterministic DO instance ID derived from userId
  ▼
PromptTemplateDO instance (one per user)
  │  all data in this DO's SQLite belongs to this user
  └─ no userId column needed in the DO tables — the DO IS the user boundary
```

### Key Security Properties

1. **userId is server-derived** — the `authorized` middleware extracts `userId` from the Better Auth session cookie. The client never sends a `userId` parameter. There is no way to forge or spoof which DO instance is accessed.

2. **DO instance = user boundary** — `env.PromptTemplateDO.idFromName(userId)` produces a deterministic, unique DO ID for each user. User A's requests always route to DO instance A; User B's requests always route to DO instance B. There is no shared state.

3. **No userId column in DO tables** — the `prompt_templates` and `prompt_template_runs` tables do not have a `userId` column because the entire DO instance belongs to one user. This eliminates any possibility of a `WHERE userId = ?` query returning another user's data.

4. **Same pattern as GitHubAgent** — this is identical to how the existing `GitHubAgent` DO isolates tokens, preferences, and chat history per user. The `getGitHubAgentStub(env, userId)` and `getPromptTemplateDOStub(env, userId)` factories follow the same convention.

5. **No direct DO access from the client** — the client calls oRPC procedures, which go through the `authorized` middleware. The Cloudflare Workers runtime does not expose DO stubs to the browser. The only entry point is the authenticated oRPC handler.

### Future: Cross-User Access (Sharing/Admin)

When template sharing ships, it will NOT bypass the per-user DO boundary. Instead:
- Shared templates will be **copied** into the recipient's `PromptTemplateDO` (fork model)
- OR a separate shared storage layer (D1 or R2) will hold published templates, readable by any authenticated user but writable only by the owner
- Admin access (for support/debugging) will use a separate privileged endpoint with explicit role checks (`context.user.role === 'admin'`)

---

## Technical Design

### Template CRUD — Server

#### PromptTemplateDO Class

```typescript
// server/durable-objects/prompt-template.ts

export class PromptTemplateDO extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS prompt_templates (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          tags        TEXT NOT NULL DEFAULT '[]',
          steps       TEXT NOT NULL,
          step_count  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated
          ON prompt_templates(updated_at DESC)
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS prompt_template_runs (
          id          TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'running',
          inputs      TEXT NOT NULL DEFAULT '{}',
          started_at  INTEGER NOT NULL,
          completed_at INTEGER,
          step_results TEXT NOT NULL DEFAULT '[]',
          FOREIGN KEY (template_id) REFERENCES prompt_templates(id)
            ON DELETE CASCADE
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE INDEX IF NOT EXISTS idx_runs_template
          ON prompt_template_runs(template_id, started_at DESC)
      `);
    });
  }
}
```

#### Wrangler Configuration

```jsonc
// Additions to wrangler.jsonc

// durable_objects.bindings:
{ "name": "PromptTemplateDO", "class_name": "PromptTemplateDO" }

// migrations (append):
{ "new_sqlite_classes": ["PromptTemplateDO"], "tag": "v3" }
```

#### PromptTemplateDO RPC Methods

```typescript
// In server/durable-objects/prompt-template.ts

@callable()
async listTemplates(): Promise<PromptTemplateSummary[]> {
  // SELECT id, name, description, tags, step_count, updated_at
  // Returns lightweight summaries for the list view
}

@callable()
async getTemplate(id: string): Promise<PromptTemplate | null> {
  // SELECT * — returns full template with steps
}

@callable()
async saveTemplate(template: Omit<PromptTemplate, 'userId'>): Promise<PromptTemplate> {
  // INSERT OR REPLACE — computes step_count from steps array
}

@callable()
async deleteTemplate(id: string): Promise<void> {
  // DELETE — cascades to prompt_template_runs
}

@callable()
async recordRun(run: PromptTemplateRun): Promise<void> {
  // INSERT into prompt_template_runs
}

@callable()
async listRuns(templateId?: string, limit?: number): Promise<PromptTemplateRun[]> {
  // SELECT with optional templateId filter, ordered by started_at DESC
}
```

#### Stub Factory

```typescript
// server/durable-objects/prompt-template-stub.ts

import type { PromptTemplateDO } from '@/server/durable-objects/prompt-template';

export function getPromptTemplateDOStub(
  env: Pick<Cloudflare.Env, 'PromptTemplateDO'>,
  userId: string,
): DurableObjectStub<PromptTemplateDO> {
  const id = env.PromptTemplateDO.idFromName(userId);
  return env.PromptTemplateDO.get(id);
}
```

#### DAL Functions

```typescript
// In server/data-access-layer/prompt-templates.ts

import { getPromptTemplateDOStub } from '@/server/durable-objects/prompt-template-stub';

export async function listPromptTemplates(env: Env, userId: string): Promise<PromptTemplateSummary[]> {
  const stub = getPromptTemplateDOStub(env, userId);
  return stub.listTemplates();
}

export async function getPromptTemplate(env: Env, userId: string, id: string): Promise<PromptTemplate | null> {
  const stub = getPromptTemplateDOStub(env, userId);
  return stub.getTemplate(id);
}

export async function savePromptTemplate(env: Env, userId: string, template: PromptTemplate): Promise<PromptTemplate> {
  const stub = getPromptTemplateDOStub(env, userId);
  return stub.saveTemplate(template);
}

export async function deletePromptTemplate(env: Env, userId: string, id: string): Promise<void> {
  const stub = getPromptTemplateDOStub(env, userId);
  return stub.deleteTemplate(id);
}
```

#### oRPC Procedures

```typescript
// In server/orpc/routes/prompt-templates.ts

export const promptTemplatesRouter = {
  list: base.use(authorized).handler(async ({ context }) =>
    listPromptTemplates(context.env, context.session.userId),
  ),

  get: base.use(authorized)
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) =>
      getPromptTemplate(context.env, context.session.userId, input.id),
    ),

  save: base.use(authorized)
    .input(promptTemplateSchema)
    .handler(async ({ input, context }) =>
      savePromptTemplate(context.env, context.session.userId, input),
    ),

  delete: base.use(authorized)
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) =>
      deletePromptTemplate(context.env, context.session.userId, input.id),
    ),
};
```

### Template Builder — Client

#### Route Structure

```
client/routes/dashboard/
  prompt-templates/
    route.tsx          # Layout with list/detail split
    index.tsx          # Template list table
    $templateId.tsx    # Template editor (create/edit)
    new.tsx            # New template (alias for editor with no ID)
```

#### Key Components

```
client/components/prompt-templates/
  template-builder.tsx      # Full editor: metadata + step list + preview
  step-editor.tsx           # Single step: tool picker + parameter bindings
  parameter-binding.tsx     # Hardcoded / dynamic / reference selector per param
  template-preview.tsx      # Live preview of the generated prompt text
  run-modal.tsx             # TanStack Form modal for filling dynamic values
  run-progress.tsx          # Step-by-step execution progress display
  tool-picker.tsx           # Searchable dropdown of all available tools
  dynamic-select.tsx        # Async select for org/repo/team/branch
```

#### Template Builder UI Layout

```
┌──────────────────────────────────────────────────────────┐
│ Template: [Name input]            [Save] [Delete] [Run]  │
├──────────────────────────────────────────────────────────┤
│ Description: [Text area]                                 │
│ Tags: [Tag input]                                        │
├──────────────────────────────────────────────────────────┤
│ Steps                                            [+ Add] │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 1. createGitHubRepoFromTemplate          [↑] [↓] [×]│ │
│ │    ├─ template_owner: "my-org"       [hardcoded ▾]   │ │
│ │    ├─ template_repo:  {repo_select}  [dynamic   ▾]   │ │
│ │    ├─ name:           {input}        [dynamic   ▾]   │ │
│ │    └─ private:        true           [hardcoded ▾]   │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 2. createGitHubBranchesOnRepos           [↑] [↓] [×]│ │
│ │    ├─ org:    "my-org"               [hardcoded ▾]   │ │
│ │    ├─ repos:  {step.1.output.name}   [reference ▾]   │ │
│ │    ├─ branch: "develop"              [hardcoded ▾]   │ │
│ │    └─ from:   "main"                 [hardcoded ▾]   │ │
│ └──────────────────────────────────────────────────────┘ │
│ ...                                                      │
├──────────────────────────────────────────────────────────┤
│ Preview                                                  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Execute the following workflow step by step:          │ │
│ │                                                      │ │
│ │ 1. Create a new private repository "my-org/{input}"  │ │
│ │    from template "my-org/{repo_select}"              │ │
│ │ 2. Create branch "develop" from "main" on ...        │ │
│ │ ...                                                  │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### Run Modal UI

```
┌──────────────────────────────────────────────┐
│  Run: Provision Repository from Template     │
├──────────────────────────────────────────────┤
│  [Tab 1: Source Repo] [Tab 2: New Name]      │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Source Template Repository              │  │
│  │ Step 1 → template_repo                 │  │
│  │                                        │  │
│  │ Organization: my-org                   │  │
│  │ Repository:   [▾ search repos...    ]  │  │
│  │                                        │  │
│  │ Also used in: Step 4 (source_repo),    │  │
│  │               Step 5 (source_repo)     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│              [Cancel]  [Run Template →]       │
└──────────────────────────────────────────────┘
```

Dynamic values that are reused across multiple steps are collected once and shown with a note indicating all steps that will use the value.

### Prompt Generation

When the user submits the run modal, the client generates a natural-language prompt from the template and sends it to the AI chat.

```typescript
// client/lib/prompt-templates/generate-prompt.ts

export function generatePrompt(
  template: PromptTemplate,
  inputs: Record<string, unknown>,
): string {
  // For each step, produce a numbered instruction line
  // referencing the tool by its human-readable description
  // and substituting all parameter values.
  //
  // The AI agent interprets this prompt and calls the
  // appropriate tools — the prompt does NOT contain
  // raw tool call JSON.
}
```

**Design decision:** The generated prompt is human-readable natural language, not structured tool-call JSON. This keeps the AI agent as the execution engine and allows it to handle edge cases, errors, and parameter adaptation that rigid tool-call chaining cannot.

### Execution Progress

The existing `@cloudflare/ai-chat` tool-call display is extended to show template-aware progress:

```
client/components/ui/chat/
  template-progress.tsx    # Wraps tool-call parts with step context
```

When the AI chat receives a message generated from a template run, the UI:

1. Detects the template context (via metadata attached to the message)
2. Renders a progress tracker showing all template steps
3. Maps incoming tool calls to template steps based on tool name and parameter matching
4. Updates step status as tool calls resolve
5. Shows a completion summary when all steps finish

#### Progress UI

```
┌──────────────────────────────────────────────┐
│ ▶ Provision Repository from Template         │
│   Running • 3 of 5 steps complete            │
├──────────────────────────────────────────────┤
│ ✓ Step 1: Create repository                  │
│   → Created my-org/new-service               │
│                                              │
│ ✓ Step 2: Create develop branch              │
│   → Branch "develop" created from "main"     │
│                                              │
│ ✓ Step 3: Set default branch                 │
│   → Default branch set to "develop"          │
│                                              │
│ ⏳ Step 4: Copy repository access             │
│   ⚠ Requires approval                        │
│   [Approve] [Deny]                           │
│                                              │
│ ○ Step 5: Copy branch protection             │
│   Waiting...                                 │
└──────────────────────────────────────────────┘
```

### Error Handling Strategy

| Scenario | Behavior |
|---|---|
| Tool call fails (API error) | AI reports the error, suggests retry or skip. User decides. |
| Tool requires approval, user denies | Step is skipped. AI continues with remaining steps and notes the skip in the summary. |
| Step reference fails (previous step produced no output) | AI reports the missing dependency and asks the user how to proceed. |
| Network disconnection mid-run | Chat reconnects via WebSocket. AI resumes from the last completed step (conversation history is persisted in the DO). |
| Rate limit hit | AI backs off and retries. Reports delay to the user. |

---

## Scheduled Runs (Follow-Up Feature)

> This section documents the planned scheduling capability for context. It will NOT be implemented in v1.

### Concept

Users can schedule templates with all-hardcoded values to run in the background on a cron schedule. Results are stored and displayed on the dashboard.

**Example:** "Audit all repos in org and identify instances where users are directly assigned instead of via teams" — scheduled nightly, results available on next login.

### Architecture Notes

- Requires **Cloudflare Cron Triggers** or the existing **Workflows** infrastructure (`ADMIN_ACTION_WORKFLOW`)
- Scheduled runs read the template from `PromptTemplateDO` and dispatch execution to `GitHubAgent` (or a dedicated Workflow)
- Run results are stored in `PromptTemplateDO`'s `prompt_template_runs` table, with an optional D1 projection for dashboard queries
- Subscription gating: scheduled runs are a premium feature (Standard/Unlimited)
- The dedicated `PromptTemplateDO` already provides the isolation needed — schedules, templates, and run history are co-located in the same DO, separate from the interactive chat agent

### Schema Addition (Future)

```typescript
interface PromptTemplateSchedule {
  id: string;
  templateId: string;
  userId: string;
  cron: string;              // Cron expression (e.g., "0 2 * * *")
  enabled: boolean;
  lastRunId?: string;        // Most recent PromptTemplateRun.id
  nextRunAt?: number;        // Unix ms
  createdAt: number;
  updatedAt: number;
}
```

---

## Implementation Plan

### Phase 1: Data Layer & CRUD API

1. Create `PromptTemplateDO` class in `server/durable-objects/prompt-template.ts` with SQLite schema init
2. Create stub factory in `server/durable-objects/prompt-template-stub.ts`
3. Register `PromptTemplateDO` in `wrangler.jsonc` (binding + `v3` migration tag) for all environments (local, dev, prod)
4. Export `PromptTemplateDO` from `server/index.ts`
5. Add `@callable()` RPC methods to `PromptTemplateDO`
6. Create `server/data-access-layer/prompt-templates.ts` with DAL functions
7. Create `server/orpc/routes/prompt-templates.ts` with oRPC procedures
8. Wire the sub-router into `server/orpc/router.ts`
9. Add Zod schemas in `shared/schemas/prompt-templates.ts`
10. Add `PromptTemplateDO` to Cloudflare env type definitions

### Phase 2: Template Builder UI

1. Create `/dashboard/prompt-templates` route with list view
2. Build the template editor with step management
3. Implement the tool picker with schema introspection (reads tool metadata to display available parameters)
4. Build parameter binding UI (hardcoded, dynamic, reference)
5. Implement live prompt preview

### Phase 3: Run Modal & Execution

1. Build the tab-navigated TanStack Form modal
2. Implement dynamic select components (org, repo, team, branch) with async data loading
3. Implement prompt generation from template + filled inputs
4. Send generated prompt to AI chat programmatically
5. Build template-aware progress tracker in the chat UI

### Phase 4: Polish & Edge Cases

1. Template duplicate/clone functionality
2. Run history display (optional)
3. Keyboard shortcuts and command palette integration
4. Subscription gating (if applicable)
5. Error boundary and recovery flows

### Phase 5 (Future): Scheduling

1. Extend schema with `PromptTemplateSchedule`
2. Add cron trigger or Workflow-based scheduling
3. Headless execution in DO
4. Dashboard results viewer
5. Notification on completion/failure

---

## Key Design Decisions

### 1. AI-Interpreted Prompts vs. Direct Tool Chaining

**Decision:** Generate natural-language prompts interpreted by the AI agent.

**Rationale:** Direct tool chaining (programmatically calling tools in sequence) would be faster and more predictable, but:
- The AI can adapt when a step fails or returns unexpected output
- The AI can combine multiple tool calls intelligently (e.g., batching repo operations)
- Tool schemas may evolve — the AI adapts to new parameters without template migration
- Keeps the existing approval flow intact without custom bypass logic
- Consistent with the product's core value proposition: AI-assisted administration

### 2. Tab-Navigated Run Modal vs. Inline Form

**Decision:** Modal with tab navigation.

**Rationale:** Templates may have many dynamic values across multiple steps. A modal with tabs groups related inputs (by step) and prevents the user from being overwhelmed. The ad-lib metaphor (fill in the blanks) makes the experience approachable.

### 3. Storage: Dedicated DO from Day One

**Decision:** Use a dedicated `PromptTemplateDO` Durable Object as the single source of truth. No separate index layer (D1, KV, or GitHubAgent) for v1.

**Rationale:** The application is in active development — doing the architectural work upfront avoids a costly migration later when scheduling and run history ship. The dedicated DO provides isolation from the chat/token lifecycle, its own SQLite for querying, and a clean separation of concerns. The listing query (`SELECT id, name, description, tags, step_count, updated_at`) runs directly against the DO's SQLite with sub-ms latency, eliminating the need for a separate index. A D1 projection can be added later as a read-optimized layer when cross-user queries (admin views, marketplace) become necessary.

---

## Dependencies

| Dependency | Status | Impact |
|---|---|---|
| `listAvailableTools` meta tool | Planned (not yet implemented) | Required for tool picker to enumerate available tools and their schemas |
| Tool implementations (34 total) | 5 of 34 implemented | Templates referencing unimplemented tools will fail at run time; UI should indicate tool availability |
| `shared/prompts.ts` module | Planned (TODO 10) | Template-generated prompts should be appended to the system prompt, not replace it |
| Subscription management | Planned (TODO 07) | Required if template features are gated by subscription tier |

---

## Open Questions

1. **Template versioning** — Should templates support versioning so users can roll back edits? (Likely no for v1, yes for v2 with scheduling.)
2. **Max steps per template** — Is there a practical limit? AI context window can handle ~20 steps, but UX degrades. Suggest 15-step soft limit with warning.
3. **Template categories/marketplace** — Should there be pre-built "starter" templates? Could accelerate adoption.
4. **Step conditionals** — Should steps support `if` conditions (e.g., "only copy branch protection if the source repo has rulesets")? Adds complexity but increases power. Suggest deferring to v2.
5. **Approval batching** — When a template has multiple approval-requiring steps, should the user approve all upfront or one-by-one? One-by-one is safer and consistent with existing behavior.
