# Client → oRPC → Data Access Layer → Durable Object

This document traces how a browser action travels through every layer of the stack, from a React component all the way into a Durable Object, and back.

## Overview

```
Browser (React)
    │  orpcClient.<procedure>(input)
    ▼
client/lib/orpc.ts          RPCLink over HTTP POST /api/orpc/<procedure>
    │
    ▼
client/routes/api/orpc.$.ts  TanStack Start server route (RPCHandler)
    │
    ▼
server/orpc/middleware.ts    base → authorized (session validation via Better Auth)
    │
    ▼
server/orpc/router.ts        procedure handler
    │
    ▼
server/data-access-layer/    DAL function (never touches DB/DO directly from UI)
    │
    ├─► server/durable-objects/github-agent-stub.ts     → GitHubAgent DO
    │                                                     (preferences, tokens, chat)
    │
    └─► server/durable-objects/prompt-template-stub.ts  → PromptTemplateDO
                                                          (template CRUD, run history)
```

## Layer-by-Layer Walkthrough

### 1. Browser — `client/lib/orpc.ts`

All browser-initiated server calls go through a single typed client:

```typescript
import { orpcClient } from '@/web/lib/orpc';

// In a React event handler or mutation:
const value = await orpcClient.preferences.get({ key: 'theme' });
await orpcClient.preferences.set({ key: 'theme', value: 'dark' });
```

`orpcClient` is created with two transport features:

- **`RPCLink`** — sends standard oRPC calls as HTTP POST to `/api/orpc`
- **`DurableIteratorLinkPlugin`** — when a procedure returns an async iterator, the plugin upgrades the connection to a WebSocket at `/api/orpc/durable-iterator` for real-time streaming

```typescript
// client/lib/orpc.ts
export const orpcClient: RouterClient<typeof router> = createORPCClient(
  new RPCLink({
    url: '/api/orpc',
    plugins: [
      new DurableIteratorLinkPlugin({
        url: () => {
          const url = new URL('/api/orpc/durable-iterator', window.location.origin);
          url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          return url;
        },
      }),
    ],
  }),
);
```

> Only use `orpcClient` in browser contexts (event handlers, mutations). For server-side data loading use TanStack Start server functions directly.

### 2. HTTP Transport — `client/routes/api/orpc.$.ts`

The TanStack Start file-based route at `client/routes/api/orpc.$.ts` mounts the oRPC `RPCHandler` for all requests under `/api/orpc/**`.

```typescript
// client/routes/api/orpc.$.ts
const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error('[oRPC]', error))],
  plugins: [new DurableIteratorHandlerPlugin()],
});

export const Route = createFileRoute('/api/orpc/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(request, {
          prefix: '/api/orpc',
          context: { headers: request.headers, env },
        });
        return response ?? new Response('Not Found', { status: 404 });
      },
    },
  },
});
```

The handler receives `{ headers, env }` as the initial oRPC context. `env` is the Cloudflare Workers environment, giving procedures access to D1, Durable Object namespaces, KV, etc.

### 3. Middleware — `server/orpc/middleware.ts`

Two middleware layers wrap every procedure:

**`base`** — sets up the initial context type (headers + Cloudflare env):

```typescript
export const base = os.$context<{ headers: Headers; env: Cloudflare.Env }>();
```

**`authorized`** — validates the Better Auth session and injects `session` + `user` into context. Throws `UNAUTHORIZED` if no valid session exists:

```typescript
export const authorized = base.middleware(async ({ context, next }) => {
  const sessionData = await createAuth(context.env).api.getSession({
    headers: context.headers,
  });
  if (!sessionData?.session || !sessionData?.user) {
    throw new ORPCError('UNAUTHORIZED');
  }
  return next({ context: { session: sessionData.session, user: sessionData.user, env: context.env } });
});
```

All procedures that require a logged-in user chain `.use(authorized)`.

### 4. Router & Procedures — `server/orpc/router.ts`

The router is a plain object of procedures and sub-routers:

```typescript
// server/orpc/router.ts
export const router = {
  health: base.handler(() => ({ status: 'ok', timestamp: new Date().toISOString() })),
  preferences,       // imported from server/orpc/routes/preferences.ts
  promptTemplates,   // imported from server/orpc/routes/prompt-templates.ts
};
```

Sub-routers live in `server/orpc/routes/`. Each procedure follows the same pattern:

```typescript
// server/orpc/routes/preferences.ts
export const preferences = {
  get: base
    .use(authorized)
    .input(z.object({ key: z.string() }))
    .handler(async ({ input, context }) =>
      getPreference(context.env, context.session.userId, input.key)
    ),
};
```

**Rules:**
- Procedures must call DAL functions — never query D1 or call DO stubs directly
- All inputs at system boundaries must be validated with Zod
- Use `base.use(authorized)` for any procedure requiring a session

### 5. Data Access Layer — `server/data-access-layer/`

DAL functions are the only place that can talk directly to D1 (via Drizzle), Durable Objects, or external APIs (GitHub via Octokit, Stripe). They receive `env` and a user identifier, and return typed results.

```typescript
// server/data-access-layer/preferences.ts
import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';

function getStub(env: Cloudflare.Env, userId: string) {
  return getGitHubAgentStub(env, userId);
}

export async function getPreference(env, userId, key): Promise<string | null> {
  return getStub(env, userId).getPreference(key);
}

export async function setPreference(env, userId, key, value): Promise<void> {
  return getStub(env, userId).setPreference(key, value);
}
```

