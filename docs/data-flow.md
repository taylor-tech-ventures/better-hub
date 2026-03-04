# Data Flow & Integration Layers

This document traces every significant data path in Better Hub — from a user action in the browser through the server API to storage (and back).

---

## Layer Overview

```mermaid
graph LR
    subgraph Browser["Browser (Client)"]
        RC["React Component\n(UI action)"]
        RSC["Server Component\n(initial render)"]
    end

    subgraph NextJS["Next.js Server"]
        AR["API Route\n/api/…"]
        SC_FETCH["RSC fetch\n(direct DB or lib call)"]
    end

    subgraph Services["Service / Library Layer"]
        AUTH_LIB["auth.ts\n(session validation)"]
        GH_LIB["github.ts\n(Octokit wrapper)"]
        CHAT_LIB["chat-store.ts\n(conversation helpers)"]
        BILLING_LIB["billing/\n(credits, limits)"]
    end

    subgraph Persistence["Persistence Layer"]
        PG[("PostgreSQL\n(Prisma)")]
        REDIS[("Upstash Redis\n(ETag / KV)")]
        S3[("S3 / R2\n(uploads)")]
    end

    subgraph External["External APIs"]
        GITHUB["GitHub API"]
        LLM["LLM Provider\n(OpenRouter / Anthropic)"]
        STRIPE_EXT["Stripe"]
    end

    RC -- "fetch / mutation" --> AR
    RSC -- "server-side call" --> SC_FETCH

    AR --> AUTH_LIB
    AR --> GH_LIB
    AR --> CHAT_LIB
    AR --> BILLING_LIB
    SC_FETCH --> GH_LIB

    AUTH_LIB --> PG
    CHAT_LIB --> PG
    BILLING_LIB --> PG
    BILLING_LIB --> STRIPE_EXT

    GH_LIB --> REDIS
    GH_LIB --> PG
    GH_LIB --> GITHUB

    AR -- "upload" --> S3
    AR -- "AI stream" --> LLM
```

---

## 1. Page Load (Server Components)

```mermaid
sequenceDiagram
    participant Browser
    participant NextServer as Next.js Server (RSC)
    participant GitHubLib as github.ts
    participant Redis
    participant PostgreSQL
    participant GitHubAPI as GitHub API

    Browser->>NextServer: GET /taylor/my-repo
    NextServer->>GitHubLib: getRepo(owner, repo)
    GitHubLib->>Redis: GET cache:repo:taylor/my-repo
    alt Cache hit (not stale)
        Redis-->>GitHubLib: cached JSON
    else Cache miss or stale
        GitHubLib->>PostgreSQL: SELECT github_cache_entries WHERE cache_key=…
        alt DB cache hit with ETag
            GitHubLib->>GitHubAPI: GET /repos/taylor/my-repo (If-None-Match: <etag>)
            alt 304 Not Modified
                GitHubAPI-->>GitHubLib: 304
                GitHubLib->>PostgreSQL: UPDATE synced_at
            else 200 OK
                GitHubAPI-->>GitHubLib: repo JSON + new ETag
                GitHubLib->>PostgreSQL: UPSERT github_cache_entries
                GitHubLib->>Redis: SET cache:repo:… TTL 60s
            end
        else No cache
            GitHubLib->>GitHubAPI: GET /repos/taylor/my-repo
            GitHubAPI-->>GitHubLib: repo JSON + ETag
            GitHubLib->>PostgreSQL: INSERT github_cache_entries
            GitHubLib->>Redis: SET cache:repo:…
        end
    end
    GitHubLib-->>NextServer: repo data
    NextServer-->>Browser: HTML (Server-rendered)
```

---

## 2. Client-Side Data Mutation (e.g. Star a Repo)

```mermaid
sequenceDiagram
    participant Browser
    participant APIRoute as /api/star-repo
    participant AuthLib as auth.ts
    participant GitHubLib as github.ts
    participant GitHubAPI as GitHub API
    participant Redis

    Browser->>APIRoute: POST {owner, repo}
    APIRoute->>AuthLib: getServerSession(headers)
    AuthLib-->>APIRoute: session + token
    APIRoute->>GitHubLib: starRepo(octokit, owner, repo)
    GitHubLib->>GitHubAPI: PUT /user/starred/:owner/:repo
    GitHubAPI-->>GitHubLib: 204
    GitHubLib->>Redis: DEL cache:starred-repos:userId
    GitHubLib-->>APIRoute: ok
    APIRoute-->>Browser: 200 {success: true}
    Note over Browser: React Query invalidates\nstarred repos query
```

---

## 3. AI Chat (Ghost) — Full Flow

