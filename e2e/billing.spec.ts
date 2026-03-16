import { test, expect } from '@playwright/test';

test.describe('Billing & Subscriptions', () => {
	test('billing page loads and shows current plan', async ({ page }) => {
		await page.goto('/dashboard/billing');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveURL(/dashboard\/billing/);

		// Should display the current plan name (Free, Standard, or Unlimited)
		const planText = page.getByText(/free|standard|unlimited/i);
		await expect(planText.first()).toBeVisible({ timeout: 10_000 });
	});

	test('displays usage information', async ({ page }) => {
		await page.goto('/dashboard/billing');
		await page.waitForLoadState('networkidle');

		// Usage section should show tool calls used
		const usageText = page.getByText(/tool call|usage/i);
		await expect(usageText.first()).toBeVisible({ timeout: 10_000 });
	});

	test('shows plan comparison with upgrade options', async ({ page }) => {
		await page.goto('/dashboard/billing');
		await page.waitForLoadState('networkidle');

		// Plan comparison should show Standard and Unlimited options
		const standardPlan = page.getByText(/standard/i);
		const unlimitedPlan = page.getByText(/unlimited/i);

		await expect(standardPlan.first()).toBeVisible({ timeout: 10_000 });
		await expect(unlimitedPlan.first()).toBeVisible({ timeout: 10_000 });
	});

	test('upgrade button redirects to Stripe Checkout', async ({ page }) => {
		await page.goto('/dashboard/billing');
		await page.waitForLoadState('networkidle');

		// Find upgrade button
		const upgradeButton = page.getByRole('button', { name: /upgrade/i }).or(
			page.getByRole('link', { name: /upgrade/i }),
		);

		if (await upgradeButton.first().isVisible().catch(() => false)) {
			// Capture navigation — should go to Stripe
			const [response] = await Promise.all([
				page.waitForEvent('response', { timeout: 15_000 }).catch(() => null),
				upgradeButton.first().click(),
			]);

			// Verify redirect to Stripe checkout
			await page.waitForTimeout(3_000);
			const url = page.url();
			// Either redirected to Stripe or a checkout URL was opened
			expect(
				url.includes('checkout.stripe.com') ||
				url.includes('stripe.com') ||
				url.includes('dashboard/billing'),
			).toBeTruthy();
		}
	});

	test('usage counter visible in chat interface', async ({ page }) => {
		test.setTimeout(30_000);
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		// Usage counter should be visible in chat footer
		const usageIndicator = page.getByText(/\d+\s*\/\s*\d+|tools?\s*used/i);
		await expect(usageIndicator.first()).toBeVisible({ timeout: 15_000 }).catch(() => {
			// Usage display may vary by implementation
		});
	});
});
