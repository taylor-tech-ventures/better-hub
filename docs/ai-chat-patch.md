# @cloudflare/ai-chat Patch: Duplicate Assistant Message Fix

Tracks the pnpm patch applied to `@cloudflare/ai-chat@0.1.8` and the client-side
workaround in `interface.tsx`. Both should be removed once the upstream package
ships a fix.

**Upstream issue:** https://github.com/cloudflare/agents/issues/1108

## The bugs

When a tool requiring user approval triggers a server continuation
(`autoContinue: true`), three bugs combine to produce duplicate assistant
messages in the chat UI:

### Bug 1 — Client: `start` chunk overwrites continuation messageId (react.js)

Inside the `CF_AGENT_USE_CHAT_RESPONSE` handler in `useAgentChat`, the
continuation correctly captures the last assistant message's ID:

```ts
if (isContinuation) {
  // finds last assistant, sets messageId = existingMessage.id  ✅
}
```

But a few lines later, the `start` chunk from `streamText` unconditionally
overwrites it with a new AI SDK-generated ID:

```ts
if (chunkData.messageId != null && chunkData.type === "start")
  activeMsg.messageId = chunkData.messageId; // ← overwrites even during continuations
```

`flushActiveStreamToMessages` then can't find a message with the new ID and
appends a duplicate.

### Bug 2 — Client: `CF_AGENT_CHAT_MESSAGES` invalidates active stream (react.js)

When the server broadcasts a full messages sync (`CF_AGENT_CHAT_MESSAGES`)
during a continuation — for example after `_findAndUpdateToolPart` calls
`persistMessages` — the message IDs in the broadcast may differ from the ID
held by `activeStreamRef.current.messageId`. The `setMessages(data.messages)`
call replaces the entire array, but the active stream still references the old
ID. Subsequent `flushActiveStreamToMessages` calls append instead of updating.

### Bug 3 — Server: `earlyPersistedId + continuation` collision (index.js)

When a tool requiring approval is called during streaming, the server
early-persists the message (sets `earlyPersistedId`). When the user approves
and `autoContinue` triggers a continuation, both `earlyPersistedId` and
`continuation` are true in `_reply`. The existing code only handles these flags
independently — the `earlyPersistedId` branch wins, replacing the early-persisted
row with the continuation's new message object instead of merging. Because
`persistMessages` only UPSERTs (INSERT ON CONFLICT UPDATE), the stale
early-persisted row is never deleted, creating a second assistant message in
DO SQLite.

## What the patch changes

**Patch file:** `patches/@cloudflare__ai-chat@0.1.8.patch`
**Config:** `package.json` → `pnpm.patchedDependencies`

### react.js — Fix for Bug 1

```diff
- if (chunkData.messageId != null && chunkData.type === "start") activeMsg.messageId = chunkData.messageId;
+ if (chunkData.messageId != null && chunkData.type === "start" && !isContinuation) activeMsg.messageId = chunkData.messageId;
```

Preserves the correctly-captured messageId during continuations.

### react.js — Fix for Bug 2

Before `setMessages(data.messages)` in the `CF_AGENT_CHAT_MESSAGES` handler,
remap `activeStreamRef.current.messageId` if the old ID no longer exists in the
incoming messages:

```js
if (activeStreamRef.current) {
  const activeMsg = activeStreamRef.current;
  const stillExists = data.messages.some((m) => m.id === activeMsg.messageId);
  if (!stillExists) {
    for (let i = data.messages.length - 1; i >= 0; i--) {
      if (data.messages[i].role === "assistant") {
        activeMsg.messageId = data.messages[i].id;
        break;
      }
    }
  }
}
```

### index.js — Fix for Bug 3

When `earlyPersistedId` and `continuation` are both true, explicitly DELETE
the stale early-persisted row from DO SQLite, clear the persisted message cache,
reload messages from DB, then merge the continuation's parts into the last
assistant message (same logic as the existing `continuation`-only branch):

```js
if (continuation) {
  this.sql`delete from cf_ai_chat_agent_messages where id = ${earlyPersistedId}`;
  this._persistedMessageCache.delete(earlyPersistedId);
  this.messages = autoTransformMessages(this._loadMessagesFromDb());
  // find last assistant, merge parts, persistMessages(...)
}
```

## Client-side workaround in interface.tsx

`client/components/ui/chat/interface.tsx` contains a render-level dedup in
`MessageParts` (lines 151-167) that filters duplicate tool parts by
`toolCallId`, keeping the last occurrence:

```tsx
const dedupedParts = useMemo(() => {
  const seen = new Map<string, number>();
  for (let i = 0; i < message.parts.length; i++) {
    const part = message.parts[i];
    if ('toolCallId' in part && typeof part.toolCallId === 'string') {
      seen.set(part.toolCallId, i);
    }
  }
  return message.parts.filter((part, idx) => {
    if ('toolCallId' in part && typeof part.toolCallId === 'string') {
      return seen.get(part.toolCallId) === idx;
    }
    return true;
  });
}, [message.parts]);
```

This catches any remaining edge cases where the same tool part appears twice
within a single message during streaming. It is harmless but unnecessary once
the upstream bugs are fixed.

## How to revert once upstream is fixed

When `@cloudflare/ai-chat` ships a version that fixes the three bugs above
(check the upstream issue for status), follow these steps:

### 1. Update the package

```bash
pnpm update @cloudflare/ai-chat
```

### 2. Remove the patch

```bash
rm patches/@cloudflare__ai-chat@0.1.8.patch
```

Remove the `pnpm.patchedDependencies` entry from `package.json`:

```diff
- "pnpm": {
-   "patchedDependencies": {
-     "@cloudflare/ai-chat@0.1.8": "patches/@cloudflare__ai-chat@0.1.8.patch"
-   }
- }
```

Then reinstall:

```bash
pnpm install
```

### 3. Remove the render-level dedup workaround

In `client/components/ui/chat/interface.tsx`, inside the `MessageParts`
component:

1. Delete the `dedupedParts` useMemo (lines 151-167)
2. Replace all references to `dedupedParts` with `message.parts`:
   - `approvalPendingParts` filter (uses `dedupedParts`)
   - The `.map()` that renders tool cards (uses `dedupedParts`)

### 4. Remove the patches directory if empty

```bash
rmdir patches 2>/dev/null
```

### 5. Verify

Run the sequential and grouped tool approval flows in the chat UI and confirm:

- Single assistant message per turn (no duplicates)
- Continuation text merges into the same message as tool cards
- Page reload shows the same messages as live state
- No React duplicate key warnings in the console
