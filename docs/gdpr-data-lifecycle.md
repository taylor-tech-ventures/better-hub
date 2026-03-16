# GDPR Compliance & Data Lifecycle

User data is managed with automatic cleanup for inactive accounts, full account deletion, and data minimization practices.

## 28-Day Inactivity Cleanup

Free-tier, non-admin users have their data automatically destroyed after 28 days of inactivity.

### How It Works

1. **On every login:** `scheduleInactivityCleanup()` is called, resetting the 28-day timer
2. **Timer mechanism:** Uses Cloudflare Agent framework's `schedule()` method, which persists across DO hibernation
3. **On expiry:** `checkInactivityCleanup` fires and calls `deleteAllData()` only for free-tier, non-admin users
4. **Paid/admin users:** Timer fires but cleanup is skipped — they retain data indefinitely

### Key Method: `scheduleInactivityCleanup()`
- Cancels any existing inactivity schedule
- Schedules `checkInactivityCleanup` for 28 days from now
- Called from the auth `afterSignIn` hook

## Account Deletion

### `deleteAllData()` (GitHubAgent DO)
Wipes all data stored in the user's Durable Object:
- DO SQLite tables (chat history, preferences, cached entities, encrypted tokens, usage stats)
- KV storage
- Chat history

### Auth `afterDelete` Hook
When a user is deleted from D1 (via Better Auth), the `afterDelete` hook calls `stub.deleteAllData()` to clean up the corresponding DO. This ensures:
- D1 user record cascade-deletes sessions, accounts, subscriptions
- DO state is fully destroyed
- No orphaned sensitive data remains

## Token Encryption at Rest

GitHub OAuth tokens are encrypted at rest using AES-256-GCM:

| Storage Location | Encryption |
|-----------------|------------|
| Memory cache (Tier 1) | Plaintext (isolated per DO instance) |
| DO SQLite (Tier 2) | AES-256-GCM encrypted |
| D1 `accounts` table (Tier 3) | AES-256-GCM encrypted |

### Key Files

| File | Purpose |
|------|---------|
| `server/lib/crypto.ts` | `encryptToken()` / `decryptToken()` using PBKDF2 key derivation from `AUTH_SECRET` |
| `server/durable-objects/github-agent.ts` | `#readTokensFromD1()` decrypts transparently; `setTokens()` encrypts on write |

### Migration Path
- Encrypted tokens use `enc:` prefix format: `enc:<base64(iv || ciphertext)>`
- `decryptToken()` handles migration: `enc:` prefixed values are decrypted, plaintext values pass through

## Data Minimization

- Only essential data is stored in D1 (user profile, sessions, accounts, subscriptions)
- DO stores only operational data (tokens, preferences, cache, usage stats)
- Entity cache stores metadata only (names, URLs, descriptions) — never tokens or secrets
- Admin action payloads have a 90-day retention policy with automatic cleanup

## Key Files

| File | Purpose |
|------|---------|
| `server/durable-objects/github-agent.ts` | `deleteAllData()`, `scheduleInactivityCleanup()`, `checkInactivityCleanup` |
| `server/durable-objects/github-agent-stub.ts` | `getGitHubAgentStub()` — factory for DO stubs |
| `server/auth/index.ts` | `afterDelete` hook, `afterSignIn` hook (triggers `scheduleInactivityCleanup`) |
| `server/lib/crypto.ts` | AES-256-GCM encryption/decryption |
