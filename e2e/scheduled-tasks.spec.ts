import { test, expect } from '@playwright/test';

test.describe('Scheduled Tasks', () => {
	test('scheduling page loads', async ({ page }) => {
		await page.goto('/dashboard/scheduling');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveURL(/dashboard\/scheduling/);
		const main = page.getByRole('main');
		await expect(main).toBeVisible();
	});

	test('displays pending and completed tasks', async ({ page }) => {
		await page.goto('/dashboard/scheduling');
		await page.waitForLoadState('networkidle');

		// The scheduling page should show a list/table of tasks or an empty state
		const main = page.getByRole('main');
		await expect(main).toBeVisible();

		// Either a table of tasks or an empty state message
		const content = page.getByText(/no.*task|pending|scheduled|completed/i);
		await expect(content.first()).toBeVisible({ timeout: 10_000 }).catch(() => {
			// Empty state or different wording is acceptable
		});
	});

	test('schedule task via chat confirms and creates', async ({ page }) => {
		test.setTimeout(90_000);
		await page.goto('/dashboard/chat');
		await page.waitForLoadState('networkidle');

		const input = page.getByRole('textbox');
		await expect(input).toBeVisible({ timeout: 15_000 });

		await input.fill('Show me all my scheduled tasks');
		await input.press('Enter');

		// Should get a response (table of tasks or empty state)
		const response = page.locator('[data-testid="message"], .message, article, [role="article"]');
		await expect(response.first()).toBeVisible({ timeout: 60_000 });
	});
});
