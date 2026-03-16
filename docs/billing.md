# Billing & Subscription Management

Stripe-powered subscription management with three tiers (Free, Standard, Unlimited), integrated with Better Auth's Stripe plugin.

## User-Facing Pages

### Billing Page (`/dashboard/billing`)

Displays:
- Current plan name, status, and color indicator
- Monthly tool usage count with progress bar
- Plan comparison section showing all three tiers with features and pricing
- "Upgrade to" buttons for higher tiers
- "Manage Billing" button for paid subscribers → opens Stripe Customer Portal

### Key Files

| File | Purpose |
|------|---------|
| `client/routes/dashboard/billing.tsx` | Billing page route |
| `server/functions/billing.ts` | `getBillingData()` server function |
| `server/data-access-layer/billing.ts` | Stripe DAL (`getSubscription`, `createBillingPortalSession`) |
| `server/orpc/routes/billing.ts` | `billing.createPortalSession` oRPC procedure |
| `shared/config/pricing.ts` | Plan definitions and pricing |

## Stripe Integration

### Stripe Customer Portal
- `billing.createPortalSession` oRPC procedure generates a Stripe Customer Portal session URL
- Users can manage payment methods, cancel subscriptions, and update billing info
- `returnUrl` is validated to match the application's own origin (security fix SEC-011)

### Upgrade Flow
- Uses Better Auth's `authClient.subscription.upgrade({ plan, successUrl, cancelUrl })`
- Creates a Stripe Checkout session for the selected plan
- Webhook processes `customer.subscription.created/updated/deleted` events

### Subscription State Propagation
- On sign-in, the auth hook pushes the subscription tier to the user's `GitHubAgent` DO via `stub.setSubscriptionTier()`
- Usage limits update immediately in the DO without requiring a page refresh

## Design Decisions

- **Stripe Customer Portal for billing management:** No custom payment forms — Stripe handles all billing UI
- **Pricing defined in `shared/config/pricing.ts`:** Single source of truth for both server and client
- **Better Auth Stripe plugin:** Handles webhook processing and updates the `subscriptions` table automatically
- **`returnUrl` validation:** Prevents open redirect attacks via billing portal (SEC-011)
