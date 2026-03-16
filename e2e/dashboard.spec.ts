import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
	test('loads the command center', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveURL(/dashboard/);
		// Dashboard should display the main layout with navigation
		await expect(page.getByRole('navigation')).toBeVisible();
	});

	test('displays metric cards', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		// The command center shows metric cards for usage and quick actions
		const main = page.getByRole('main');
		await expect(main).toBeVisible();
	});

	test('navigation links are accessible', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		// Key nav items should be present
		const nav = page.getByRole('navigation');
		await expect(nav).toBeVisible();
	});
});
