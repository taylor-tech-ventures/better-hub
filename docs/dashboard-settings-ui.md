# Dashboard Overview & Settings Pages

**Status:** Implemented
**Priority:** P2 — UX Polish
**Scope:** Medium

---

## Summary

A full settings page (`/dashboard/settings`) has been added with Account, Preferences, and Billing tabs. All user preferences are stored exclusively in the per-user `GitHubAgent` Durable Object — no `localStorage`. The GitHub org card on both the dashboard and settings page shows whether each org has authorized the GitHub OAuth App, with a direct link to approve it.

---

## What Was Built

### Settings Page (`/dashboard/settings`)

**Account tab:**
- GitHub profile card (avatar, name, GitHub login, email, member-since date)
- Organizations card — lists all orgs the user belongs to with authorized/unauthorized status badges; unauthorized orgs show an "Authorize" link to `https://github.com/settings/connections/applications/{GITHUB_CLIENT_ID}`
- Danger zone: Export Data (downloads JSON) and Delete Account (requires typing GitHub login to confirm)

**Preferences tab:**
- Theme selector (Light / Dark / System) — reads from `useTheme()` (backed by DO via oRPC); writes via `orpcClient.preferences.set`; no `localStorage`

**Billing tab:**
- Summary of current plan and a link through to `/dashboard/billing`

### Navigation
- Settings link added to the nav drawer (below Security)
- "Settings Page" link added to the app menubar Settings menu

### oRPC Procedures

| Procedure | Description |
|---|---|
| `account.delete` | Deletes account after checking for active subscription; wipes DO data + D1 user record |
| `account.exportData` | Returns sanitized JSON: profile, preferences (without internal keys), subscription info, chat history |
| `github.getOrgsWithAccess` | Returns orgs annotated with `authorized: boolean`; DO-cached for 15 minutes |

### DAL Functions

| Function | File |
|---|---|
| `getGitHubUserOrgsWithAccess` | `server/data-access-layer/github/org/get-user-orgs-with-access.ts` |

Tests: `__tests__/server/data-access-layer/github/org/get-user-orgs-with-access.test.ts`

### GitHubAgent DO
- Added `getChatHistory()` `@callable()` method — returns `this.messages` for use in data export

---

## Preference Storage Contract

All user preferences live exclusively in the `GitHubAgent` Durable Object SQLite (`user_preferences` table, key/value rows). The oRPC procedures in `server/orpc/routes/preferences.ts` are the only write path. **No component may use `localStorage` or `sessionStorage` for user preferences.**

Known preference keys:

| Key | Values | Description |
|---|---|---|
| `theme` | `light` \| `dark` \| `system` | UI color theme |
| `dash_orgs_cache` | JSON string | Cached org list (15-min TTL) |
| `dash_orgs_cached_at` | Unix ms string | Cache timestamp for org list |
| `dash_orgs_access_cache` | JSON string | Cached org+access list (15-min TTL) |
| `dash_orgs_access_cached_at` | Unix ms string | Cache timestamp for org access list |
| `dash_org_repos_{org}` | JSON string | Cached repo list per org |
| `dash_org_repos_{org}_at` | Unix ms string | Cache timestamp per org |
| `schedulingBannerDismissed` | `true` | Dashboard scheduling banner dismissed |

---

## GitHub Org Authorization

The `getGitHubUserOrgsWithAccess` DAL function probes each org the user belongs to with `GET /orgs/{org}`:

- **200** → `authorized: true` (OAuth App is approved for this org)
- **403 / 404 / other** → `authorized: false`

Probes run in parallel. Results are cached in DO preferences under `dash_orgs_access_cache` / `dash_orgs_access_cached_at` (15-min TTL).

Unauthorized orgs surface an **Authorize** link to:
```
https://github.com/settings/connections/applications/{GITHUB_CLIENT_ID}
```
This is the GitHub page where users can request (or org owners can approve) third-party OAuth App access.

---

## Files Changed

```
server/
  data-access-layer/github/org/get-user-orgs-with-access.ts  ← new
  durable-objects/github-agent.ts                             ← getChatHistory() added
  functions/settings.ts                                       ← new server function
  orpc/routes/account.ts                                      ← new
  orpc/routes/github.ts                                       ← getOrgsWithAccess added
  orpc/router.ts                                              ← account registered

clients/web/
  routes/dashboard/settings.tsx                               ← new page
  routes/dashboard/index.tsx                                  ← org card → getOrgsWithAccess + badges
  components/layout/nav-drawer.tsx                            ← Settings link added
  components/layout/app-menubar.tsx                           ← Settings Page menu item added

__tests__/
  server/data-access-layer/github/org/get-user-orgs-with-access.test.ts  ← new
```