The DAL never imports from `client/` or `server/orpc/`. It is a pure data layer.

### 6. Durable Object Stub — `server/durable-objects/github-agent-stub.ts`

All code that needs to call into a `GitHubAgent` DO must go through `getGitHubAgentStub()`:

```typescript
export function getGitHubAgentStub(
  env: Pick<Cloudflare.Env, 'GitHubAgent'>,
  userId: string,
): DurableObjectStub<GitHubAgent> {
  return env.GitHubAgent.getByName(userId);
}
```

Using this factory ensures:
- Every stub is consistently named after the user ID via `getByName()`
- There is a single place to update stub creation if the naming scheme changes

### 7. Durable Object — `server/durable-objects/github-agent.ts`

The `GitHubAgent` DO receives the RPC call from the stub proxy. Methods decorated with `@callable()` are automatically exposed as typed RPC endpoints by the Cloudflare Agents framework:

```typescript
// In GitHubAgent
async getPreference(key: string): Promise<string | null> {
  const rows = this.sql<{ value: string }>`
    SELECT value FROM user_preferences WHERE key = ${key} LIMIT 1
  `;
  return rows[0]?.value ?? null;
}
```

The DO reads from its embedded SQLite database and returns the result directly up through the stub, DAL, procedure, and back to the browser.

## DurableIterator (Real-Time Streaming) Flow

For procedures that return async iterators (server-push), the flow uses a separate `GitHubAgentEvents` DO:

```
Browser orpcClient  (DurableIteratorLinkPlugin detects async iterator)
    │
    │  WebSocket upgrade to /api/orpc/durable-iterator
    ▼
server/index.ts     isDurableIteratorRequest() check
    │
    ▼
server/orpc/durable-iterator.ts   upgradeGitHubAgentEventsRequest()
    │
    ▼
GitHubAgentEvents DO              DurableIteratorObject manages signed WS session
    │
    ▼  events published via publishEvent()
Browser receives real-time updates
```

**Why a separate DO?** `GitHubAgent` extends `AIChatAgent`, which owns and manages its own WebSocket connections for AI chat. Mixing oRPC DurableIterator WebSockets into the same DO required complex filtering logic to distinguish oRPC connections from chat connections. Separating them into `GitHubAgentEvents` gives each class a single responsibility and eliminates that complexity.

### WebSocket Upgrade Routing

`server/orpc/durable-iterator.ts` exposes two helpers used in `server/index.ts`:

```typescript
// server/index.ts
if (isDurableIteratorRequest(url)) {
  return upgradeGitHubAgentEventsRequest(request, env);
}
```

`upgradeGitHubAgentEventsRequest` delegates to the oRPC `upgradeDurableIteratorRequest` helper, which selects the correct `GitHubAgentEvents` instance and validates the signed token.

## Adding a New Procedure

1. **Write a DAL function** in `server/data-access-layer/`:

   ```typescript
   // server/data-access-layer/my-feature.ts
   import { getGitHubAgentStub } from '@/server/durable-objects/github-agent-stub';

   export async function doSomething(env: Cloudflare.Env, userId: string, id: string) {
     return getGitHubAgentStub(env, userId).someCallableMethod(id);
   }
   ```

   **Write unit tests** for the DAL function in `__tests__/server/data-access-layer/my-feature.test.ts`. Use nock to intercept any HTTP requests; no real network calls are permitted in tests. Cover the success path, error paths, and any auth or existence guards.

2. **Add a procedure** in `server/orpc/routes/` or directly in `server/orpc/router.ts`:

   ```typescript
   import { z } from 'zod';
   import { authorized, base } from '@/server/orpc/middleware';
   import { doSomething } from '@/server/data-access-layer/my-feature';

   export const myFeature = {
     doSomething: base
       .use(authorized)
       .input(z.object({ id: z.string() }))
       .handler(async ({ input, context }) =>
         doSomething(context.env, context.session.userId, input.id)
       ),
   };
   ```

3. **Register** the sub-router in `server/orpc/router.ts`:

   ```typescript
   import { myFeature } from '@/server/orpc/routes/my-feature';
   export const router = { health, preferences, myFeature };
   ```

4. **Call from the browser**:

   ```typescript
   import { orpcClient } from '@/web/lib/orpc';
   const result = await orpcClient.myFeature.doSomething({ id: '123' });
   ```

## Real Example: Prompt Templates

The `promptTemplates` sub-router demonstrates the full pattern with a dedicated DO:

```
Browser
  orpcClient.promptTemplates.list()
    → server/orpc/routes/prompt-templates.ts  (authorized middleware)
      → server/data-access-layer/prompt-templates.ts  (DAL)
        → getPromptTemplateDOStub(env, userId)  (stub factory)
          → PromptTemplateDO.listTemplates()  (DO SQLite query)
```

Key difference from preferences: prompt templates use their own `PromptTemplateDO` instead of `GitHubAgent`, with a separate stub factory (`getPromptTemplateDOStub`). The auth chain is identical — `context.session.userId` from the `authorized` middleware flows through to `env.PromptTemplateDO.idFromName(userId)`, ensuring per-user isolation.
