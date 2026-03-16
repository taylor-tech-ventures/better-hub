# Feature: Account & Settings

The settings page gives you full control over your gh-admin account: profile visibility, UI preferences, organization authorization status, data export, and account deletion.

---

## What It Does

- View your GitHub profile as seen by gh-admin
- Check which organizations have authorized the GitHub OAuth App
- Manage UI preferences (theme)
- Export all your personal data as JSON
- Delete your account and all associated data

---

## How to Access

| Location | Action |
|---|---|
| `/dashboard/settings` | Direct URL |
| Nav drawer | Click **Settings** in the left sidebar |
| App menubar | **Settings** menu → **Settings Page** |

---

## Account Tab

### GitHub Profile Card

Shows your GitHub profile as gh-admin sees it:
- Avatar, display name, GitHub login (@handle)
- Email address
- Member since date

This data comes from your GitHub OAuth token and reflects your current GitHub profile.

### Organizations

Lists every organization you belong to with authorization status:

| Status | Meaning |
|---|---|
| **Authorized** | The gh-admin OAuth App is approved for this org; all tools work |
| **Not Authorized** | The OAuth App has not been approved; org-level tools will fail with 403 |

**Not authorized?** Click the **Authorize** button next to the org. This opens:
```
https://github.com/settings/connections/applications/{GITHUB_CLIENT_ID}
```

On that page, you (or an org owner) can request or approve OAuth App access. Once approved, the badge updates automatically on the next page load.

### Danger Zone

#### Export Data

Downloads a JSON file containing all your gh-admin data:
- GitHub profile (name, login, email)
- User preferences (theme, dismissed banners, etc.)
- Subscription information (plan, Stripe customer ID, billing dates)
- Full conversation history (all AI chat turns)

The file is generated on demand and downloaded immediately. Exported data is formatted as structured JSON.

#### Delete Account

Permanently removes your gh-admin account:

1. Type your GitHub login handle to confirm
2. Click **Delete Account**

**What gets deleted:**
- Your user record and session from D1
- Your `GitHubAgent` Durable Object (all tokens, preferences, conversation history, entity cache, usage stats)
- Your `PromptTemplateDO` Durable Object (all templates and run history)
- Your Stripe customer record (if you have/had a paid subscription, the subscription is cancelled first)

**What is NOT deleted:**
- Your GitHub account (unaffected)
- Anonymized analytics data in the Analytics Engine (no PII — user IDs are hashed)

Account deletion is **immediate and irreversible**. If you have an active subscription, it is cancelled at the moment of deletion with no further charges.

---

## Preferences Tab

### Theme

Choose between **Light**, **Dark**, and **System** (follows OS preference).

- The theme is stored in your `GitHubAgent` Durable Object — not in `localStorage`
- It is loaded server-side at SSR time, so there is no flash of unstyled content on page load
- Changes take effect immediately without a page reload
- The setting persists across devices and sessions

---

## Billing Tab

Shows a summary of your current subscription plan with a link to the full billing page at `/dashboard/billing`.

For full subscription management — viewing invoices, changing payment method, upgrading or cancelling — use the billing page directly.

---

## E2E Test Scenarios

### Scenario 1: Profile display
1. Log in; navigate to `/dashboard/settings`
2. **Expect:** Account tab is default; GitHub avatar, display name, login handle, and email are shown; all match your GitHub profile

### Scenario 2: Organization list with authorization badges
1. Navigate to Settings → Account tab
2. **Expect:** All orgs you belong to are listed; each has either "Authorized" (green) or "Not Authorized" (orange/red) badge; at least one is shown

### Scenario 3: Unauthorized org — authorize flow
1. Identify an org shown as "Not Authorized"
2. Click its **Authorize** button
3. **Expect:** Redirects to `github.com/settings/connections/applications/[id]`; after granting access on GitHub and returning, the badge updates on next settings load

### Scenario 4: Theme switch — Light to Dark
1. Navigate to Settings → Preferences tab
2. Select **Dark** theme
3. **Expect:** Page immediately switches to dark mode; refreshing the page preserves dark mode (SSR-loaded)

### Scenario 5: Theme switch — System
1. Select **System** theme
2. Change OS theme from light to dark (or vice versa)
3. **Expect:** UI follows the OS preference change in real time

### Scenario 6: Theme persists across sessions
1. Set theme to **Dark**; log out; log back in
2. **Expect:** Dark theme loads immediately without flash; SSR renders the correct theme class

### Scenario 7: Export data
1. Navigate to Settings → Account → Danger Zone
2. Click **Export Data**
3. **Expect:** JSON file downloads; file contains `profile`, `preferences`, `subscription`, and `chatHistory` keys; `chatHistory` is an array of message objects; preferences include `theme`

### Scenario 8: Delete account — cancel
1. Click **Delete Account** in the Danger Zone
2. Type an incorrect GitHub login handle
3. Click the confirmation button
4. **Expect:** Delete button stays disabled (or shows error); account is not deleted

### Scenario 9: Delete account — confirmation required
1. Click **Delete Account**
2. Type the correct GitHub login handle
3. **Expect:** Delete button becomes active; can now confirm

### Scenario 10: Delete account — full flow
1. (Use a test account) Complete the delete account confirmation
2. **Expect:** Redirected to the login page (`/`); attempting to log in again with the same account creates a fresh account with empty history and no subscription

---

## Technical Reference

| Component | Location |
|---|---|
| Settings page | `clients/web/routes/dashboard/settings.tsx` |
| Account oRPC procedures | `server/orpc/routes/account.ts` |
| Preferences oRPC procedures | `server/orpc/routes/preferences.ts` |
| Theme provider | `clients/web/providers/theme-provider.tsx` |
| `getGitHubUserOrgsWithAccess` DAL | `server/data-access-layer/github/org/get-user-orgs-with-access.ts` |
| `account.delete` procedure | Cancels Stripe subscription + calls `deleteAllData()` on DO |
| `account.exportData` procedure | Calls `getChatHistory()` on DO + queries D1 for profile/subscription |
| `GitHubAgent.deleteAllData()` | Wipes all DO SQLite tables, KV storage, chat history |
| `PromptTemplateDO` deletion | Triggered via `afterDelete` auth hook |
| Theme storage | `user_preferences` table in DO SQLite (key=`theme`) |
| Org access cache | `dash_orgs_access_cache` preference (15-min TTL) |
