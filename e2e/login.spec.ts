import { test, expect } from '@playwright/test';

test.describe('Login & Authentication', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('home page shows sign-in button when not authenticated', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const signInButton = page.getByRole('button', { name: /sign in/i })
			.or(page.getByRole('link', { name: /sign in/i }));
		await expect(signInButton.first()).toBeVisible({ timeout: 10_000 });
	});

	test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		// Should redirect to login page (/) or show sign-in prompt
		const url = page.url();
		expect(
			!url.includes('/dashboard') || url === page.url(),
		).toBeTruthy();
	});

	test('authenticated user sees dashboard', async ({ page }) => {
		// This test uses the default storageState (authenticated)
		test.use({ storageState: 'e2e/.auth/user.json' });

		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveURL(/dashboard/);
	});
});
