# TODO: Post-Launch Features (Deferred)

**Priority:** P3 — Post-Launch
**Estimated Scope:** Varies
**Dependencies:** All P1/P2 work complete

---

## Context

These features were evaluated during planning and intentionally deferred from the initial launch scope. They are documented here for future reference. Re-evaluate priority based on user feedback after launch.

---

## Deferred Features

### 1. Custom Prompt Templates (FR-5.1, FR-5.2) ✅ Implemented
- 10 prompt categories with editor UI
- Auto-save with 1-second debounce
- Subscription gating (Standard/Unlimited only)
- Max 2000 characters per template
- **Design doc:** `docs/custom-prompt-templates.md`

### ~~2. Background Entity Sync on Login~~ ✅ Done
- ~~Proactive cache population immediately after authentication~~
- ~~Periodic refresh during active sessions (every 15-30 minutes)~~
- **Implemented:** `backgroundEntitySync()` fires on login for paid/admin users.

### ~~3. Advanced Analytics Dashboard~~ ✅ Done
- ~~Tool execution trends over time~~
- ~~Most-used tools visualization~~
- ~~Organization activity breakdown~~
- **Implemented:** Monthly trend chart added to admin dashboard; KV-cached AE queries.

### 4. Multi-Tab Synchronization
- Consistent state across browser tabs
- SharedWorker or BroadcastChannel for cross-tab sync
- **Why deferred:** Single-tab works fine for launch.

### ~~5. Data Consent & Cookie Banner~~ ✅ Done
- ~~GDPR consent flow during onboarding~~
- ~~Cookie preference management~~
- **Implemented:** `CookieConsentBanner` component in root layout; localStorage-persisted consent.

### 6. Notification Preferences
- Email notifications for usage alerts
- In-app notifications for subscription changes
- **Why deferred:** Not critical for launch.

### ~~7. Product Spec Cleanup~~ ✅ Done
- ~~Update `Product-Specification.md` to remove Hono.js references (actual arch is TanStack Start + oRPC)~~
- ~~Align spec with actual 34-tool categorization~~
- ~~Update code examples to match real patterns~~
- **Implemented:** All Hono.js references replaced with TanStack Start + oRPC; code examples updated.

### 8. Performance Optimizations (from QA audit)
- ~~**OPT-009:** KV caching for Analytics Engine queries (5-min TTL)~~ ✅ Done — `ANALYTICS_CACHE` KV namespace with 5-min TTL in `queryAnalyticsEngine()`
- **OPT-018:** Batch session + theme preference fetch in root loader to reduce SSR round-trips
- **Why deferred:** OPT-018 still pending; optimize based on production metrics.

### 9. E2E Test: Destructive Tool Confirmation Flow (E2E-004)
- Full browser test of the approve/deny flow with real GitHub operations
- Uses `gh-admin-test` org for safe testing
- **Why deferred:** Requires careful setup to avoid unintended GitHub changes.
