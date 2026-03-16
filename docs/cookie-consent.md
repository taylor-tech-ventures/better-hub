# Cookie Consent & Data Privacy Banner

A GDPR-compliant cookie consent banner displayed to all first-time visitors.

## Behavior

1. On first visit, a fixed-bottom banner appears with Accept/Decline buttons and a link to the privacy policy
2. The user's choice is persisted to `localStorage` under the key `gh-admin-cookie-consent`
3. On subsequent visits, the banner is not shown if a choice has already been recorded
4. The banner renders on all pages (root layout) — both pre-login and post-login

## Implementation

### Component

`client/components/ui/cookie-consent-banner.tsx`

- Uses `useState` + `useEffect` to check `localStorage` on mount (SSR-safe — never reads `localStorage` during server render)
- Two actions: **Accept** and **Decline**, both persist the choice and dismiss the banner
- Styled as a floating card at the bottom of the viewport with `z-50` to stay above other content

### Integration

The `CookieConsentBanner` is rendered inside `ThemeProvider` in `client/routes/__root.tsx`, so it inherits the active theme (light/dark) and appears on every page.

### Storage

| Key | Values | Storage |
|-----|--------|---------|
| `gh-admin-cookie-consent` | `accepted` \| `declined` | `localStorage` |

LocalStorage was chosen over cookies because:
- The consent preference itself does not need to be sent to the server
- It persists across sessions without expiration
- No additional cookie overhead

## Key Files

| File | Purpose |
|------|---------|
| `client/components/ui/cookie-consent-banner.tsx` | Banner component with Accept/Decline |
| `client/routes/__root.tsx` | Root layout — renders the banner globally |

## Future Enhancements

- **Granular preferences:** Allow users to separately consent to analytics vs. essential cookies
- **Server-side sync:** For authenticated users, persist consent to the GitHubAgent DO via oRPC so it roams across devices
- **Consent audit log:** Record consent timestamps for compliance reporting
