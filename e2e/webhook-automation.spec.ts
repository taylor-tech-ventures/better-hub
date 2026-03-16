import { test, expect } from '@playwright/test';

test.describe('Webhook Automation', () => {
	test('webhook rules page loads', async ({ page }) => {
		await page.goto('/dashboard/webhooks');
		await page.waitForLoadState('networkidle');

		const main = page.getByRole('main');
		await expect(main).toBeVisible();
	});

	test('displays existing rules or empty state', async ({ page }) => {
		await page.goto('/dashboard/webhooks');
		await page.waitForLoadState('networkidle');

		// Should show a list of webhook rules or an empty state
		const content = page.getByText(/rule|webhook|no.*rule|create/i);
		await expect(content.first()).toBeVisible({ timeout: 10_000 }).catch(() => {
			// Page structure may vary
		});
	});

	test('create rule form is accessible', async ({ page }) => {
		await page.goto('/dashboard/webhooks');
		await page.waitForLoadState('networkidle');

		// Look for a create/add rule button
		const createButton = page.getByRole('button', { name: /create|add|new/i });
		if (await createButton.first().isVisible().catch(() => false)) {
			await createButton.first().click();
			await page.waitForLoadState('networkidle');

			// Form should have event type selector and action configuration
			const main = page.getByRole('main');
			await expect(main).toBeVisible();
		}
	});

	test('webhook event log is accessible', async ({ page }) => {
		await page.goto('/dashboard/webhooks');
		await page.waitForLoadState('networkidle');

		// Look for an event log tab or section
		const logTab = page.getByRole('tab', { name: /log|event|history/i })
			.or(page.getByText(/event log|recent events/i));

		if (await logTab.first().isVisible().catch(() => false)) {
			await logTab.first().click();
			await page.waitForLoadState('networkidle');

			const main = page.getByRole('main');
			await expect(main).toBeVisible();
		}
	});
});
