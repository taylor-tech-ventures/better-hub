# Ghost AI Chat

Ghost is Better Hub's AI assistant, accessible via `⌘I` (or `Ctrl+I`). It streams responses, calls GitHub API tools, and can take actions on behalf of the user — creating issues, closing PRs, writing commit messages, and more.

---

## Architecture Overview

```mermaid
graph TD
    subgraph Browser["Browser"]
        UI["AI Chat UI\n(ai-chat.tsx)"]
        PANEL["Global Chat Panel\n(global-chat-panel.tsx)"]
    end

    subgraph API["Next.js API Route"]
        GHOST["/api/ai/ghost\n(route.ts)"]
        CMD["/api/ai/command\n(quick commands)"]
        COMMIT["/api/ai/commit-message"]
        HIST["/api/ai/chat-history"]
        REWRITE["/api/ai/rewrite-prompt"]
    end

    subgraph Providers["LLM Providers"]
        OR["OpenRouter\n(default: kimi-k2.5)"]
        ANT["Anthropic\n(Claude)"]
    end

    subgraph Tools["Ghost Tools (GitHub)"]
        T1["searchPullRequests"]
        T2["searchIssues"]
        T3["getRepoFileTree"]
        T4["getFileContent"]
        T5["searchCode"]
        T6["createIssue / updateIssue"]
        T7["mergePullRequest"]
        T8["getWorkflowRuns"]
        T9["…20+ more tools"]
    end

    subgraph Memory["Memory & Persistence"]
        SM["Supermemory\n(cross-session memories)"]
        DB[("PostgreSQL\nChatConversation\nChatMessage")]
        EMB[("Embeddings\n(Mixedbread / pgvector)")]
    end

    PANEL --> UI
    UI -- "POST (streaming)" --> GHOST
    GHOST --> OR
    GHOST --> ANT
    GHOST --> Tools
    Tools --> GH["GitHub API\n(via Octokit)"]
    GHOST --> SM
    GHOST --> DB
    GHOST --> EMB
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant UI as ai-chat.tsx
    participant Route as /api/ai/ghost
    participant Auth as auth.ts
    participant Billing as billing/usage-limit.ts
    participant Memory as Supermemory
    participant DB as PostgreSQL
    participant LLM as LLM (OpenRouter)
    participant GitHub as GitHub API

    User->>UI: Types message, presses Enter
    UI->>Route: POST {messages, conversationId, model, context}

    Route->>Auth: getServerSession(headers)
    Auth-->>Route: {userId, token, githubUser}

    Route->>Billing: checkUsageLimit(userId)
    Billing->>DB: SELECT spending_limit, total_spend
    alt Over limit
        Billing-->>Route: over-limit error
        Route-->>UI: 402 with billing error code
    end

    Route->>DB: getOrCreateConversation(userId, contextKey)
    DB-->>Route: conversationId

    Route->>Memory: recallMemoriesForContext(userId, messages)
    Memory-->>Route: relevant memories (injected into system prompt)

    Route->>LLM: streamText({model, system, messages, tools})

    loop 0–N tool calls
        LLM-->>Route: tool_call {name, args}
        Route->>GitHub: execute tool (e.g. GET /repos/…)
        GitHub-->>Route: result
        Route->>LLM: tool_result
    end

    LLM-->>Route: text stream
    Route-->>UI: SSE text chunks

    Route->>DB: saveMessages(conversationId, messages)
    Route->>DB: logTokenUsage(userId, model, promptTokens, completionTokens, cost)
    Note over Route,DB: via waitUntil() — non-blocking
```

---

## Model Selection

Ghost supports multiple LLM providers and a smart **auto** mode:

```typescript
// src/app/api/ai/ghost/route.ts
const GHOST_MODELS = {
    default:       process.env.GHOST_MODEL        || "moonshotai/kimi-k2.5",
    mergeConflict: process.env.GHOST_MERGE_MODEL  || "google/gemini-2.5-pro-preview",
};

function resolveModel(userModel: string, task: GhostTaskType): string {
    if (userModel !== "auto") return userModel;
    return GHOST_MODELS[task] ?? GHOST_MODELS.default;
}
```

| User setting | Resolved model |
|---|---|
| `"auto"` (default) | `GHOST_MODEL` env var or `moonshotai/kimi-k2.5` |
| `"auto"` on merge-conflict task | `GHOST_MERGE_MODEL` or `google/gemini-2.5-pro-preview` |
| Any other string | Used verbatim (OpenRouter model ID) |

