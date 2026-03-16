# TODO: Security Hardening — Remaining Items

**Priority:** P1 — Required for Production Readiness
**Estimated Scope:** Small
**Dependencies:** None

---

## Context

A comprehensive security audit was performed on 2026-03-12 (see `docs/qa-audit-results.md`). Most findings were addressed immediately. This document tracks the remaining security items.

### Already Addressed (see `docs/qa-audit-results.md`)
- SEC-001: Admin action ownership check (CRITICAL)
- SEC-002: Token encryption at rest (HIGH)
- SEC-003: User deletion + inactivity cleanup (HIGH)
- SEC-004: Preferences input validation (HIGH)
- SEC-005: Admin analytics auth error handling (HIGH)
- SEC-006: Workflow user validation (HIGH)
- SEC-007: Admin actions retention policy (MEDIUM)
- SEC-008: Additive tools in approval list (MEDIUM)
- SEC-009: oRPC rate limiting (MEDIUM)
- SEC-010: System prompt hardening (MEDIUM)
- SEC-011: Billing portal returnUrl validation (MEDIUM)
- SEC-013: dangerouslySetInnerHTML safety comment (LOW)

### What's Already Secure
- Token isolation: 3-tier caching in per-user DOs
- SQL injection prevention: Drizzle ORM parameterized bindings
- Session management: 8-hour expiry, 1-hour auto-refresh
- PKCE OAuth flow
- Stripe webhook verification
- Zod input validation on all oRPC inputs

---

## Remaining Tasks

### 1. Security Headers ✅
- [x] Add security headers to all responses via `server/middleware/security-headers.ts`:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `X-XSS-Protection: 0` (disabled per OWASP — use CSP instead)
- [x] Add Content-Security-Policy:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline'` (Tailwind requires)
  - `connect-src 'self' https://api.github.com https://api.stripe.com wss:`
  - `img-src 'self' https://avatars.githubusercontent.com data:`
  - `frame-ancestors 'none'`

### 2. CORS Configuration ✅
- [x] Explicitly configure CORS headers in `server/middleware/security-headers.ts`
- [x] Allow only the application's own origin
- [x] Restrict methods to GET, POST, OPTIONS

### 3. WebSocket Authentication Verification
- [ ] Verify that Cloudflare Agents framework validates session on WebSocket upgrade
- [ ] If not, add session validation in `onConnect` handler
- [ ] Verify `GitHubAgentEvents` DO validates signed token from `durable-iterator.ts`
- [ ] Reject unauthenticated WebSocket connections with appropriate close codes

### 4. Sensitive Data Audit
- [x] Audit all `console.log`/`console.error` calls — migrated to structured pino logging; no tokens, secrets, or PII logged
- [x] GitHub webhook signature verification added (`server/webhooks/github-webhook-handler.ts`) using HMAC-SHA256 with timing-safe comparison
- [ ] Verify error responses never include internal stack traces
- [ ] Verify `admin_actions` payload doesn't store raw tokens

### 5. Session Geolocation Review (SEC-014)
- [ ] Review GDPR implications of storing geolocation data in sessions table
- [ ] If not needed for session management, disable in Better Auth config
- [ ] If kept, document in privacy policy

### 6. Legal Pages (Privacy Policy & Terms of Service) ✅
- [x] Create a **Privacy Policy** page at `/privacy-policy` (`client/routes/privacy-policy.tsx`)
  - Data collected: GitHub profile info (name, email, avatar), OAuth tokens (encrypted at rest), session data, usage analytics
  - Third-party services: GitHub API, Stripe (billing), OpenAI (AI features), Cloudflare (hosting, D1, Analytics Engine)
  - Token storage: AES-256-GCM encryption, 3-tier caching in per-user Durable Objects
  - Data retention: 28-day inactivity cleanup for free-tier users; `deleteAllData()` on account deletion
  - Session geolocation: document if retained per SEC-014 review
  - Include clear disclaimer: **GH Admin is not affiliated with, endorsed by, or sponsored by GitHub, Inc. or Microsoft Corporation**
- [x] Create a **Terms of Service** page at `/terms-of-service` (`client/routes/terms-of-service.tsx`)
  - Acceptable use: GitHub org administration via delegated OAuth scopes
  - AI-generated actions: user is responsible for approving destructive tool calls
  - Tool approval policy: destructive tools require explicit user confirmation before execution
  - Subscription tiers and usage limits (Free / Standard / Unlimited)
  - Service provided "as-is" on Cloudflare Workers infrastructure
  - Include clear disclaimer: **GH Admin is not affiliated with, endorsed by, or sponsored by GitHub, Inc. or Microsoft Corporation**
- [x] Add legal links to the **sign-in page** (`client/routes/index.tsx`) below the sign-in button
- [x] Add legal links to the **dashboard footer or menu** (`NavDrawer` footer with Privacy · Terms links)
- [x] Verify pages are accessible without authentication (public routes, no auth guard)
- [x] Reference URLs: `https://gh-admin.com/privacy-policy`, `https://gh-admin.com/terms-of-service`

### 7. Pre-Launch Security Checklist
- [ ] Document and execute:
  - `pnpm audit` — no high/critical vulnerabilities
  - All mutation oRPC procedures require `authorized` middleware
  - Token encryption active in D1 and DO SQLite
  - CORS rejects non-allowed origins
  - CSP blocks inline scripts
  - WebSocket connections require valid session
  - OAuth PKCE parameters validated
  - Rate limiting active on all endpoints
  - No tokens in structured logs
  - Expired sessions rejected

---

## Acceptance Criteria

- [x] Security headers set on all responses
- [x] CORS explicitly configured
- [ ] WebSocket authentication verified
- [x] No sensitive data in logs (migrated to structured pino logging)
- [x] Privacy Policy published at `/privacy-policy`
- [x] Terms of Service published at `/terms-of-service`
- [x] Legal links visible on sign-in page and in dashboard navigation
- [x] Both legal pages include "not affiliated with GitHub/Microsoft" disclaimer
- [ ] Pre-launch security checklist documented and executed
- [ ] `pnpm typecheck` passes
- [ ] Existing tests pass
