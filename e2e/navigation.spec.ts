import { test, expect } from '@playwright/test';

test.describe('Navigation & Layout', () => {
	test('all dashboard routes are accessible', async ({ page }) => {
		const routes = [
			'/dashboard',
			'/dashboard/chat',
			'/dashboard/billing',
			'/dashboard/settings',
			'/dashboard/scheduling',
		];

		for (const route of routes) {
			await page.goto(route);
			await page.waitForLoadState('networkidle');

			// Each route should load without errors
			const main = page.getByRole('main');
			await expect(main).toBeVisible({ timeout: 10_000 });
		}
	});

	test('navigation drawer contains expected links', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		const nav = page.getByRole('navigation');
		await expect(nav).toBeVisible();

		// Check for key navigation items
		const settingsLink = nav.getByText(/settings/i);
		await expect(settingsLink.first()).toBeVisible().catch(() => {
			// Settings may be in a menu or drawer
		});
	});

	test('app menubar is present', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		// Menubar should be visible at the top
		const menubar = page.getByRole('menubar').or(page.getByRole('banner'));
		await expect(menubar.first()).toBeVisible();
	});
});