Users can override the model in **Settings → AI Model**, or supply their own OpenRouter API key.

---

## Available Tools

All tools are wrapped by `withSafeTools()` — a single tool failure (GitHub 403, rate limit, etc.) returns `{error: "…"}` to the LLM instead of crashing the stream.

### Read Tools

| Tool | Description |
|------|-------------|
| `searchPullRequests` | Full-text search PRs in a repository |
| `getPullRequest` | Get a single PR with diff and review comments |
| `searchIssues` | Search issues by keyword / label / state |
| `getIssue` | Get a single issue with all comments |
| `getRepoFileTree` | List directory contents |
| `getFileContent` | Read a single file |
| `searchCode` | Semantic search over indexed file content |
| `getWorkflowRuns` | List CI/CD workflow runs |
| `getCommit` | Inspect a specific commit |
| `getUserProfile` | GitHub user or org profile |
| `getRepoDetails` | Repository metadata, topics, license |
| `compareCommits` | Diff between two refs |
| `recallMemory` | Query Supermemory for past context |

### Write Tools

| Tool | Description |
|------|-------------|
| `createIssue` | Open a new issue |
| `updateIssue` | Edit title / body / state / labels |
| `createIssueComment` | Post a comment on an issue |
| `createPullRequestComment` | Post a review comment on a PR |
| `mergePullRequest` | Merge a PR (squash / merge / rebase) |
| `closePullRequest` | Close a PR without merging |
| `runE2BSandbox` | Execute code in a sandboxed E2B environment |
| `saveMemory` | Persist a fact to Supermemory for future sessions |

---

## Billing & Rate Limiting

Every completed AI call is logged for billing purposes:

```mermaid
graph LR
    STREAM["Completed stream"] --> LOG["logTokenUsage()\n(logFixedCostUsage for tools)"]
    LOG --> DB1[("AiCallLog\nmodel, promptTokens,\ncompletionTokens, cost")]
    LOG --> DB2[("UsageLog\naggregate per day")]
    DB2 --> LIMIT["checkUsageLimit()\ncalled before next request"]
    LIMIT --> LED[("CreditLedger\nremaining balance")]
```

- **`AiCallLog`** — one row per API call, raw token counts
- **`UsageLog`** — aggregated cost per user per day
- **`CreditLedger`** — credit balance with optional expiry (welcome credits, purchased credits)
- **`SpendingLimit`** — a configurable monthly hard cap (default: $10)

If a user exceeds their spending limit, the `/api/ai/ghost` route returns a structured billing error code and the UI shows an upgrade prompt.

---

## Conversation Persistence

Conversations are stored in two PostgreSQL tables:

```
ChatConversation
  id             — UUID
  userId         — owner
  chatType       — "ghost" | "pr" | "issue" | "repo" | …
  contextKey     — unique key tying conversation to a GitHub resource
                   e.g. "repo:owner/name" or "pr:owner/name/42"
  title          — auto-generated or user-edited
  activeStreamId — ID of any in-progress stream (for resumable streaming)

ChatMessage
  id             — UUID
  conversationId — FK → ChatConversation
  role           — "user" | "assistant" | "tool"
  content        — text content
  partsJson      — JSON array of message parts (for tool calls, images)
  createdAt      — timestamp
```

### Resumable Streaming

The `activeStreamId` field plus `streamContext` from `lib/resumable-stream.ts` allow a client to reconnect to an in-progress stream if the connection drops. The stream is replayed from the last confirmed chunk.

---

## Memory (Supermemory)

When `SUPER_MEMORY_API_KEY` is set, Ghost gains two additional tools:

- **`saveMemory`** — persists a user preference or fact across sessions
- **`recallMemory`** — hybrid-search for relevant past memories

Additionally, Ghost automatically recalls relevant memories **before** each LLM call by searching with the user's latest message as the query. Recalled memories are injected into the system prompt.

---

## Context Awareness

The `global-chat-panel.tsx` component detects the current route and injects page context into Ghost's initial system prompt:

| Current page | Ghost context |
|---|---|
| `/owner/repo` | Repo name, description, top language |
| `/owner/repo/pull/42` | PR title, number, diff summary |
| `/owner/repo/issues/7` | Issue title, labels, body |
| `/notifications` | "User is on the notifications page" |
| Anywhere | User's GitHub login, display name |

This context is sent as part of the system prompt, allowing Ghost to answer questions like "what's this PR about?" without the user having to specify the repo.

---

## Adding a New Tool

See [Adding New Tooling](./adding-tooling.md) for a complete walkthrough of adding a new Ghost tool.