See [AI Chat](./ai-chat.md) for deeper detail. Summary:

```mermaid
sequenceDiagram
    participant Browser
    participant GhostRoute as /api/ai/ghost
    participant AuthLib as auth.ts
    participant BillingLib as billing/usage-limit.ts
    participant LLM as LLM Provider (OpenRouter/Anthropic)
    participant GitHubAPI as GitHub API
    participant PostgreSQL

    Browser->>GhostRoute: POST {messages, conversationId, …} (streaming)
    GhostRoute->>AuthLib: getServerSession()
    AuthLib-->>GhostRoute: session

    GhostRoute->>BillingLib: checkUsageLimit(userId)
    BillingLib->>PostgreSQL: SELECT spending_limit, credit_ledger
    BillingLib-->>GhostRoute: ok / over-limit error

    GhostRoute->>PostgreSQL: getOrCreateConversation()

    GhostRoute->>LLM: streamText(messages, tools, model)

    loop Tool calls (0–N times)
        LLM-->>GhostRoute: tool_call (e.g. searchPRs)
        GhostRoute->>GitHubAPI: GitHub REST call
        GitHubAPI-->>GhostRoute: data
        GhostRoute->>LLM: tool_result
    end

    LLM-->>GhostRoute: text stream chunks
    GhostRoute-->>Browser: SSE chunks (streaming)

    GhostRoute->>PostgreSQL: saveMessages(conversation, messages)
    GhostRoute->>PostgreSQL: logTokenUsage(userId, model, tokens, cost)
```

---

## 4. Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant AuthRoute as /api/auth/*
    participant BetterAuth as Better Auth
    participant GitHubOAuth as GitHub OAuth
    participant PostgreSQL
    participant Stripe

    Browser->>AuthRoute: GET /api/auth/signin/github
    AuthRoute->>GitHubOAuth: Redirect → GitHub consent screen
    GitHubOAuth-->>Browser: Redirect → /api/auth/callback/github?code=…
    Browser->>AuthRoute: GET /api/auth/callback/github?code=…
    AuthRoute->>BetterAuth: handleCallback(code)
    BetterAuth->>GitHubOAuth: Exchange code for access_token
    GitHubOAuth-->>BetterAuth: access_token + user profile
    BetterAuth->>PostgreSQL: UPSERT user + account + session
    BetterAuth->>Stripe: createCustomer (if new user)
    BetterAuth-->>Browser: Set-Cookie session + Redirect /dashboard
```

---

## 5. File Upload

```mermaid
sequenceDiagram
    participant Browser
    participant UploadRoute as /api/upload
    participant AuthLib as auth.ts
    participant S3 as AWS S3 / R2

    Browser->>UploadRoute: POST multipart/form-data (file)
    UploadRoute->>AuthLib: getServerSession()
    AuthLib-->>UploadRoute: session
    UploadRoute->>S3: PutObject(bucket, key, body)
    S3-->>UploadRoute: ETag + URL
    UploadRoute-->>Browser: {url: "https://…"}
```

---

## 6. Background Sync (Inngest Jobs)

```mermaid
sequenceDiagram
    participant Trigger as Trigger (API route or schedule)
    participant PostgreSQL
    participant Inngest
    participant GitHubLib as github.ts
    participant GitHubAPI as GitHub API
    participant Redis

    Trigger->>PostgreSQL: INSERT github_sync_jobs (status=pending)
    Inngest->>PostgreSQL: CLAIM due jobs (UPDATE status=running)
    Inngest->>GitHubLib: execute job payload
    GitHubLib->>GitHubAPI: API call (with ETag)
    GitHubAPI-->>GitHubLib: data
    GitHubLib->>PostgreSQL: UPSERT github_cache_entries
    GitHubLib->>Redis: SET cache key
    GitHubLib->>PostgreSQL: UPDATE sync_job status=success
```

---

## Integration Layer Summary

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Client** | React 19 / TanStack Query | UI rendering, optimistic updates, streaming |
| **Server** | Next.js API Routes / RSC | Request handling, auth checks, orchestration |
| **Service** | `lib/*.ts` modules | Business logic, caching, external API calls |
| **Persistence** | PostgreSQL (Prisma) | Authoritative data store |
| **Cache** | Upstash Redis | Fast ETag cache, deduplication keys |
| **CDN/Storage** | S3 / R2 | Binary file storage |
| **GitHub API** | Octokit | Source of truth for GitHub data |
| **LLM** | OpenRouter / Anthropic | AI inference |
| **Jobs** | Inngest | Durable async work |
| **Payments** | Stripe | Subscriptions and billing events |
